import { Router, Request, Response } from "express";
import {
  // Unused but kept for future implementation
  RetrieveAndGenerateCommand as _RetrieveAndGenerateCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient, ScanCommand, PutItemCommand, GetItemCommand, DeleteItemCommand, QueryCommand as _QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { ChatBedrockConverse } from "@langchain/aws";
import { AmazonKnowledgeBaseRetriever } from "@langchain/aws";
import { checkApiKey } from "../../lib/check-api-key.ts";
import { v4 as uuidv4 } from "uuid";
// Using Deno's built-in Uint8Array instead of Node.js Buffer
// Dynamic import will be used for PptxGenJS due to Deno compatibility issues

const router = Router();

// Environment variables
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const bedrockModelId = Deno.env.get("BEDROCK_MODEL_ID") || "anthropic.claude-3-sonnet-20240229-v1:0";
const knowledgeBaseId = Deno.env.get("BEDROCK_KNOWLEDGE_BASE_ID") || "";
const s3BucketName = Deno.env.get("S3_BUCKET_NAME") || "";
const dynamodbS3Table = Deno.env.get("DYNAMODB_S3_TABLE") || "";
const dynamodbVisualizationsTable = Deno.env.get("DYNAMODB_VISUALIZATIONS_TABLE") || "starfire-visualizations";



const dynamoClient = new DynamoDBClient({
  region: awsRegion,
});

const s3Client = new S3Client({
  region: awsRegion,
});

// Initialize LLM for analysis
const llm = new ChatBedrockConverse({
  model: bedrockModelId,
  region: awsRegion,
  streaming: false,
});

// Define chart types supported by shadcn/ui
type ChartType = "bar" | "line" | "pie" | "radar" | "scatter";

// Define the structure for a single visualization
interface Visualization {
  id: string;
  title: string;
  description: string;
  insights: string[];
  chartType: ChartType;
  chartData: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[] | Array<{ x: number, y: number }>;
      backgroundColor?: string[];
      borderColor?: string;
      fill?: boolean;
    }>;
  };
  recommendations: string[];
}

// Define the structure for a visualization set (multiple charts)
interface VisualizationSet {
  id: string;
  title: string;
  description: string;
  summary: string;
  createdAt: string;
  visualizations: Visualization[];
  metadata: {
    documentsAnalyzed: number;
    filesReferenced: number;
    processingTime: number;
  };
}

// Define the structure for a PowerPoint slide
interface PowerPointSlide {
  id: string;
  slideNumber: number;
  title: string;
  slideType: "title" | "content" | "chart" | "summary" | "recommendation";
  content: {
    mainPoints: string[];
    subPoints?: string[];
    visualData?: any;
    insights?: string[];
    recommendations?: string[];
  };
  speakerNotes: string;
}



/**
 * Generate multiple visualizations from knowledge base data
 * This route automatically analyzes data from the knowledge base and generates
 * multiple chart visualizations without requiring a specific topic
 */
