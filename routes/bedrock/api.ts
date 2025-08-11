import type { OpenAPIPath } from "../../lib/types.ts";

export const bedrockApiSpec: OpenAPIPath = {
  "/chats": {
    get: {
      tags: ["Bedrock"],
      summary: "Get all chat sessions",
      description: "Retrieves a list of all chat sessions from DynamoDB, including session IDs, last activity timestamps, and message counts. Sessions are sorted by most recent activity.",
      parameters: [
        {
          name: "api-key",
          in: "header",
          description: "API key for authentication",
          required: true,
          schema: {
            type: "string"
          }
        },
        {
          name: "limit",
          in: "query",
          description: "Maximum number of sessions to return (default: 20, max: 100)",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        {
          name: "cursor",
          in: "query",
          description: "Pagination cursor for retrieving the next page of results",
          required: false,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "Successfully retrieved chat sessions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sessions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        sessionId: {
                          type: "string",
                          description: "Unique identifier for the chat session"
                        },
                        lastActivity: {
                          type: "number",
                          description: "Unix timestamp of the last message in the session"
                        },
                        messageCount: {
                          type: "number",
                          description: "Total number of messages in the session"
                        }
                      },
                      required: ["sessionId", "lastActivity", "messageCount"]
                    }
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      limit: {
                        type: "number",
                        description: "Number of sessions requested"
                      },
                      hasMore: {
                        type: "boolean",
                        description: "Whether there are more sessions available"
                      },
                      total: {
                        type: "number",
                        description: "Total number of sessions in current scan"
                      },
                      nextCursor: {
                        type: "string",
                        description: "Cursor for the next page (present only if hasMore is true)"
                      }
                    },
                    required: ["limit", "hasMore", "total"]
                  }
                },
                required: ["sessions", "pagination"]
              },
              examples: {
                "sessions-list": {
                  summary: "List of chat sessions with pagination",
                  value: {
                    sessions: [
                      {
                        sessionId: "session-abc123",
                        lastActivity: 1701234567890,
                        messageCount: 15
                      },
                      {
                        sessionId: "session-xyz789",
                        lastActivity: 1701234567000,
                        messageCount: 8
                      }
                    ],
                    pagination: {
                      limit: 20,
                      hasMore: true,
                      total: 2,
                      nextCursor: "eyJpZCI6InNlc3Npb24teHl6Nzg5In0="
                    }
                  }
                },
                "sessions-last-page": {
                  summary: "Last page of chat sessions",
                  value: {
                    sessions: [
                      {
                        sessionId: "session-def456",
                        lastActivity: 1701234566000,
                        messageCount: 3
                      }
                    ],
                    pagination: {
                      limit: 20,
                      hasMore: false,
                      total: 1
                    }
                  }
                }
              }
            }
          }
        },
        "500": {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    description: "Error message"
                  }
                },
                required: ["error"]
              }
            }
          }
        }
      }
    }
  },
  "/chats/{sessionId}": {
    get: {
      tags: ["Bedrock"],
      summary: "Get chat history for a specific session",
      description: "Retrieves the complete message history for a specific chat session from DynamoDB, including message types, content, and timestamps.",
      parameters: [
        {
          name: "api-key",
          in: "header",
          description: "API key for authentication",
          required: true,
          schema: {
            type: "string"
          }
        },
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: {
            type: "string"
          },
          description: "The unique identifier of the chat session"
        }
      ],
      responses: {
        "200": {
          description: "Successfully retrieved chat history",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sessionId: {
                    type: "string",
                    description: "The session identifier"
                  },
                  messages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["human", "ai"],
                          description: "Type of message (human or AI)"
                        },
                        content: {
                          type: "string",
                          description: "The message content"
                        },
                        timestamp: {
                          type: "number",
                          nullable: true,
                          description: "Unix timestamp when the message was sent"
                        }
                      },
                      required: ["type", "content"]
                    }
                  },
                  totalMessages: {
                    type: "number",
                    description: "Total count of messages in the session"
                  }
                },
                required: ["sessionId", "messages", "totalMessages"]
              },
              examples: {
                "chat-history": {
                  summary: "Chat history with messages",
                  value: {
                    sessionId: "session-abc123",
                    messages: [
                      {
                        type: "human",
                        content: "What are the latest drug utilization trends?",
                        timestamp: 1701234567890
                      },
                      {
                        type: "ai",
                        content: "Based on the latest data, drug utilization shows...",
                        timestamp: 1701234568000
                      }
                    ],
                    totalMessages: 2
                  }
                },
                "empty-session": {
                  summary: "Empty or non-existent session",
                  value: {
                    sessionId: "session-new123",
                    messages: [],
                    totalMessages: 0
                  }
                }
              }
            }
          }
        },
        "500": {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    description: "Error message"
                  }
                },
                required: ["error"]
              }
            }
          }
        }
      }
    }
  },
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