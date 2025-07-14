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

import { Document } from "@langchain/core/documents";

const router = Router();

// Initialize Bedrock client
const bedrockClient = new BedrockAgentRuntimeClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});



// Function to setup WebSocket routes on the main app
export const setupWebSocketRoutes = (app: Application & { ws: (path: string, handler: (ws: WebSocket, req: Request) => void) => void }) => {


  // WebSocket endpoint for v3 with LangChain + DynamoDB (no Ably)
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
          tableName: Deno.env.get("DYNAMODB_TABLE_NAME") || "langchain",
          partitionKey: "id",
          sessionId,
          config: {
            region: Deno.env.get("AWS_REGION") || "us-east-1"
          },
        });

        // Initialize ChatBedrockConverse without streaming to avoid HTTP/2 conflicts
        const llm = new ChatBedrockConverse({
          model: Deno.env.get("BEDROCK_MODEL_ID") || "anthropic.claude-3-5-sonnet-20240620-v1:0",
          region: Deno.env.get("AWS_REGION") || "us-east-1",
          streaming: false,
        });

        // Initialize Knowledge Base retriever
        const retriever = new AmazonKnowledgeBaseRetriever({
          topK: 3,
          knowledgeBaseId: Deno.env.get("STRANDS_KNOWLEDGE_BASE_ID") || "",
          region: Deno.env.get("AWS_REGION") || "us-east-1",
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
        const messages = await chatHistory.getMessages();
        console.log(`📚 [v3] Retrieved ${messages.length} previous messages from DynamoDB`);

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
              knowledgeBaseId: Deno.env.get("STRANDS_KNOWLEDGE_BASE_ID"),
              modelArn: `arn:aws:bedrock:${Deno.env.get("AWS_REGION")}::foundation-model/${Deno.env.get("BEDROCK_MODEL_ID")}`,
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