router.post("/api/visualize/generate", checkApiKey, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`\n📊 [visualization] Starting auto-visualization generation at ${new Date().toISOString()}`);

  try {
    // Generate a unique ID for this visualization set
    const visualizationSetId = uuidv4();
    console.log(`🆔 [visualization] Generated visualization set ID: ${visualizationSetId}`);

    // Step 1: Retrieve data from knowledge base
    console.log(`🔍 [visualization] Retrieving data from knowledge base...`);
    const retrievalStartTime = Date.now();

    // Initialize Knowledge Base retriever
    const retriever = new AmazonKnowledgeBaseRetriever({
      topK: 20, // Retrieve more documents for comprehensive analysis
      knowledgeBaseId,
      region: awsRegion,
    });

    // Use a general query to retrieve a diverse set of documents
    const documents = await retriever.invoke("healthcare data analysis life sciences commercial intelligence");

    const retrievalEndTime = Date.now();
    console.log(`✅ [visualization] Retrieved ${documents.length} documents in ${retrievalEndTime - retrievalStartTime}ms`);

    // Step 2: Retrieve file metadata from DynamoDB
    console.log(`💾 [visualization] Retrieving file metadata from DynamoDB...`);
    const metadataStartTime = Date.now();

    const scanParams = {
      TableName: dynamodbS3Table,
      Limit: 50, // Limit to recent files
    };

    const dbResult = await dynamoClient.send(new ScanCommand(scanParams));
    const fileMetadata = dbResult.Items?.map(item => {
      const unmarshalled = unmarshall(item);
      // Handle key_topics String Set manually since unmarshall() doesn't handle it properly
      const keyTopics = item.key_topics?.SS || [];
      return {
        ...unmarshalled,
        key_topics: keyTopics
      };
    }) || [];

    const metadataEndTime = Date.now();
    console.log(`✅ [visualization] Retrieved ${fileMetadata.length} file metadata records in ${metadataEndTime - metadataStartTime}ms`);

    // Step 3: Use LLM to analyze data and generate multiple chart visualizations
    console.log(`🧠 [visualization] Starting LLM analysis for multiple visualizations...`);
    const analysisStartTime = Date.now();

    // Prepare document content for LLM
    const documentContent = documents
      .map(doc => `Document: ${doc.metadata.title || "Untitled"}\n${doc.pageContent.substring(0, 1000)}`) // Truncate long documents
      .join("\n\n");

    // Prepare file metadata for LLM
    const metadataContent = fileMetadata
      .map((file: any) => {
        const fileName = file.name || file.originalName || "Unknown";
        const fileType = file.type || file.content_type || file.contentType || "Unknown";
        const keyTopics = Array.isArray(file.key_topics) ? file.key_topics.join(", ") : "N/A";
        const summary = file.summary || "No summary available";
        return `File: ${fileName}, Type: ${fileType}, Topics: ${keyTopics}, Summary: ${summary}`;
      })
      .join("\n");

    // Create prompt for LLM to generate multiple visualizations
    const visualizationPrompt = `You are a strategic commercial intelligence analyst for Starfire, helping pharmaceutical executives make data-driven decisions. Your task is to analyze commercial data and generate executive-ready visualizations that identify trends, anomalies, and strategic opportunities.

COMMERCIAL DATA ANALYZED:
${documentContent}

FILE METADATA:
${metadataContent}

Based on the above commercial intelligence data, generate FOUR executive-level visualizations that provide actionable insights for pharmaceutical commercial leadership. Focus on business impact and strategic decision-making rather than technical analysis.

Each visualization should:
- Highlight key trends impacting brand performance
- Identify anomalies or deviations from expected metrics  
- Surface strategic opportunities or risks
- Provide clear next-best-action recommendations
- Be suitable for C-suite presentations and decision-making

Your response must follow this exact JSON format:

{
  "title": "Generate a specific, descriptive title based on the actual data analyzed (e.g., 'Medicare Drug Utilization Analysis Q2 2025', 'Clinical Trial Outcomes Dashboard', 'Pharmaceutical Market Intelligence Report')",
  "description": "Generate a specific description based on the actual data and insights found",
  "summary": "Executive summary of the key findings across all visualizations (2-3 sentences)",
  "visualizations": [
    {
      "id": "viz1",
      "title": "Clear, concise chart title for visualization 1",
      "description": "Brief description of what visualization 1 shows",
      "insights": [
        "Executive insight 1: Business trend or performance impact",
        "Strategic insight 2: Market opportunity or competitive advantage", 
        "Commercial insight 3: Revenue or growth implication"
      ],
      "chartType": "bar",
      "chartData": {
        "labels": ["Label1", "Label2", "Label3"],
        "datasets": [
          {
            "label": "Dataset name",
            "data": [value1, value2, value3],
            "backgroundColor": ["#color1", "#color2", "#color3"],
            "borderColor": "#bordercolor",
            "fill": true
          }
        ]
      },
      "recommendations": [
        "Strategic action: Specific next-best-action for commercial team",
        "Tactical recommendation: Immediate step to capitalize on insight"
      ]
    },
    {
      "id": "viz2",
      "title": "Clear, concise chart title for visualization 2",
      "description": "Brief description of what visualization 2 shows",
      "insights": [
        "Executive insight: Business trend or performance impact",
        "Strategic insight: Market opportunity or competitive advantage", 
        "Commercial insight: Revenue or growth implication"
      ],
      "chartType": "line",
      "chartData": {
        "labels": ["Label1", "Label2", "Label3", "Label4", "Label5"],
        "datasets": [
          {
            "label": "Dataset name",
            "data": [value1, value2, value3, value4, value5],
            "borderColor": "#bordercolor",
            "fill": false
          }
        ]
      },
      "recommendations": [
        "Strategic action: Specific next-best-action for commercial team",
        "Tactical recommendation: Immediate step to capitalize on insight"
      ]
    },
    {
      "id": "viz3",
      "title": "Clear, concise chart title for visualization 3",
      "description": "Brief description of what visualization 3 shows",
      "insights": [
        "Executive insight: Business trend or performance impact",
        "Strategic insight: Market opportunity or competitive advantage", 
        "Commercial insight: Revenue or growth implication"
      ],
      "chartType": "pie",
      "chartData": {
        "labels": ["Label1", "Label2", "Label3", "Label4"],
        "datasets": [
          {
            "data": [value1, value2, value3, value4],
            "backgroundColor": ["#color1", "#color2", "#color3", "#color4"]
          }
        ]
      },
      "recommendations": [
        "Strategic action: Specific next-best-action for commercial team",
        "Tactical recommendation: Immediate step to capitalize on insight"
      ]
    },
    {
      "id": "viz4",
      "title": "Clear, concise chart title for visualization 4",
      "description": "Brief description of what visualization 4 shows",
      "insights": [
        "Executive insight: Business trend or performance impact",
        "Strategic insight: Market opportunity or competitive advantage", 
        "Commercial insight: Revenue or growth implication"
      ],
      "chartType": "radar",
      "chartData": {
        "labels": ["Label1", "Label2", "Label3", "Label4", "Label5"],
        "datasets": [
          {
            "label": "Dataset name",
            "data": [value1, value2, value3, value4, value5],
            "backgroundColor": "rgba(color, 0.2)",
            "borderColor": "#bordercolor",
            "fill": true
          }
        ]
      },
      "recommendations": [
        "Strategic action: Specific next-best-action for commercial team",
        "Tactical recommendation: Immediate step to capitalize on insight"
      ]
    }
  ]
}

IMPORTANT GUIDELINES FOR EXECUTIVE-READY DELIVERABLES:
1. Generate realistic commercial metrics based on pharmaceutical business context
2. Focus on business impact, trends, and strategic opportunities rather than technical analysis
3. Use executive-friendly language - avoid jargon, be concise and actionable
4. Each insight should highlight business implications (revenue, market share, competitive position)
5. Recommendations must be specific next-best-actions for commercial teams
6. All metrics should be realistic for pharmaceutical commercial operations
7. Use professional color schemes suitable for C-suite presentations
8. Ensure JSON is valid and properly formatted
9. CREATE EXECUTIVE-FOCUSED TITLES that reflect commercial intelligence (e.g., "Brand Performance Outlook Q3 2025", "Channel Mix Optimization Analysis", "Market Access Impact Assessment")
10. Surface anomalies, deviations from forecast, and strategic implications
11. Make visualizations suitable for PowerPoint slides and executive briefings

Examples of commercial intelligence titles:
- "Brand Performance vs. Competitive Landscape Q2 2025"
- "Channel Strategy Effectiveness Analysis"
- "Market Access Barrier Impact Assessment"
- "Launch Performance vs. Forecast Tracking"
- "Payor Mix Optimization Opportunities"

Your deliverables should enable pharmaceutical executives to make strategic commercial decisions quickly and confidently.`;

    // Call LLM to generate multiple visualizations
    const analysisResponse = await llm.invoke(visualizationPrompt);
    const analysisEndTime = Date.now();
    console.log(`✅ [visualization] LLM analysis completed in ${analysisEndTime - analysisStartTime}ms`);

    // Step 4: Parse LLM response to extract JSON
    let visualizationSet: VisualizationSet;
    try {
      const jsonMatch = analysisResponse.content.toString().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);

        // Add IDs and timestamps
        visualizationSet = {
          id: visualizationSetId,
          title: parsedData.title,
          description: parsedData.description,
          summary: parsedData.summary,
          createdAt: new Date().toISOString(),
          visualizations: parsedData.visualizations.map((viz: any, index: number) => ({
            ...viz,
            id: viz.id || `viz-${index + 1}`
          })),
          metadata: {
            documentsAnalyzed: documents.length,
            filesReferenced: fileMetadata.length,
            processingTime: Date.now() - startTime
          }
        };
      } else {
        throw new Error("No JSON found in LLM response");
      }
    } catch (parseError) {
      console.error(`❌ [visualization] Failed to parse LLM response:`, parseError);

      // Provide fallback visualization data
      visualizationSet = {
        id: visualizationSetId,
        title: "Healthcare Data Analysis",
        description: "Automated analysis of healthcare data from knowledge base",
        summary: "Analysis could not be completed successfully",
        createdAt: new Date().toISOString(),
        visualizations: [
          {
            id: "fallback-1",
            title: "Data Analysis Error",
            description: "Visualization could not be generated",
            insights: ["Data analysis could not be completed", "Please try again later"],
            chartType: "bar",
            chartData: {
              labels: ["No Data Available"],
              datasets: [{
                label: "No Data",
                data: [0],
                backgroundColor: ["#e0e0e0"]
              }]
            },
            recommendations: ["Try again later"]
          }
        ],
        metadata: {
          documentsAnalyzed: documents.length,
          filesReferenced: fileMetadata.length,
          processingTime: Date.now() - startTime
        }
      };
    }

    // Step 5: Store visualization set in DynamoDB
    console.log(`💾 [visualization] Storing visualization set in DynamoDB...`);
    const storageStartTime = Date.now();

    try {
      const dbItem = marshall(visualizationSet, { removeUndefinedValues: true });

      const putCommand = new PutItemCommand({
        TableName: dynamodbVisualizationsTable,
        Item: dbItem
      });

      await dynamoClient.send(putCommand);
      const storageEndTime = Date.now();
      console.log(`✅ [visualization] Stored visualization set in DynamoDB in ${storageEndTime - storageStartTime}ms`);
    } catch (dbError) {
      console.error(`❌ [visualization] Failed to store in DynamoDB:`, dbError);

      // Handle case where table doesn't exist
      if (dbError instanceof Error && dbError.name === "ResourceNotFoundException") {
        console.warn(`⚠️ [visualization] Visualizations table does not exist. Visualization will not be persisted.`);
      }

      // Continue execution - we'll return the data even if storage fails
    }

    // Step 6: Return visualization data
    const totalTime = Date.now() - startTime;
    console.log(`🏁 [visualization] Request completed in ${totalTime}ms`);

    res.json({
      visualizationSetId: visualizationSet.id,
      title: visualizationSet.title,
      summary: visualizationSet.summary,
      visualizationCount: visualizationSet.visualizations.length,
      createdAt: visualizationSet.createdAt,
      metadata: visualizationSet.metadata
    });

  } catch (error: unknown) {
    console.error(`❌ [visualization] Error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Visualization generation failed",
      timestamp: new Date().toISOString(),
    });
  }
});


/**
 * Generate PowerPoint from existing visualization set
 * Creates a PPTX presentation containing all charts from the visualization set
 */
router.post("/api/visualize/:id/powerpoint", checkApiKey, async (req: Request, res: Response) => {
  const visualizationId = req.params.id;
  const startTime = Date.now();

  console.log(`\n📄 [powerpoint] Starting PowerPoint generation for visualization set ${visualizationId} at ${new Date().toISOString()}`);

  try {
    // Step 1: Retrieve the existing visualization from DynamoDB
    console.log(`🔍 [powerpoint] Retrieving visualization ${visualizationId}...`);
    const getCommand = new GetItemCommand({
      TableName: dynamodbVisualizationsTable,
      Key: marshall({ id: visualizationId })
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return res.status(404).json({ error: "Visualization not found" });
    }

    const visualizationSet = unmarshall(result.Item) as VisualizationSet;
    console.log(`✅ [powerpoint] Found visualization set: ${visualizationSet.title} with ${visualizationSet.visualizations.length} charts`);

    // Step 2: Generate Executive-Ready PowerPoint with Native Charts and Corporate Branding
    console.log(`📊 [powerpoint] Generating executive PowerPoint with native charts for ${visualizationSet.visualizations.length} visualizations...`);
    const pptxStartTime = Date.now();

    // Generate a unique presentation ID
    const _presentationId = uuidv4();

    // Use dynamic import for PptxGenJS due to Deno compatibility issues
    const PptxGenJSModule = await import("pptxgenjs");
    const PptxGenJS = PptxGenJSModule.default || PptxGenJSModule;
    const pptx = new (PptxGenJS as any)();

    // Set presentation properties with corporate branding
    pptx.author = "Starfire AI";
    pptx.company = "Starfire";
    pptx.title = visualizationSet.title;
    pptx.subject = "Commercial Intelligence Analysis";
    pptx.category = "Executive Report";

    // Corporate Brand Colors (Starfire Theme)
    const brandColors = {
      primary: "2E86AB",       // Starfire blue
      secondary: "A23B72",     // Accent purple  
      accent: "F39C12",        // Gold accent
      background: "F8F9FA",    // Light background
      text: "2C3E50",          // Dark text
      textLight: "7F8C8D",     // Light text
      white: "FFFFFF",
      success: "27AE60",       // Green for positive metrics
      warning: "E67E22",       // Orange for attention
      danger: "E74C3C"         // Red for negative metrics
    };

    // Define Slide Master Layout for Corporate Branding - adjusted for standard slide dimensions
    const masterSlideLayout = {
      header: {
        x: 0, y: 0, w: 10, h: 0.8,
        fill: { color: brandColors.primary },
        margin: 0.1
      },
      logo: {
        x: 8.5, y: 0.2, w: 1.3, h: 0.4
      },
      footer: {
        x: 0, y: 6.8, w: 10, h: 0.4,
        fill: { color: brandColors.background },
        fontSize: 10,
        color: brandColors.textLight
      }
    };

    // Helper function to add corporate header to slides
    const addCorporateHeader = (slide: any, title: string) => {
      // Header background
      slide.addShape("rect", {
        x: masterSlideLayout.header.x,
        y: masterSlideLayout.header.y,
        w: masterSlideLayout.header.w,
        h: masterSlideLayout.header.h,
        fill: { color: brandColors.primary },
        line: { width: 0 }
      });

      // Slide title in header - adjusted for slide bounds
      slide.addText(title, {
        x: 0.2,
        y: 0.2,
        w: 8,
        h: 0.4,
        fontSize: 18,
        bold: true,
        color: brandColors.white,
        valign: "middle"
      });

      // Company logo area (placeholder) - adjusted position
      slide.addText("STARFIRE", {
        x: 8.2,
        y: 0.2,
        w: 1.6,
        h: 0.4,
        fontSize: 11,
        bold: true,
        color: brandColors.white,
        align: "right",
        valign: "middle"
      });
    };

    // Helper function to add corporate footer to slides
    const addCorporateFooter = (slide: any, pageNumber?: string) => {
      slide.addShape("rect", {
        x: masterSlideLayout.footer.x,
        y: masterSlideLayout.footer.y,
        w: masterSlideLayout.footer.w,
        h: masterSlideLayout.footer.h,
        fill: { color: brandColors.background },
        line: { width: 1, color: brandColors.textLight }
      });

      slide.addText("Confidential | Starfire Commercial Intelligence", {
        x: 0.2,
        y: 6.9,
        w: 7,
        h: 0.2,
        fontSize: 8,
        color: brandColors.textLight
      });

      if (pageNumber) {
        slide.addText(pageNumber, {
          x: 8.5,
          y: 6.9,
          w: 1.3,
          h: 0.2,
          fontSize: 8,
          color: brandColors.textLight,
          align: "right"
        });
      }
    };


    // Helper function to create custom bar chart using shapes
    const createBarChart = (slide: any, chartData: any, x: number, y: number, w: number, h: number) => {
      if (!chartData || !chartData.labels || !chartData.datasets || !chartData.datasets[0]) return;

      const dataset = chartData.datasets[0];
      const values = dataset.data || [];
      const labels = chartData.labels;
      const maxValue = Math.max(...values.filter((v: any) => typeof v === 'number'));

      if (maxValue <= 0) return;

      const barWidth = (w - 1) / labels.length * 0.7; // 70% width for bars, 30% for spacing
      const barSpacing = (w - 1) / labels.length * 0.3;
      const chartHeight = h - 1; // Leave space for labels

      labels.forEach((label: string, index: number) => {
        const value = values[index] || 0;
        const barHeight = (value / maxValue) * chartHeight * 0.8; // 80% of chart height
        const barX = x + index * (barWidth + barSpacing);
        const barY = y + chartHeight - barHeight;

        // Draw bar
        slide.addShape("rect", {
          x: barX, y: barY, w: barWidth, h: barHeight,
          fill: { color: index % 2 === 0 ? brandColors.primary : brandColors.secondary },
          line: { width: 1, color: brandColors.white }
        });

        // Add value label on top of bar
        slide.addText(value.toLocaleString(), {
          x: barX, y: barY - 0.3, w: barWidth, h: 0.25,
          fontSize: 8, color: brandColors.text, align: "center"
        });

        // Add category label at bottom - ensure it fits
        const truncatedLabel = label.length > 10 ? label.substring(0, 10) + '...' : label;
        slide.addText(truncatedLabel, {
          x: barX, y: y + chartHeight + 0.05, w: barWidth, h: 0.25,
          fontSize: 7, color: brandColors.text, align: "center"
        });
      });
    };

    // Helper function to create custom pie chart using shapes
    const createPieChart = (slide: any, chartData: any, x: number, y: number, w: number, h: number) => {
      if (!chartData || !chartData.labels || !chartData.datasets || !chartData.datasets[0]) return;

      const dataset = chartData.datasets[0];
      const values = dataset.data || [];
      const labels = chartData.labels;
      const total = values.reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);

      if (total <= 0) return;

      const centerX = x + w / 2;
      const centerY = y + h / 2;
      const radius = Math.min(w, h) / 3;

      let currentAngle = 0;
      const colors = [brandColors.primary, brandColors.secondary, brandColors.accent, brandColors.success, brandColors.warning];

      labels.forEach((label: string, index: number) => {
        const value = values[index] || 0;
        const percentage = (value / total) * 100;
        const angle = (value / total) * 360;

        if (percentage > 0 && index < 6) { // Limit to 6 legend items to fit in chart area
          // Create pie slice (simplified as colored rectangles for legend)
          const legendY = y + 0.5 + index * 0.35; // Adjusted spacing

          // Legend color box - positioned within chart area
          slide.addShape("rect", {
            x: x + w * 0.6, y: legendY, w: 0.2, h: 0.2,
            fill: { color: colors[index % colors.length] },
            line: { width: 1, color: brandColors.white }
          });

          // Legend text - truncated to fit
          const truncatedLabel = label.length > 12 ? label.substring(0, 12) + '...' : label;
          slide.addText(`${truncatedLabel}: ${percentage.toFixed(1)}%`, {
            x: x + w * 0.6 + 0.25, y: legendY, w: w * 0.35, h: 0.2,
            fontSize: 9, color: brandColors.text
          });
        }

        currentAngle += angle;
      });

      // Draw main pie circle (simplified)
      slide.addShape("ellipse", {
        x: centerX - radius, y: centerY - radius, w: radius * 2, h: radius * 2,
        fill: { color: brandColors.background },
        line: { width: 2, color: brandColors.primary }
      });

      // Add center label
      slide.addText("Pie Chart", {
        x: centerX - 1, y: centerY - 0.15, w: 2, h: 0.3,
        fontSize: 12, bold: true, color: brandColors.text, align: "center"
      });
    };

    // Helper function to create custom line chart using shapes
    const createLineChart = (slide: any, chartData: any, x: number, y: number, w: number, h: number) => {
      if (!chartData || !chartData.labels || !chartData.datasets || !chartData.datasets[0]) return;

      const dataset = chartData.datasets[0];
      const values = dataset.data || [];
      const labels = chartData.labels;
      const maxValue = Math.max(...values.filter((v: any) => typeof v === 'number'));
      const minValue = Math.min(...values.filter((v: any) => typeof v === 'number'));

      if (maxValue <= minValue) return;

      const chartWidth = w - 1;
      const chartHeight = h - 0.8;
      const pointSpacing = chartWidth / (labels.length - 1);

      // Draw trend line using rectangles to simulate line segments
      for (let i = 0; i < values.length - 1; i++) {
        const value1 = values[i] || 0;
        const value2 = values[i + 1] || 0;
        const y1 = y + chartHeight - ((value1 - minValue) / (maxValue - minValue)) * chartHeight;
        const y2 = y + chartHeight - ((value2 - minValue) / (maxValue - minValue)) * chartHeight;
        const x1 = x + i * pointSpacing;
        const x2 = x + (i + 1) * pointSpacing;

        // Draw line segment
        slide.addShape("line", {
          x: x1, y: y1, w: x2 - x1, h: y2 - y1,
          line: { width: 3, color: brandColors.primary }
        });

        // Draw data points
        slide.addShape("ellipse", {
          x: x1 - 0.05, y: y1 - 0.05, w: 0.1, h: 0.1,
          fill: { color: brandColors.secondary },
          line: { width: 1, color: brandColors.white }
        });
      }

      // Labels at bottom - ensure they fit within bounds
      labels.forEach((label: string, index: number) => {
        const truncatedLabel = label.length > 8 ? label.substring(0, 8) + '...' : label;
        slide.addText(truncatedLabel, {
          x: x + index * pointSpacing - 0.4, y: y + chartHeight + 0.05, w: 0.8, h: 0.25,
          fontSize: 7, color: brandColors.text, align: "center"
        });
      });
    };

    // Helper function to create data table
    const createDataTable = (slide: any, chartData: any, x: number, y: number, w: number, h: number) => {
      if (!chartData || !chartData.labels || !chartData.datasets) return;

      const labels = chartData.labels;
      const dataset = chartData.datasets[0] || {};
      const values = dataset.data || [];
      const maxRows = Math.min(labels.length, 6); // Limit to 6 rows
      const rowHeight = h / (maxRows + 1); // +1 for header

      // Header
      slide.addShape("rect", {
        x: x, y: y, w: w, h: rowHeight,
        fill: { color: brandColors.primary },
        line: { width: 1, color: brandColors.white }
      });

      slide.addText("Category", {
        x: x + 0.1, y: y + 0.05, w: w * 0.6 - 0.1, h: rowHeight - 0.1,
        fontSize: 10, bold: true, color: brandColors.white, valign: "middle"
      });

      slide.addText("Value", {
        x: x + w * 0.6, y: y + 0.05, w: w * 0.4 - 0.1, h: rowHeight - 0.1,
        fontSize: 10, bold: true, color: brandColors.white, valign: "middle", align: "right"
      });

      // Data rows
      for (let i = 0; i < maxRows; i++) {
        const rowY = y + (i + 1) * rowHeight;
        const isEven = i % 2 === 0;

        slide.addShape("rect", {
          x: x, y: rowY, w: w, h: rowHeight,
          fill: { color: isEven ? brandColors.white : brandColors.background },
          line: { width: 1, color: brandColors.textLight }
        });

        slide.addText(labels[i]?.substring(0, 25) || '', {
          x: x + 0.1, y: rowY + 0.05, w: w * 0.6 - 0.1, h: rowHeight - 0.1,
          fontSize: 9, color: brandColors.text, valign: "middle"
        });

        const value = values[i];
        const displayValue = typeof value === 'number' ? value.toLocaleString() : 'N/A';
        slide.addText(displayValue, {
          x: x + w * 0.6, y: rowY + 0.05, w: w * 0.4 - 0.1, h: rowHeight - 0.1,
          fontSize: 9, color: brandColors.text, valign: "middle", align: "right"
        });
      }
    };

    // 1. Executive Title Slide with Corporate Branding
    const titleSlide = pptx.addSlide();

    // Full-width brand header - adjusted to fit slide
    titleSlide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 1.2,
      fill: { color: brandColors.primary },
      line: { width: 0 }
    });

    // Main title - adjusted width
    titleSlide.addText(visualizationSet.title, {
      x: 0.5, y: 2.5, w: 9, h: 1.5,
      fontSize: 32,
      bold: true,
      color: brandColors.primary,
      align: "center",
      fontFace: "Segoe UI"
    });

    // Subtitle - adjusted width
    titleSlide.addText("Executive Commercial Intelligence Report", {
      x: 0.5, y: 4, w: 9, h: 0.8,
      fontSize: 18,
      color: brandColors.text,
      align: "center",
      fontFace: "Segoe UI Light"
    });

    // Metadata section with visual styling - adjusted dimensions
    titleSlide.addShape("rect", {
      x: 1.5, y: 5, w: 7, h: 1.5,
      fill: { color: brandColors.background },
      line: { width: 1, color: brandColors.textLight }
    });

    titleSlide.addText([
      { text: "Analysis Overview", options: { fontSize: 14, bold: true, color: brandColors.text } },
      { text: `\n• Total Visualizations: ${visualizationSet.visualizations.length}`, options: { fontSize: 12, color: brandColors.text } },
      { text: `\n• Generated: ${new Date().toLocaleDateString()}`, options: { fontSize: 12, color: brandColors.text } },
      { text: `\n• Report ID: ${visualizationSet.id.substring(0, 8)}...`, options: { fontSize: 10, color: brandColors.textLight } }
    ], {
      x: 2, y: 5.3, w: 6, h: 1
    });

    addCorporateFooter(titleSlide, "1");

    // 2. Executive Summary Slide (if available)
    if (visualizationSet.summary) {
      const summarySlide = pptx.addSlide();
      addCorporateHeader(summarySlide, "Executive Summary");

      // Summary content with professional styling - adjusted dimensions
      summarySlide.addShape("rect", {
        x: 0.5, y: 1.2, w: 9, h: 4.5,
        fill: { color: brandColors.white },
        line: { width: 1, color: brandColors.textLight }
      });

      summarySlide.addText(visualizationSet.summary, {
        x: 0.8, y: 1.5, w: 8.4, h: 3.9,
        fontSize: 16,
        color: brandColors.text,
        fontFace: "Segoe UI",
        lineSpacing: 24
      });

      addCorporateFooter(summarySlide, "2");
    }

    // 3. Process each visualization with native charts and two-column layout
    visualizationSet.visualizations.forEach((chartData, chartIndex) => {
      try {
        console.log(`📊 [powerpoint] Creating native chart slide ${chartIndex + 1}: ${chartData.title}`);

        const chartSlide = pptx.addSlide();
        addCorporateHeader(chartSlide, chartData.title || `Chart ${chartIndex + 1}`);

        // Two-column layout: Chart (left) + Insights/Recommendations (right)
        // Standard PowerPoint slide is 10" x 7.5" - adjust dimensions to fit
        const leftColumnWidth = 5.8;  // Reduced from 7.5
        const rightColumnWidth = 3.7;  // Reduced from 5.3
        const leftColumnX = 0.3;       // Moved inward
        const rightColumnX = leftColumnX + leftColumnWidth + 0.2;

        // LEFT COLUMN: Custom Chart Visualization using Shapes
        if (chartData.chartData && chartData.chartData.labels && chartData.chartData.datasets) {
          try {
            console.log(`[powerpoint] Creating custom ${chartData.chartType} chart with visual elements`);

            // Chart container with border - adjusted height to fit slide
            chartSlide.addShape("rect", {
              x: leftColumnX, y: 1.5, w: leftColumnWidth, h: 4.0,
              fill: { color: brandColors.white },
              line: { width: 2, color: brandColors.primary }
            });

            // Chart title
            chartSlide.addText(chartData.description || `${chartData.chartType.toUpperCase()} Chart`, {
              x: leftColumnX + 0.1, y: 1.6, w: leftColumnWidth - 0.2, h: 0.4,
              fontSize: 12, bold: true, color: brandColors.text, align: "center"
            });

            // Create chart based on type - adjusted dimensions
            const chartAreaX = leftColumnX + 0.2;
            const chartAreaY = 2.1;
            const chartAreaW = leftColumnWidth - 0.4;
            const chartAreaH = 3.0;

            switch (chartData.chartType.toLowerCase()) {
              case 'bar':
              case 'column':
                createBarChart(chartSlide, chartData.chartData, chartAreaX, chartAreaY, chartAreaW, chartAreaH);
                break;
              case 'pie':
                createPieChart(chartSlide, chartData.chartData, chartAreaX, chartAreaY, chartAreaW * 0.6, chartAreaH);
                break;
              case 'line':
                createLineChart(chartSlide, chartData.chartData, chartAreaX, chartAreaY, chartAreaW, chartAreaH);
                break;
              default:
                // For radar, scatter, or unknown types, show data table
                createDataTable(chartSlide, chartData.chartData, chartAreaX, chartAreaY, chartAreaW, chartAreaH);
                break;
            }

          } catch (chartError) {
            console.error(`[powerpoint] Error creating custom chart:`, chartError);

            // Fallback to data table - adjusted height
            chartSlide.addShape("rect", {
              x: leftColumnX, y: 1.5, w: leftColumnWidth, h: 4.0,
              fill: { color: brandColors.background },
              line: { width: 1, color: brandColors.warning }
            });

            chartSlide.addText(`${chartData.chartType.toUpperCase()} Data`, {
              x: leftColumnX, y: 2, w: leftColumnWidth, h: 0.5,
              fontSize: 14, bold: true, color: brandColors.text, align: "center"
            });

            if (chartData.chartData) {
              createDataTable(chartSlide, chartData.chartData, leftColumnX + 0.2, 2.7, leftColumnWidth - 0.4, 3);
            }
          }
        } else {
          console.warn(`[powerpoint] No valid chart data for ${chartData.title}`);

          // Fallback for missing chart data - adjusted height
          chartSlide.addShape("rect", {
            x: leftColumnX, y: 1.5, w: leftColumnWidth, h: 4.0,
            fill: { color: brandColors.background },
            line: { width: 1, color: brandColors.textLight }
          });

          chartSlide.addText("No Chart Data Available", {
            x: leftColumnX, y: 3, w: leftColumnWidth, h: 0.5,
            fontSize: 16, bold: true, color: brandColors.textLight, align: "center"
          });

          chartSlide.addText(chartData.description || "Data visualization could not be generated", {
            x: leftColumnX, y: 3.8, w: leftColumnWidth, h: 1,
            fontSize: 12, color: brandColors.textLight, align: "center"
          });
        }

        // RIGHT COLUMN: Insights and Recommendations Sidebar
        let rightColumnY = 1.5;

        // Insights section
        if (chartData.insights && chartData.insights.length > 0) {
          // Insights header
          chartSlide.addShape("rect", {
            x: rightColumnX, y: rightColumnY, w: rightColumnWidth, h: 0.5,
            fill: { color: brandColors.primary },
            line: { width: 0 }
          });

          chartSlide.addText("Key Insights", {
            x: rightColumnX + 0.1, y: rightColumnY + 0.1, w: rightColumnWidth - 0.2, h: 0.3,
            fontSize: 12,
            bold: true,
            color: brandColors.white
          });

          rightColumnY += 0.6;

          // Insights content - limit height to fit within slide
          const availableHeight = 6.5 - rightColumnY; // Account for footer space
          const insightsHeight = Math.min(1.8, Math.min(availableHeight * 0.45, chartData.insights.length * 0.35 + 0.3));
          chartSlide.addShape("rect", {
            x: rightColumnX, y: rightColumnY, w: rightColumnWidth, h: insightsHeight,
            fill: { color: brandColors.white },
            line: { width: 1, color: brandColors.primary }
          });

          // Truncate insights to fit available space
          const maxInsights = Math.floor((insightsHeight - 0.3) / 0.3);
          const displayInsights = chartData.insights.slice(0, maxInsights);
          const insightsText = displayInsights.map((insight: string) => {
            const truncated = insight.length > 50 ? insight.substring(0, 50) + '...' : insight;
            return `• ${truncated}`;
          }).join('\n');

          chartSlide.addText(insightsText, {
            x: rightColumnX + 0.1, y: rightColumnY + 0.1, w: rightColumnWidth - 0.2, h: insightsHeight - 0.2,
            fontSize: 9,
            color: brandColors.text,
            fontFace: "Segoe UI"
          });

          rightColumnY += insightsHeight + 0.3;
        }

        // Recommendations section
        if (chartData.recommendations && chartData.recommendations.length > 0) {
          // Recommendations header
          chartSlide.addShape("rect", {
            x: rightColumnX, y: rightColumnY, w: rightColumnWidth, h: 0.5,
            fill: { color: brandColors.secondary },
            line: { width: 0 }
          });

          chartSlide.addText("Recommendations", {
            x: rightColumnX + 0.1, y: rightColumnY + 0.1, w: rightColumnWidth - 0.2, h: 0.3,
            fontSize: 12,
            bold: true,
            color: brandColors.white
          });

          rightColumnY += 0.6;

          // Recommendations content - limit height to remaining space
          const remainingHeight = 6.5 - rightColumnY;
          const recommendationsHeight = Math.min(1.8, Math.min(remainingHeight - 0.2, chartData.recommendations.length * 0.35 + 0.3));
          chartSlide.addShape("rect", {
            x: rightColumnX, y: rightColumnY, w: rightColumnWidth, h: recommendationsHeight,
            fill: { color: brandColors.white },
            line: { width: 1, color: brandColors.secondary }
          });

          // Truncate recommendations to fit available space
          const maxRecommendations = Math.floor((recommendationsHeight - 0.3) / 0.3);
          const displayRecommendations = chartData.recommendations.slice(0, maxRecommendations);
          const recommendationsText = displayRecommendations.map((rec: string) => {
            const truncated = rec.length > 50 ? rec.substring(0, 50) + '...' : rec;
            return `→ ${truncated}`;
          }).join('\n');

          chartSlide.addText(recommendationsText, {
            x: rightColumnX + 0.1, y: rightColumnY + 0.1, w: rightColumnWidth - 0.2, h: recommendationsHeight - 0.2,
            fontSize: 9,
            color: brandColors.text,
            fontFace: "Segoe UI"
          });
        }

        addCorporateFooter(chartSlide, `${chartIndex + 3}`);

      } catch (slideError) {
        console.error(`[powerpoint] Error creating slide ${chartIndex + 1}:`, slideError);

        // Create a basic error slide
        const errorSlide = pptx.addSlide();
        addCorporateHeader(errorSlide, `Chart ${chartIndex + 1} - Error`);

        errorSlide.addText("Unable to generate chart slide", {
          x: 1, y: 3, w: 11.33, h: 1,
          fontSize: 16,
          color: brandColors.warning,
          align: "center"
        });

        errorSlide.addText(chartData.title || `Chart ${chartIndex + 1}`, {
          x: 1, y: 4, w: 11.33, h: 0.5,
          fontSize: 12,
          color: brandColors.text,
          align: "center"
        });

        addCorporateFooter(errorSlide, `${chartIndex + 3}`);
      }
    });

    // 4. Executive Summary and Next Steps Slide
    const finalSlide = pptx.addSlide();
    addCorporateHeader(finalSlide, "Summary & Next Steps");

    // Summary metrics with visual styling
    finalSlide.addShape("rect", {
      x: 1, y: 1.5, w: 11.33, h: 2.5,
      fill: { color: brandColors.background },
      line: { width: 1, color: brandColors.textLight }
    });

    finalSlide.addText([
      { text: "Analysis Complete", options: { fontSize: 18, bold: true, color: brandColors.primary } },
      { text: `\n\n✓ ${visualizationSet.visualizations.length} visualizations analyzed`, options: { fontSize: 14, color: brandColors.success } },
      { text: `\n✓ ${visualizationSet.metadata?.documentsAnalyzed || 'Multiple'} documents processed`, options: { fontSize: 14, color: brandColors.success } },
      { text: `\n✓ ${visualizationSet.metadata?.filesReferenced || 'Multiple'} data sources referenced`, options: { fontSize: 14, color: brandColors.success } }
    ], {
      x: 1.5, y: 2, w: 10.33, h: 1.5
    });

    // Next steps section
    finalSlide.addShape("rect", {
      x: 1, y: 4.5, w: 11.33, h: 2,
      fill: { color: brandColors.white },
      line: { width: 1, color: brandColors.secondary }
    });

    finalSlide.addText([
      { text: "Recommended Next Steps", options: { fontSize: 16, bold: true, color: brandColors.secondary } },
      { text: "\n→ Review insights with commercial leadership team", options: { fontSize: 12, color: brandColors.text } },
      { text: "\n→ Prioritize recommendations by business impact", options: { fontSize: 12, color: brandColors.text } },
      { text: "\n→ Schedule follow-up analysis as needed", options: { fontSize: 12, color: brandColors.text } }
    ], {
      x: 1.5, y: 5, w: 10.33, h: 1.5
    });

    addCorporateFooter(finalSlide, `${visualizationSet.visualizations.length + 3}`);

    // Generate PPTX buffer with error handling
    let pptxBuffer: ArrayBuffer;
    try {
      console.log(`📄 [powerpoint] Generating PPTX file...`);
      pptxBuffer = await pptx.write('arraybuffer') as ArrayBuffer;
      const pptxEndTime = Date.now();
      console.log(`✅ [powerpoint] PowerPoint generated in ${pptxEndTime - pptxStartTime}ms`);
    } catch (pptxError) {
      console.error(`❌ [powerpoint] Error generating PPTX file:`, pptxError);

      // Create a minimal fallback presentation
      console.log(`🔄 [powerpoint] Creating fallback presentation...`);
      const fallbackPptx = new (PptxGenJS as any)();
      fallbackPptx.author = "Starfire AI";
      fallbackPptx.company = "Starfire";
      fallbackPptx.title = visualizationSet.title;

      const fallbackSlide = fallbackPptx.addSlide();
      fallbackSlide.addText(visualizationSet.title, {
        x: 1, y: 2, w: 11.33, h: 1,
        fontSize: 24, bold: true, color: "2E86AB", align: "center"
      });

      fallbackSlide.addText("PowerPoint Generation Error", {
        x: 1, y: 3.5, w: 11.33, h: 1,
        fontSize: 16, color: "E67E22", align: "center"
      });

      fallbackSlide.addText(`${visualizationSet.visualizations.length} visualizations were analyzed but could not be rendered as charts.`, {
        x: 1, y: 5, w: 11.33, h: 1,
        fontSize: 12, color: "333333", align: "center"
      });

      pptxBuffer = await fallbackPptx.write('arraybuffer') as ArrayBuffer;
      console.log(`✅ [powerpoint] Fallback presentation generated`);
    }

    // Step 3: Upload PowerPoint to S3
    console.log(`☁️ [powerpoint] Uploading PowerPoint to S3...`);
    const uploadStartTime = Date.now();

    const timestamp = new Date().toISOString();
    const fileName = `${visualizationSet.title.replace(/[^a-zA-Z0-9]/g, '_')}_${visualizationId}_presentation.pptx`;
    const s3Key = `visualizations/powerpoint/${timestamp.split('T')[0]}/${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: new Uint8Array(pptxBuffer),
      ContentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      Metadata: {
        visualizationId: visualizationId,
        totalCharts: visualizationSet.visualizations.length.toString(),
        visualizationTitle: visualizationSet.title,
        createdAt: timestamp,
      },
    });

    await s3Client.send(uploadCommand);
    const uploadEndTime = Date.now();
    console.log(`✅ [powerpoint] PowerPoint uploaded to S3 in ${uploadEndTime - uploadStartTime}ms`);

    // Step 4: Generate pre-signed URL
    console.log(`🔐 [powerpoint] Generating pre-signed URL...`);
    const presignedStartTime = Date.now();

    const getObjectCommand = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
    });

    // Generate pre-signed URL that expires in 24 hours
    const pptxUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 86400 });
    const presignedEndTime = Date.now();
    console.log(`✅ [powerpoint] Pre-signed URL generated in ${presignedEndTime - presignedStartTime}ms`);

    // Step 5: Return response
    const totalTime = Date.now() - startTime;
    console.log(`🏁 [powerpoint] PowerPoint generation completed in ${totalTime}ms`);

    res.json({
      success: true,
      visualizationTitle: visualizationSet.title,
      totalCharts: visualizationSet.visualizations.length,
      visualizationId: visualizationId,
      downloadUrl: pptxUrl,
      pptxUrl: pptxUrl,
      s3Key: s3Key,
      createdAt: timestamp,
      metadata: {
        processingTime: totalTime,
        fileSize: pptxBuffer.byteLength,
        format: 'PPTX',
        chartsIncluded: visualizationSet.visualizations.length,
        reportType: 'Multi-slide Comprehensive Presentation'
      }
    });

  } catch (error: unknown) {
    console.error(`❌ [powerpoint] Error generating PowerPoint:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "PowerPoint generation failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Generate PDF from existing visualization set
 * Creates a multi-page PDF containing all charts from the visualization set
 */
router.post("/api/visualize/:id/pdf", checkApiKey, async (req: Request, res: Response) => {
  const visualizationId = req.params.id;
  const startTime = Date.now();

  console.log(`\n📄 [pdf] Starting PDF generation for visualization set ${visualizationId} at ${new Date().toISOString()}`);

  try {
    // Step 1: Retrieve the existing visualization from DynamoDB
    console.log(`🔍 [pdf] Retrieving visualization ${visualizationId}...`);
    const getCommand = new GetItemCommand({
      TableName: dynamodbVisualizationsTable,
      Key: marshall({ id: visualizationId })
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return res.status(404).json({ error: "Visualization not found" });
    }

    const visualizationSet = unmarshall(result.Item) as VisualizationSet;
    console.log(`✅ [pdf] Found visualization set: ${visualizationSet.title} with ${visualizationSet.visualizations.length} charts`);

    // Step 2: Generate structured HTML content for each chart
    console.log(`📊 [pdf] Generating HTML content for ${visualizationSet.visualizations.length} charts...`);
    const htmlStartTime = Date.now();

    // Helper function to generate chart data table HTML
    const generateChartDataTable = (chartData: any) => {
      if (!chartData.chartData || !chartData.chartData.labels || !chartData.chartData.datasets) {
        return '<p class="no-data">No chart data available</p>';
      }

      let tableHtml = `
        <table class="chart-data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
      `;

      chartData.chartData.labels.forEach((label: string, index: number) => {
        const values = chartData.chartData.datasets.map((dataset: any) => {
          const value = Array.isArray(dataset.data) ? dataset.data[index] : 'N/A';
          return typeof value === 'number' ? value.toLocaleString() : value;
        }).join(', ');

        tableHtml += `
          <tr>
            <td class="category">${label}</td>
            <td class="value">${values}</td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
      `;

      return tableHtml;
    };

    // Generate CSS styles for professional PDF formatting
    const pdfStyles = `
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 100%;
          margin: 0;
          padding: 20px;
        }
        
        .page {
          page-break-after: always;
          min-height: 90vh;
          padding: 20px;
          background: white;
        }
        
        .cover-page {
          text-align: center;
          padding: 40px 20px;
        }
        
        .cover-title {
          font-size: 32px;
          font-weight: bold;
          color: #2E86AB;
          margin-bottom: 20px;
          line-height: 1.2;
        }
        
        .cover-subtitle {
          font-size: 18px;
          color: #666;
          margin-bottom: 30px;
        }
        
        .cover-info {
          font-size: 12px;
          color: #888;
          margin-top: 40px;
        }
        
        .summary-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        
        .chart-page {
          padding: 20px;
        }
        
        .chart-title {
          font-size: 24px;
          font-weight: bold;
          color: #2E86AB;
          margin-bottom: 15px;
          border-bottom: 2px solid #2E86AB;
          padding-bottom: 10px;
        }
        
        .chart-description {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
          font-style: italic;
        }
        
        .chart-type {
          display: inline-block;
          background: #A23B72;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        
        .section-header {
          font-size: 16px;
          font-weight: bold;
          color: #2E86AB;
          margin: 20px 0 10px 0;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        
        .chart-data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .chart-data-table th {
          background: #2E86AB;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
        }
        
        .chart-data-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #eee;
        }
        
        .chart-data-table tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .insights-list {
          background: #e8f4f8;
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
        }
        
        .recommendations-list {
          background: #f0e8f4;
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
        }
        
        .bullet-point {
          margin: 8px 0;
          padding-left: 20px;
          position: relative;
        }
        
        .bullet-point::before {
          content: "•";
          color: #2E86AB;
          font-weight: bold;
          position: absolute;
          left: 0;
        }
        
        .recommendation-point {
          margin: 8px 0;
          padding-left: 20px;
          position: relative;
        }
        
        .recommendation-point::before {
          content: "→";
          color: #A23B72;
          font-weight: bold;
          position: absolute;
          left: 0;
        }
        
        .page-footer {
          position: fixed;
          bottom: 20px;
          left: 20px;
          right: 20px;
          text-align: center;
          font-size: 10px;
          color: #888;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        
        .no-data {
          font-style: italic;
          color: #888;
          text-align: center;
          padding: 20px;
        }
        
        @media print {
          .page {
            page-break-after: always;
          }
        }
      </style>
    `;

    // Generate cover page HTML
    const coverPageHtml = `
      <div class="page cover-page">
        <h1 class="cover-title">${visualizationSet.title}</h1>
        <p class="cover-subtitle">Commercial Intelligence Analysis Report</p>
        
        ${visualizationSet.description ? `<div class="summary-section">
          <h3>Description</h3>
          <p>${visualizationSet.description}</p>
        </div>` : ''}
        
        <div class="cover-info">
          <p><strong>Total Charts:</strong> ${visualizationSet.visualizations.length}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Visualization ID:</strong> ${visualizationSet.id}</p>
        </div>
        
        ${visualizationSet.summary ? `<div class="summary-section">
          <h3>Executive Summary</h3>
          <p>${visualizationSet.summary}</p>
        </div>` : ''}
      </div>
    `;

    // Generate chart pages HTML
    const chartPagesHtml = visualizationSet.visualizations.map((chartData: any, chartIndex: number) => {
      console.log(`📄 [pdf] Processing chart ${chartIndex + 1}: ${chartData.title}`);

      return `
        <div class="page chart-page">
          <h2 class="chart-title">${chartData.title}</h2>
          
          ${chartData.description ? `<p class="chart-description">${chartData.description}</p>` : ''}
          
          <span class="chart-type">Chart Type: ${chartData.chartType.toUpperCase()}</span>
          
          <div class="section-header">Chart Data</div>
          ${generateChartDataTable(chartData)}
          
          ${chartData.insights && chartData.insights.length > 0 ? `
            <div class="section-header">Key Insights</div>
            <div class="insights-list">
              ${chartData.insights.map((insight: string) => `
                <div class="bullet-point">${insight}</div>
              `).join('')}
            </div>
          ` : ''}
          
          ${chartData.recommendations && chartData.recommendations.length > 0 ? `
            <div class="section-header">Recommendations</div>
            <div class="recommendations-list">
              ${chartData.recommendations.map((rec: string) => `
                <div class="recommendation-point">${rec}</div>
              `).join('')}
            </div>
          ` : ''}
          
          <div class="page-footer">
            Chart ${chartIndex + 1} of ${visualizationSet.visualizations.length} | Generated by Starfire AI
          </div>
        </div>
      `;
    }).join('');

    // Generate summary page HTML
    const summaryPageHtml = `
      <div class="page">
        <h2 class="chart-title">Report Summary</h2>
        
        <div class="summary-section">
          <p><strong>Analysis completed for ${visualizationSet.visualizations.length} charts</strong></p>
          <p><strong>Total processing time:</strong> ${Date.now() - startTime}ms</p>
          
          ${visualizationSet.metadata ? `
            <p><strong>Documents analyzed:</strong> ${visualizationSet.metadata.documentsAnalyzed || 'N/A'}</p>
            <p><strong>Files referenced:</strong> ${visualizationSet.metadata.filesReferenced || 'N/A'}</p>
          ` : ''}
        </div>
        
        <div class="page-footer">
          Report generated on ${new Date().toLocaleDateString()} by Starfire AI<br>
          From visualization set: ${visualizationSet.title}
        </div>
      </div>
    `;

    // Combine all HTML content
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${visualizationSet.title}</title>
          ${pdfStyles}
        </head>
        <body>
          ${coverPageHtml}
          ${chartPagesHtml}
          ${summaryPageHtml}
        </body>
      </html>
    `;

    const htmlEndTime = Date.now();
    console.log(`✅ [pdf] HTML content generated in ${htmlEndTime - htmlStartTime}ms`);

    // Step 3: Generate PDF from HTML using Puppeteer (server-friendly approach)
    console.log(`📄 [pdf] Converting HTML to PDF using Puppeteer...`);
    const pdfStartTime = Date.now();

    let pdfBuffer: Uint8Array;

    try {
      // Use dynamic import for Puppeteer
      const puppeteer = await import("npm:puppeteer@^23.8.0");

      // Launch browser with appropriate flags for server environment
      const browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 800 });

      // Set content and wait for rendering
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // Generate PDF with high-quality settings
      const pdfArrayBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        preferCSSPageSize: true,
        displayHeaderFooter: false
      });

      await browser.close();

      // Convert ArrayBuffer to Uint8Array
      pdfBuffer = new Uint8Array(pdfArrayBuffer);

      const pdfEndTime = Date.now();
      console.log(`✅ [pdf] PDF generated using Puppeteer in ${pdfEndTime - pdfStartTime}ms`);

    } catch (puppeteerError) {
      console.warn(`⚠️ [pdf] Puppeteer failed, falling back to jsPDF basic text rendering:`, puppeteerError);

      // Fallback to basic jsPDF text rendering if Puppeteer fails
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add cover page with basic text
      pdf.setFontSize(20);
      pdf.text(visualizationSet.title, 20, 30);
      pdf.setFontSize(14);
      pdf.text('Commercial Intelligence Analysis Report', 20, 50);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 70);
      pdf.text(`Total Charts: ${visualizationSet.visualizations.length}`, 20, 80);

      // Add basic chart information
      visualizationSet.visualizations.forEach((chartData: any, index: number) => {
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text(chartData.title, 20, 30);

        if (chartData.description) {
          pdf.setFontSize(12);
          const lines = pdf.splitTextToSize(chartData.description, 170);
          pdf.text(lines, 20, 50);
        }

        pdf.setFontSize(10);
        pdf.text(`Chart ${index + 1} of ${visualizationSet.visualizations.length}`, 20, 280);
      });

      pdfBuffer = new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer);

      const pdfEndTime = Date.now();
      console.log(`✅ [pdf] Fallback PDF generated in ${pdfEndTime - pdfStartTime}ms`);
    }

    // Step 4: Upload PDF to S3
    console.log(`☁️ [pdf] Uploading PDF to S3...`);
    const uploadStartTime = Date.now();

    const timestamp = new Date().toISOString();
    const fileName = `${visualizationSet.title.replace(/[^a-zA-Z0-9]/g, '_')}_${visualizationId}_complete.pdf`;
    const s3Key = `visualizations/pdf/${timestamp.split('T')[0]}/${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      Metadata: {
        visualizationId: visualizationId,
        totalCharts: visualizationSet.visualizations.length.toString(),
        visualizationTitle: visualizationSet.title,
        createdAt: timestamp,
      },
    });

    await s3Client.send(uploadCommand);
    const uploadEndTime = Date.now();
    console.log(`✅ [pdf] PDF uploaded to S3 in ${uploadEndTime - uploadStartTime}ms`);

    // Step 5: Generate pre-signed URL
    console.log(`🔐 [pdf] Generating pre-signed URL...`);
    const presignedStartTime = Date.now();

    const getObjectCommand = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
    });

    // Generate pre-signed URL that expires in 24 hours
    const pdfUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 86400 });
    const presignedEndTime = Date.now();
    console.log(`✅ [pdf] Pre-signed URL generated in ${presignedEndTime - presignedStartTime}ms`);

    // Step 6: Return response
    const totalTime = Date.now() - startTime;
    console.log(`🏁 [pdf] PDF generation completed in ${totalTime}ms`);

    res.json({
      success: true,
      visualizationTitle: visualizationSet.title,
      totalCharts: visualizationSet.visualizations.length,
      visualizationId: visualizationId,
      downloadUrl: pdfUrl,
      pdfUrl: pdfUrl,
      s3Key: s3Key,
      createdAt: timestamp,
      metadata: {
        processingTime: totalTime,
        fileSize: pdfBuffer.length,
        format: 'PDF',
        chartsIncluded: visualizationSet.visualizations.length,
        reportType: 'Multi-page Comprehensive Report'
      }
    });

  } catch (error: unknown) {
    console.error(`❌ [pdf] Error generating PDF:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "PDF generation failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Retrieve a specific visualization set by ID
 */
