import { Router, Request, Application } from "express";
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateStreamCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import type { WebSocket } from "ws";
import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { ChatBedrockConverse } from "@langchain/aws";
import { AmazonKnowledgeBaseRetriever } from "@langchain/aws";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { BaseMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

// Environment variables
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const bedrockModelId = Deno.env.get("BEDROCK_MODEL_ID") || "anthropic.claude-3-5-sonnet-20240620-v1:0";
const knowledgeBaseId = Deno.env.get("BEDROCK_KNOWLEDGE_BASE_ID") || "";
const dynamodbChatsTable = Deno.env.get("DYNAMODB_CHATS_TABLE") || "langchain";

const router = Router();

// Initialize Bedrock client
const bedrockClient = new BedrockAgentRuntimeClient({
  region: awsRegion,
});

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: awsRegion,
});

// REST endpoint to get all chat sessions
router.get("/chats", async (req, res) => {
  try {
    // Parse pagination parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Default 20, max 100
    const exclusiveStartKey = req.query.cursor as string;

    console.log(`📋 Fetching chat sessions from DynamoDB table: ${dynamodbChatsTable} (limit: ${limit})`);

    // Scan the DynamoDB table with pagination
    const scanParams: any = {
      TableName: dynamodbChatsTable,
      Limit: limit * 3 // Get more items to account for grouping by sessionId
    };

    // Add cursor for pagination if provided
    if (exclusiveStartKey) {
      try {
        scanParams.ExclusiveStartKey = JSON.parse(atob(exclusiveStartKey));
      } catch (_error) {
        return res.status(400).json({ error: "Invalid cursor parameter" });
      }
    }

    const scanCommand = new ScanCommand(scanParams);

    const response = await dynamoDBClient.send(scanCommand);

    // Group messages by session ID and get the latest timestamp for each
    const sessionsMap = new Map();

    if (response.Items) {
      for (const item of response.Items) {
        const sessionId = item.id?.S;
        const timestamp = item.timestamp?.N ? parseInt(item.timestamp.N) : 0;

        if (sessionId) {
          const existing = sessionsMap.get(sessionId);
          if (!existing || timestamp > existing.lastActivity) {
            sessionsMap.set(sessionId, {
              sessionId,
              lastActivity: timestamp,
              messageCount: (existing?.messageCount || 0) + 1
            });
          } else if (existing) {
            existing.messageCount++;
          }
        }
      }
    }

    // Convert to array and sort by last activity
    const allSessions = Array.from(sessionsMap.values()).sort((a, b) => b.lastActivity - a.lastActivity);

    // Apply limit to sessions and prepare response
    const sessions = allSessions.slice(0, limit);
    const hasMore = allSessions.length > limit || !!response.LastEvaluatedKey;

    // Create cursor for next page if there are more results
    let nextCursor: string | undefined;
    if (hasMore && response.LastEvaluatedKey) {
      nextCursor = btoa(JSON.stringify(response.LastEvaluatedKey));
    }

    console.log(`✅ Found ${sessions.length} chat sessions (total scanned: ${allSessions.length})`);

    const responseData: any = {
      sessions,
      pagination: {
        limit,
        hasMore,
        total: allSessions.length
      }
    };

    if (nextCursor) {
      responseData.pagination.nextCursor = nextCursor;
    }

    res.json(responseData);

  } catch (error) {
    console.error("❌ Error fetching chat sessions:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch chat sessions"
    });
  }
});

