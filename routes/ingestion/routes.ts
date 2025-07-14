import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { ChatBedrockConverse } from "@langchain/aws";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { checkApiKey } from "../../lib/check-api-key.ts";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter: (_req, _file, cb) => {
    // Accept all file types
    cb(null, true);
  },
});

// Initialize AWS clients
const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});

const dynamoClient = new DynamoDBClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});

const bedrockAgentClient = new BedrockAgentClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});

const bedrockModelId = Deno.env.get("BEDROCK_MODEL_ID") || "anthropic.claude-3-5-sonnet-20240620-v1:0";
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
// Initialize LLM for analysis
const llm = new ChatBedrockConverse({
  model: bedrockModelId,
  region: awsRegion,
  streaming: false,
});

// Async function to trigger knowledge base sync (non-blocking)
async function triggerKnowledgeBaseSync(batchInfo: string): Promise<void> {
  const knowledgeBaseId = Deno.env.get("BEDROCK_KNOWLEDGE_BASE_ID");
  const dataSourceId = Deno.env.get("BEDROCK_DATA_SOURCE_ID");

  if (!knowledgeBaseId || !dataSourceId) {
    console.warn("⚠️ [ingestion] Knowledge base sync skipped - missing BEDROCK_KNOWLEDGE_BASE_ID or BEDROCK_DATA_SOURCE_ID");
    return;
  }

  try {
    console.log(`🔄 [ingestion] Triggering knowledge base sync for batch upload`);

    const command = new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
      description: `Ingestion job triggered by batch file upload: ${batchInfo}`,
    });

    const response = await bedrockAgentClient.send(command);
    console.log(`✅ [ingestion] Knowledge base sync started successfully`);

    if (response.ingestionJob) {
      console.log(`📄 [ingestion] Job ID: ${response.ingestionJob.ingestionJobId}, Status: ${response.ingestionJob.status}`);
    }
  } catch (error) {
    console.error(`❌ [ingestion] Knowledge base sync failed:`, error);
    // Don't throw error - this shouldn't block the main ingestion process
  }
}

// Define the expected JSON structure for file analysis
interface FileAnalysis {
  id: string;
  version: string;
  name: string;
  type: string;
  size: number;
  summary: string;
  key_topics: string[];
  data_classification: string;
  upload_timestamp: string;
  s3_key: string;
  s3_bucket: string;
  content_type: string;
  last_modified: string;
}

