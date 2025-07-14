import type { OpenAPIPath } from "../../lib/types.ts";

export const bedrockApiSpec: OpenAPIPath = {
  "/ws/query": {
    get: {
      tags: ["Bedrock"],
      summary: "WebSocket endpoint for conversational knowledge base queries (v3)",
      description: "Enhanced WebSocket endpoint that combines LangChain conversational memory with DynamoDB and real-time streaming from AWS Bedrock knowledge base. Supports session-based conversations with context awareness and source attribution.",
      parameters: [
        {
          name: "Upgrade",
          in: "header",
          required: true,
          schema: {
            type: "string",
            enum: ["websocket"]
          },
          description: "Must be 'websocket' to upgrade the connection"
        },
        {
          name: "Connection",
          in: "header",
          required: true,
          schema: {
            type: "string",
            enum: ["Upgrade"]
          },
          description: "Must be 'Upgrade' for WebSocket handshake"
        }
      ],
      responses: {
        "101": {
          description: "Switching Protocols - WebSocket connection established. Send JSON messages with sessionId and query fields.",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["chunk"]
                      },
                      data: {
                        type: "string",
                        description: "Text chunk from the streaming response"
                      }
                    },
                    required: ["type", "data"]
                  },
                  {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["done"]
                      },
                      sources: {
                        type: "array",
                        description: "Source documents used to generate the response",
                        items: {
                          type: "object",
                          properties: {
                            content: {
                              type: "string",
                              description: "Document content"
                            },
                            metadata: {
                              type: "object",
                              description: "Document metadata including source information"
                            }
                          }
                        }
                      }
                    },
                    required: ["type", "sources"]
                  },
                  {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        description: "Error message if query fails"
                      }
                    },
                    required: ["error"]
                  }
                ]
              },
              examples: {
                "message-format": {
                  summary: "Required message format",
                  value: {
                    sessionId: "user-session-123",
                    query: "What are the latest drug utilization trends?"
                  }
                },
                "streaming-chunk": {
                  summary: "Streaming text chunk",
                  value: {
                    type: "chunk",
                    data: "Based on the provided search results,"
                  }
                },
                "completion-with-sources": {
                  summary: "Completion with source documents",
                  value: {
                    type: "done",
                    sources: [
                      {
                        content: "Drug utilization data shows...",
                        metadata: {
                          source: "s3://bucket/document.pdf",
                          page: 1
                        }
                      }
                    ]
                  }
                },
                "error-response": {
                  summary: "Error response",
                  value: {
                    error: "SessionId is required for v3 endpoint"
                  }
                }
              }
            }
          }
        },
        "400": {
          description: "Bad Request - Invalid WebSocket handshake"
        }
      }
    }
  }
};