// REST endpoint to get chat history for a specific session
router.get("/chats/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`📖 Fetching chat history for session: ${sessionId}`);

    // Create a new chat history instance for the session
    const chatHistory = new DynamoDBChatMessageHistory({
      tableName: dynamodbChatsTable,
      partitionKey: "SessionId",
      sessionId: sessionId,
      config: {
        region: awsRegion,
      },
    });

    // Get messages for the session
    let messages: BaseMessage[] = [];
    try {
      messages = await chatHistory.getMessages();
      console.log(`✅ Retrieved ${messages.length} messages for session ${sessionId}`);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('Requested resource not found')) {
        console.log(`ℹ️ Session ${sessionId} not found or has no messages`);
        // Return empty array for non-existent sessions
        messages = [];
      } else {
        throw error;
      }
    }

    // Format messages for response
    const formattedMessages = messages.map(msg => ({
      type: msg._getType(),
      content: msg.content,
      timestamp: msg.additional_kwargs?.timestamp || null,
    }));

    res.json({
      sessionId,
      messages: formattedMessages,
      totalMessages: formattedMessages.length
    });

  } catch (error) {
    console.error(`❌ Error fetching chat history for session ${req.params.sessionId}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch chat history"
    });
  }
});

// Function to setup WebSocket routes on the main app
export const setupWebSocketRoutes = (app: Application & { ws: (path: string, handler: (ws: WebSocket, req: Request) => void) => void }) => {


  // WebSocket endpoint for v3 with LangChain + DynamoDB
  app.ws("/ws/query", (ws: WebSocket, _req: Request) => {
    console.log("WebSocket v3 connection opened");

    // Track active stream to allow cancellation
    let isRequestCancelled = false;
    let activeStreamController: AbortController | null = null;

    ws.on("message", async (message: string) => {
      const startTime = Date.now();
      try {
        const data = JSON.parse(message);

        // Handle cancellation request
        if (data.type === 'cancel') {
          console.log(`🛑 [v3] Cancellation request received for session: ${data.sessionId}`);
          isRequestCancelled = true;

          // Abort any active stream
          if (activeStreamController) {
            activeStreamController.abort();
          }

          // Send cancellation confirmation to client
          ws.send(JSON.stringify({
            type: "cancelled",
            message: "Request cancelled successfully"
          }));

          return;
        }

        // Regular query handling
        const { sessionId, query } = data;
        console.log(`\n🚀 [v3] Starting request at ${new Date().toISOString()}`);
        console.log(`📝 [v3] Query: "${query}" | Session: ${sessionId}`);

        // Reset cancellation state for new requests
        isRequestCancelled = false;
        activeStreamController = new AbortController();


        if (!query) {
          ws.send(JSON.stringify({
            error: "Query is required",
          }));
          return;
        }

        if (!sessionId) {
          ws.send(JSON.stringify({
            error: "SessionId is required for v3 endpoint",
          }));
          return;
        }

        // Initialize DynamoDB chat history
        const initStartTime = Date.now();
        console.log(`⚡ [v3] Initializing components...`);

        const chatHistory = new DynamoDBChatMessageHistory({
          tableName: dynamodbChatsTable,
          partitionKey: "id",
          sessionId,
          config: {
            region: awsRegion
          },
        });

        // Initialize ChatBedrockConverse without streaming to avoid HTTP/2 conflicts
        const llm = new ChatBedrockConverse({
          model: bedrockModelId,
          region: awsRegion,
          streaming: false,
        });

        // Initialize Knowledge Base retriever
        const retriever = new AmazonKnowledgeBaseRetriever({
          topK: 3,
          knowledgeBaseId,
          region: awsRegion,
        });

        // Create history-aware retriever
        const historyAwarePrompt = ChatPromptTemplate.fromMessages([
          new MessagesPlaceholder("chat_history"),
          ["user", "{input}"],
          ["user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"]
        ]);

        const historyAwareRetriever = await createHistoryAwareRetriever({
          llm,
          retriever,
          rephrasePrompt: historyAwarePrompt,
        });

        const initEndTime = Date.now();
        console.log(`✅ [v3] Components initialized in ${initEndTime - initStartTime}ms`);

        // Hybrid approach: Use LangChain for retrieval and memory, Bedrock for streaming
        console.log(`🔍 [v3] Starting retrieval phase...`);
        const retrievalStartTime = Date.now();

        // Step 1: Get chat history and create context-aware query
        let messages: BaseMessage[];
        try {
          messages = await chatHistory.getMessages();
          console.log(`📚 [v3] Retrieved ${messages.length} previous messages from DynamoDB`);
        } catch (error) {
          // If session doesn't exist yet, initialize with empty message history
          if (error instanceof Error && error.message?.includes('Requested resource not found')) {
            console.log(`🆕 [v3] Session ${sessionId} doesn't exist yet, initializing with empty history`);
            messages = [];
          } else {
            // Re-throw if it's a different error
            throw error;
          }
        }

        const historyAwareQuery = await historyAwareRetriever.invoke({
          input: query,
          chat_history: messages
        });

        const retrievalEndTime = Date.now();
        console.log(`✅ [v3] Retrieved ${historyAwareQuery.length} documents in ${retrievalEndTime - retrievalStartTime}ms`);

        // Step 2: Format context from retrieved documents with truncation
        const maxContextLength = 12000;
        const maxHistoryLength = 3000;

        let context = historyAwareQuery.map((doc: Document<Record<string, unknown>>) => doc.pageContent).join("\n\n");
        if (context.length > maxContextLength) {
          context = context.substring(0, maxContextLength) + "...[truncated]";
        }

        // Step 3: Create prompt with truncated context and history
        let conversationHistory = messages.slice(-5).map(msg => `${msg._getType()}: ${msg.content}`).join("\n");
        if (conversationHistory.length > maxHistoryLength) {
          conversationHistory = conversationHistory.substring(0, maxHistoryLength) + "...[truncated]";
        }

        const systemPrompt = `You are a healthcare commercial intelligence assistant for Starfire, an AI-native intelligence platform that democratizes data analytics for life sciences teams. Your role is to help users answer business-relevant questions based on their healthcare datasets.

When answering questions:
- Focus on business-relevant insights that help life sciences teams make informed decisions
- Provide actionable intelligence based on the available data
- Use clear, professional language appropriate for healthcare commercial teams
- When possible, highlight trends, patterns, or notable findings in the data
- If data is insufficient for a complete answer, clearly state what additional information would be helpful`;

        const fullPrompt = `${systemPrompt}

Previous conversation:
${conversationHistory}

Context from knowledge base:
${context}

User question: ${query}`;

        const promptEndTime = Date.now();
        console.log(`📝 [v3] Prompt built (${fullPrompt.length} chars) in ${promptEndTime - retrievalEndTime}ms`);

        // Step 4: Use direct Bedrock streaming for response
        console.log(`🚀 [v3] Starting Bedrock streaming...`);
        const streamStartTime = Date.now();

        const command = new RetrieveAndGenerateStreamCommand({
          input: {
            text: fullPrompt,
          },
          retrieveAndGenerateConfiguration: {
            type: "KNOWLEDGE_BASE",
            knowledgeBaseConfiguration: {
              knowledgeBaseId,
              modelArn: `arn:aws:bedrock:${awsRegion}::foundation-model/${bedrockModelId}`,
            },
          },
        });

        const response = await (bedrockClient as unknown as { send: (cmd: RetrieveAndGenerateStreamCommand) => Promise<{ stream?: AsyncIterable<unknown> }> }).send(command);

        const bedrockResponseTime = Date.now();
        console.log(`✅ [v3] Bedrock response received in ${bedrockResponseTime - streamStartTime}ms`);

        let fullAnswer = "";
        let tokenCount = 0;
        let firstTokenTime: number | null = null;

        if (response.stream) {
          console.log(`📡 [v3] Processing stream events...`);
          try {
            for await (const event of response.stream) {
              // Check for cancellation between chunks
              if (isRequestCancelled) {
                console.log(`🛑 [v3] Request cancelled during streaming for session: ${sessionId}`);
                break;
              }

              const eventData = event as { output?: { text?: string } };

              if (eventData.output?.text) {
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                  console.log(`🔥 [v3] First token received after ${firstTokenTime - streamStartTime}ms`);
                }

                const token = eventData.output.text;
                fullAnswer += token;
                tokenCount++;

                // Send chunk via WebSocket
                ws.send(JSON.stringify({
                  type: "chunk",
                  data: token
                }));
              }
            }

            // Only save to history and send completion if not cancelled
            if (!isRequestCancelled) {
              const streamEndTime = Date.now();
              console.log(`✅ [v3] Streaming complete: ${tokenCount} tokens in ${streamEndTime - (firstTokenTime || streamStartTime)}ms`);

              // Step 5: Save conversation to chat history
              console.log(`💾 [v3] Saving to DynamoDB...`);
              const saveStartTime = Date.now();

              await chatHistory.addUserMessage(query);
              await chatHistory.addAIMessage(fullAnswer);

              const saveEndTime = Date.now();
              console.log(`✅ [v3] Saved to DynamoDB in ${saveEndTime - saveStartTime}ms`);

              // Step 6: Send completion with sources via WebSocket
              ws.send(JSON.stringify({
                type: "done",
                sources: historyAwareQuery.map((doc: Document<Record<string, unknown>>) => ({
                  content: doc.pageContent,
                  metadata: doc.metadata,
                }))
              }));

              const totalEndTime = Date.now();
              const totalTime = totalEndTime - startTime;

              console.log(`🏁 [v3] Request completed in ${totalTime}ms`);
              console.log(`📊 [v3] Performance breakdown:`);
              console.log(`   • Initialization: ${initEndTime - initStartTime}ms`);
              console.log(`   • Retrieval: ${retrievalEndTime - retrievalStartTime}ms`);
              console.log(`   • Prompt building: ${promptEndTime - retrievalEndTime}ms`);
              console.log(`   • Bedrock response: ${bedrockResponseTime - streamStartTime}ms`);
              console.log(`   • First token: ${(firstTokenTime || streamStartTime) - streamStartTime}ms`);
              console.log(`   • Streaming: ${streamEndTime - (firstTokenTime || streamStartTime)}ms`);
              console.log(`   • DynamoDB save: ${saveEndTime - saveStartTime}ms`);
              console.log(`   • Total tokens: ${tokenCount}`);
              console.log(`   • Tokens/sec: ${tokenCount > 0 && firstTokenTime ? (tokenCount / ((streamEndTime - firstTokenTime) / 1000)).toFixed(2) : 'N/A'}`);
            } else {
              console.log(`🛑 [v3] Request cancelled - skipping history save and completion`);
            }
          } catch (streamError) {
            // Check if this was caused by our cancellation
            if (isRequestCancelled) {
              console.log(`🛑 [v3] Stream processing stopped due to cancellation`);
            } else {
              console.error(`❌ [v3] Stream processing error:`, streamError);
              throw streamError;
            }
          } finally {
            // Clean up
            activeStreamController = null;
          }
        }
      } catch (error: unknown) {
        const errorTime = Date.now();
        const totalErrorTime = errorTime - startTime;
        console.error(`❌ [v3] Error after ${totalErrorTime}ms:`, error);
        ws.send(JSON.stringify({
          error: error instanceof Error ? error.message : "An error occurred",
        }));
      }
    });

    ws.on("close", () => {
      console.log("WebSocket v3 connection closed");
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket v3 error:", error);
    });
  });

};

export default router;