// POST /api/ingest - Upload and analyze file
router.post("/api/ingest", (req: Request, res: Response) => {
  // Check API key first
  checkApiKey(req, res, () => {
    // Use multer middleware with error handling - accept any field name
    upload.any()(req, res, async (err) => {
      const startTime = Date.now();
      console.log(`\n🚀 [ingestion] Starting file ingestion at ${new Date().toISOString()}`);

      if (err) {
        console.error(`❌ [ingestion] Multer error:`, err);
        return res.status(400).json({
          error: `File upload error: ${err.message}`,
          type: "UPLOAD_ERROR"
        });
      }

      try {
        // With upload.any(), files are in req.files array
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files provided" });
        }

        console.log(`📁 [ingestion] Processing ${files.length} file(s)`);

        const processedFiles: FileAnalysis[] = [];
        const errors: string[] = [];
        let syncTriggered = false;

        // Process each file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileId = uuidv4();
          const timestamp = new Date().toISOString();
          const s3Key = `uploads/${timestamp.split('T')[0]}/${file.originalname}`;

          console.log(`📁 [ingestion] Processing file ${i + 1}/${files.length}: ${file.originalname} (${file.size} bytes)`);

          try {
            // Step 1: Upload to S3
            const uploadStartTime = Date.now();
            console.log(`☁️ [ingestion] Uploading file ${i + 1} to S3...`);

            const uploadCommand = new PutObjectCommand({
              Bucket: Deno.env.get("S3_BUCKET_NAME"),
              Key: s3Key,
              Body: file.buffer,
              ContentType: file.mimetype,
              Metadata: {
                originalName: file.originalname,
                uploadTimestamp: timestamp,
                fileId: fileId,
              },
            });

            await s3Client.send(uploadCommand);
            const uploadEndTime = Date.now();
            console.log(`✅ [ingestion] S3 upload for file ${i + 1} completed in ${uploadEndTime - uploadStartTime}ms`);

            // Trigger knowledge base sync only once per batch (asynchronously, non-blocking)
            if (!syncTriggered) {
              syncTriggered = true;
              const batchInfo = `${files.length} files starting at ${new Date().toISOString()}`;
              triggerKnowledgeBaseSync(batchInfo).catch(error => {
                console.error(`❌ [ingestion] Background knowledge base sync failed:`, error);
              });
            }

            // Step 2: Analyze file with LLM
            const analysisStartTime = Date.now();
            console.log(`🧠 [ingestion] Starting LLM analysis for file ${i + 1}...`);

            const analysisPrompt = `You are assisting in preparing commercial pharmaceutical data for downstream analysis at Starfire, an AI-native intelligence platform. Your role is to contextualize this document for pharmaceutical commercial teams who need actionable business intelligence.

File Information:
- Filename: ${file.originalname}
- File Type: ${file.mimetype}
- File Size: ${file.size} bytes

Analysis Instructions:
1. Summarize the document's commercial relevance in 2-3 sentences, focusing on key points that matter to pharma commercial teams
2. Identify which commercial intelligence themes are present in this document
3. Extract business context that supports executive decision-making
4. Classify the data type based on its commercial application

Commercial Intelligence Themes to Identify:
- Market Access (payor coverage, formulary positioning, access barriers)
- HEOR (Health Economics & Outcomes Research, cost-effectiveness)
- Omnichannel Engagement (HCP interactions, digital touchpoints)
- Patient Journey (treatment pathways, patient flow analysis)
- Physician Profiling (prescriber behavior, targeting insights)
- Pricing/GTN (gross-to-net, pricing strategy, rebates)
- Contracting/Compliance (managed care contracts, regulatory compliance)
- Forecasting (demand planning, market projections)
- Competitive Intelligence (market share, competitor analysis)
- Brand Performance (launch metrics, sales performance)

Return a JSON response with this exact structure:
{
  "type": "Commercial document type (e.g., 'Market Access Analysis', 'Brand Performance Dashboard', 'Payor Coverage Report', 'Competitive Intelligence Brief', 'Launch Readiness Assessment')",
  "summary": "Direct, confident 2-3 sentence description focusing on commercial relevance and business decisions this data supports. Start with strong action words like 'Enables', 'Supports', 'Provides', 'Analyzes' - never use uncertain language",
  "key_topics": ["3-5 commercial intelligence topics from the themes above that are most relevant"],
  "data_classification": "Commercial classification (e.g., 'Market Access Intelligence', 'Brand Performance Data', 'Competitive Analysis', 'HEOR Evidence', 'Commercial Analytics')"
}

IMPORTANT: Focus on commercial intelligence value and business impact. Each element should support downstream decision-making for pharmaceutical commercial teams.

Example commercial intelligence summaries:
- "Enables market access strategy optimization by analyzing payor coverage patterns and formulary positioning across therapeutic areas."
- "Supports brand performance tracking with physician prescribing behavior data and competitive benchmarking insights."
- "Provides HEOR evidence for pricing negotiations and demonstrates cost-effectiveness versus competitor therapies."

The goal is to create meaningful context that supports real-time business intelligence generation and executive decision-making.`;

            const analysisResponse = await llm.invoke(analysisPrompt);
            const analysisEndTime = Date.now();
            console.log(`✅ [ingestion] LLM analysis for file ${i + 1} completed in ${analysisEndTime - analysisStartTime}ms`);

            // Parse LLM response to extract JSON
            let analysisData;
            try {
              const jsonMatch = analysisResponse.content.toString().match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                analysisData = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error("No JSON found in LLM response");
              }
            } catch (parseError) {
              console.warn(`Failed to parse LLM response for file ${i + 1}, using intelligent defaults:`, parseError);

              // Intelligent fallback analysis based on commercial intelligence patterns
              const filename = file.originalname.toLowerCase();
              let type = 'Commercial Document';
              let summary = `Supports commercial intelligence analysis: ${file.originalname}`;
              let key_topics = ['commercial analytics'];
              let data_classification = 'Commercial Data';

              // Commercial intelligence patterns
              if (filename.includes('mup') || filename.includes('dpr')) {
                type = 'Market Access Analysis';
                summary = `Enables pricing strategy optimization through Medicare Utilization and Payment (MUP) data analysis, supporting payor negotiations and access decisions.`;
                key_topics = ['market access', 'pricing strategy', 'payor intelligence', 'utilization data'];
                data_classification = 'Market Access Intelligence';
              } else if (filename.includes('prescription') || filename.includes('rx')) {
                type = 'Physician Profiling Report';
                summary = `Supports targeting and engagement strategy through prescription behavior analysis, enabling sales force optimization and HCP segmentation.`;
                key_topics = ['physician profiling', 'prescribing patterns', 'targeting strategy', 'sales optimization'];
                data_classification = 'Commercial Analytics';
              } else if (filename.includes('clinical') || filename.includes('trial')) {
                type = 'HEOR Evidence Package';
                summary = `Provides clinical evidence for market access and pricing negotiations, supporting value proposition development and payor discussions.`;
                key_topics = ['HEOR', 'clinical evidence', 'value proposition', 'payor negotiations'];
                data_classification = 'HEOR Evidence';
              } else {
                // File type fallbacks with commercial intelligence focus
                if (file.mimetype.includes('pdf')) {
                  type = 'Commercial Intelligence Report';
                  summary = `Supports business decision-making through structured commercial data analysis and strategic insights in report format.`;
                  key_topics = ['commercial intelligence', 'business insights', 'strategic analysis'];
                  data_classification = 'Commercial Analytics';
                } else if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
                  type = 'Commercial Data Analysis';
                  summary = `Enables quantitative analysis and modeling for commercial strategy development through structured dataset.`;
                  key_topics = ['commercial modeling', 'data analysis', 'strategy development'];
                  data_classification = 'Commercial Analytics';
                } else if (file.mimetype.includes('csv')) {
                  type = 'Commercial Dataset';
                  summary = `Provides structured commercial data for analytics, forecasting, and business intelligence applications.`;
                  key_topics = ['commercial data', 'business intelligence', 'analytics'];
                  data_classification = 'Commercial Data';
                }
              }

              analysisData = { type, summary, key_topics, data_classification };
            }

            // Step 3: Create structured response
            const fileAnalysis: FileAnalysis = {
              id: fileId,
              version: "1",
              name: file.originalname,
              type: analysisData.type,
              size: file.size,
              summary: analysisData.summary,
              key_topics: analysisData.key_topics || [],
              data_classification: analysisData.data_classification,
              upload_timestamp: timestamp,
              s3_key: s3Key,
              s3_bucket: Deno.env.get("S3_BUCKET_NAME") || "",
              content_type: file.mimetype,
              last_modified: timestamp,
            };

            // Step 4: Store in DynamoDB
            const dbStartTime = Date.now();
            console.log(`💾 [ingestion] Storing metadata for file ${i + 1} in DynamoDB...`);

            // Prepare DynamoDB item with proper handling of empty arrays
            const dynamoItem: Record<string, any> = {
              objectKey: { S: fileAnalysis.s3_key }, // Partition key
              version: { S: fileAnalysis.version }, // Sort key
              id: { S: fileAnalysis.id },
              name: { S: fileAnalysis.name },
              type: { S: fileAnalysis.type },
              size: { N: fileAnalysis.size.toString() },
              summary: { S: fileAnalysis.summary },
              data_classification: { S: fileAnalysis.data_classification },
              upload_timestamp: { S: fileAnalysis.upload_timestamp },
              s3_key: { S: fileAnalysis.s3_key },
              s3_bucket: { S: fileAnalysis.s3_bucket },
              // GSI attributes
              contentType: { S: file.mimetype }, // For typeIndex GSI
              lastModified: { S: fileAnalysis.upload_timestamp }, // For typeIndex GSI
            };

            // Only add key_topics if it's not empty (DynamoDB String Sets can't be empty)
            if (fileAnalysis.key_topics && fileAnalysis.key_topics.length > 0) {
              dynamoItem.key_topics = { SS: fileAnalysis.key_topics };
            }

            const dbCommand = new PutItemCommand({
              TableName: Deno.env.get("S3_DYNAMODB_TABLE"),
              Item: dynamoItem,
            });

            await dynamoClient.send(dbCommand);
            const dbEndTime = Date.now();
            console.log(`✅ [ingestion] DynamoDB storage for file ${i + 1} completed in ${dbEndTime - dbStartTime}ms`);

            // Add processed file to results
            processedFiles.push(fileAnalysis);
            console.log(`✅ [ingestion] File ${i + 1}/${files.length} processed successfully: ${file.originalname}`);

          } catch (fileError: unknown) {
            const errorMessage = fileError instanceof Error ? fileError.message : "File processing failed";
            console.error(`❌ [ingestion] Error processing file ${i + 1}/${files.length} (${file.originalname}):`, errorMessage);
            errors.push(`${file.originalname}: ${errorMessage}`);
          }
        }

        // Step 5: Return structured JSON response
        const totalTime = Date.now() - startTime;
        console.log(`🏁 [ingestion] Batch ingestion completed in ${totalTime}ms`);
        console.log(`📊 [ingestion] Results: ${processedFiles.length} successful, ${errors.length} failed`);

        // Return response with results and any errors
        if (processedFiles.length === 0) {
          return res.status(500).json({
            error: "All files failed to process",
            errors,
            timestamp: new Date().toISOString(),
          });
        }

        const response: any = {
          files: processedFiles,
          summary: {
            total: files.length,
            successful: processedFiles.length,
            failed: errors.length,
          }
        };

        // Include errors if any occurred
        if (errors.length > 0) {
          response.errors = errors;
        }

        res.json(response);

      } catch (error: unknown) {
        const errorTime = Date.now();
        const totalErrorTime = errorTime - startTime;
        console.error(`❌ [ingestion] Error after ${totalErrorTime}ms:`, error);

        res.status(500).json({
          error: error instanceof Error ? error.message : "File ingestion failed",
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
});

// GET /api/ingest - Fetch paginated list of ingested files
router.get("/api/ingest", checkApiKey, async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`\n🔍 [ingestion] Starting file list request at ${new Date().toISOString()}`);

  try {
    // Parse pagination parameters
    const pageCount = Math.min(parseInt(req.query.pageCount as string) || 20, 100); // Max 100 items
    const page = Math.max(parseInt(req.query.page as string) || 1, 1); // Minimum page 1

    console.log(`📄 [ingestion] Fetching page ${page} with ${pageCount} items per page`);

    // Build scan parameters for getting all items (we'll handle pagination in memory)
    // This is a simplification - for production with large datasets, you'd want to implement
    // more efficient pagination directly with DynamoDB
    const scanParams: any = {
      TableName: Deno.env.get("S3_DYNAMODB_TABLE"),
    };


    // Execute scan
    const scanStartTime = Date.now();
    const result = await dynamoClient.send(new ScanCommand(scanParams));
    const scanEndTime = Date.now();

    console.log(`✅ [ingestion] DynamoDB scan completed in ${scanEndTime - scanStartTime}ms`);
    console.log(`📊 [ingestion] Found ${result.Items?.length || 0} items`);

    // Transform DynamoDB items to our FileAnalysis format
    const items: FileAnalysis[] = (result.Items || []).map((item) => {
      const unmarshalled = unmarshall(item);

      // Handle key_topics String Set manually since unmarshall() doesn't handle it properly
      const keyTopics = item.key_topics?.SS || [];

      return {
        id: unmarshalled.id,
        version: unmarshalled.version,
        name: unmarshalled.name,
        type: unmarshalled.type,
        size: unmarshalled.size,
        summary: unmarshalled.summary,
        key_topics: keyTopics, // Use the raw SS array directly
        data_classification: unmarshalled.data_classification,
        upload_timestamp: unmarshalled.upload_timestamp,
        s3_key: unmarshalled.s3_key,
        s3_bucket: unmarshalled.s3_bucket,
        content_type: unmarshalled.contentType,
        last_modified: unmarshalled.lastModified,
      };
    });

    // Sort by upload timestamp (newest first)
    items.sort((a, b) => new Date(b.upload_timestamp).getTime() - new Date(a.upload_timestamp).getTime());
    
    // Calculate total count (in a real production app, you might want to use a separate count query or cache this)
    const total = items.length;
    
    // Calculate pagination values
    const totalPages = Math.max(1, Math.ceil(total / pageCount));
    const startIndex = (page - 1) * pageCount;
    const endIndex = Math.min(startIndex + pageCount, total);
    
    // Get items for current page
    const pageItems = items.slice(startIndex, endIndex);
    
    // Determine if there are more pages
    const hasMore = page < totalPages;
    
    // Prepare pagination response
    const response: any = {
      data: pageItems,
      pagination: {
        page,
        pageCount,
        hasMore,
        totalPages
      }
    };

    const totalTime = Date.now() - startTime;
    console.log(`🏁 [ingestion] File list request completed in ${totalTime}ms`);
    console.log(`📊 [ingestion] Performance breakdown:`);
    console.log(`   • DynamoDB Scan: ${scanEndTime - scanStartTime}ms`);
    console.log(`   • Data Processing: ${totalTime - (scanEndTime - scanStartTime)}ms`);

    res.json(response);

  } catch (error: unknown) {
    const errorTime = Date.now();
    const totalErrorTime = errorTime - startTime;
    console.error(`❌ [ingestion] List error after ${totalErrorTime}ms:`, error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch file list",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;