router.get("/api/visualize/:id", checkApiKey, async (req: Request, res: Response) => {
  const visualizationId = req.params.id;
  console.log(`\n🔍 [visualization] Retrieving visualization set ${visualizationId} at ${new Date().toISOString()}`);

  try {
    // Get visualization from DynamoDB
    const getCommand = new GetItemCommand({
      TableName: dynamodbVisualizationsTable,
      Key: marshall({ id: visualizationId })
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return res.status(404).json({ error: "Visualization set not found" });
    }

    const visualizationSet = unmarshall(result.Item) as VisualizationSet;
    return res.json(visualizationSet);

  } catch (error: unknown) {
    console.error(`❌ [visualization] Error retrieving visualization:`, error);

    // Handle case where table doesn't exist
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.warn(`⚠️ [visualization] Visualizations table does not exist.`);
      return res.status(404).json({
        error: "Visualizations table not found. No visualizations have been created yet.",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve visualization",
      timestamp: new Date().toISOString(),
    });
  }
});


/**
 * Delete a specific visualization set by ID
 */
router.delete("/api/visualize/:id", checkApiKey, async (req: Request, res: Response) => {
  const visualizationId = req.params.id;
  console.log(`\n🗑️ [visualization] Deleting visualization set ${visualizationId} at ${new Date().toISOString()}`);

  try {
    // Delete visualization from DynamoDB
    const deleteCommand = new DeleteItemCommand({
      TableName: dynamodbVisualizationsTable,
      Key: marshall({ id: visualizationId }),
      ReturnValues: "ALL_OLD"
    });

    const result = await dynamoClient.send(deleteCommand);

    if (!result.Attributes) {
      return res.status(404).json({
        error: "Visualization set not found",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ [visualization] Visualization set ${visualizationId} deleted successfully`);
    return res.json({
      message: "Visualization set deleted successfully",
      id: visualizationId,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error(`❌ [visualization] Error deleting visualization:`, error);

    // Handle case where table doesn't exist
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.warn(`⚠️ [visualization] Visualizations table does not exist.`);
      return res.status(404).json({
        error: "Visualizations table not found. No visualizations exist to delete.",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete visualization",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * List all visualization sets
 */
router.get("/api/visualize", checkApiKey, async (_req: Request, res: Response) => {
  console.log(`\n📋 [visualization] Listing all visualization sets at ${new Date().toISOString()}`);

  try {
    // Scan DynamoDB for all visualization sets
    const scanCommand = new ScanCommand({
      TableName: dynamodbVisualizationsTable,
      ProjectionExpression: "id, title, summary, createdAt, #md, visualizations[0].chartType",
      ExpressionAttributeNames: {
        "#md": "metadata"
      }
    });

    const result = await dynamoClient.send(scanCommand);

    const visualizationSets = result.Items?.map(item => unmarshall(item)) || [];

    res.json({
      visualizationSets,
      count: visualizationSets.length
    });

  } catch (error: unknown) {
    console.error(`❌ [visualization] Error listing visualizations:`, error);

    // Handle case where table doesn't exist
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.warn(`⚠️ [visualization] Visualizations table does not exist. Returning empty list.`);
      return res.json({
        visualizationSets: [],
        count: 0,
        message: "No visualizations table found. Create visualizations to see them here."
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list visualizations",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
