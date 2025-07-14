import type { OpenAPIPath } from "../../lib/types.ts";

export const ingestionApiSpec: OpenAPIPath = {
  "/api/ingest": {
    get: {
      tags: ["Ingestion"],
      summary: "Get paginated list of ingested files",
      description: "Retrieves a paginated list of all files that have been uploaded and analyzed. Results are sorted by upload timestamp (newest first). Simple pagination is supported using limit and skip parameters.",
      security: [{ apiKey: [] }],
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
          name: "pageCount",
          in: "query",
          description: "Number of items to return (max 100, default 20)",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        {
          name: "page",
          in: "query",
          description: "Page number for pagination (1-based). Start with page=1 for the first page.",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          }
        }
      ],
      responses: {
        "200": {
          description: "Successfully retrieved file list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "3e3bc54d-6d62-4f37-89ae-d1e89722d759" },
                        version: { type: "string", example: "1" },
                        name: { type: "string", example: "MUP_DPR_RY22_20220715_DD_PRV_Drug.pdf" },
                        type: { type: "string", example: "PDF Report" },
                        size: { type: "number", example: 131517 },
                        summary: { type: "string", example: "Contains Medicare drug price regulation metrics with utilization analysis and cost trends." },
                        key_topics: { type: "array", items: { type: "string" }, example: ["Drug Prices", "Price Regulation"] },
                        data_classification: { type: "string", example: "Healthcare Data" },
                        upload_timestamp: { type: "string", format: "date-time", example: "2025-07-10T09:55:59.955Z" },
                        s3_key: { type: "string", example: "uploads/2025-07-10/3e3bc54d-filename.pdf" },
                        s3_bucket: { type: "string", example: "dev-starfire-rag-agent" },
                        content_type: { type: "string", example: "application/pdf" },
                        last_modified: { type: "string", format: "date-time", example: "2025-07-10T09:55:59.955Z" }
                      }
                    }
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      page: { type: "number", example: 1 },
                      pageCount: { type: "number", example: 3 },
                      hasMore: { type: "boolean", example: true },
                      totalPages: { type: "number", example: 3 }
                    },
                    required: ["page", "pageCount", "hasMore", "totalPages"]
                  }
                },
                required: ["data", "pagination"]
              },
              examples: {
                "paginated-response": {
                  summary: "Paginated file list",
                  value: {
                    data: [
                      {
                        id: "3e3bc54d-6d62-4f37-89ae-d1e89722d759",
                        version: "1",
                        name: "MUP_DPR_RY22_20220715_DD_PRV_Drug.pdf",
                        type: "PDF Report",
                        size: 131517,
                        summary: "Contains Medicare Utilization and Payment (MUP) drug price regulation data for Canadian provinces with detailed cost analysis and utilization metrics for the 2022 reporting year.",
                        key_topics: ["Drug Prices", "Price Regulation", "Healthcare Metrics"],
                        data_classification: "Healthcare Data",
                        upload_timestamp: "2025-07-10T09:55:59.955Z",
                        s3_key: "uploads/2025-07-10/3e3bc54d-6d62-4f37-89ae-d1e89722d759-MUP_DPR_RY22_20220715_DD_PRV_Drug.pdf",
                        s3_bucket: "dev-starfire-rag-agent",
                        content_type: "application/pdf",
                        last_modified: "2025-07-10T09:55:59.955Z"
                      }
                    ],
                    pagination: {
                      page: 1,
                      pageCount: 3,
                      hasMore: true,
                      totalPages: 3
                    }
                  }
                }
              }
            }
          }
        },
        "401": {
          description: "Unauthorized - Invalid or missing API key",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "Error" },
                  message: { type: "string", example: "APIKey invalid or not present" }
                },
                required: ["status", "message"]
              }
            }
          }
        },
        "400": {
          description: "Bad request - invalid parameters",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  timestamp: { type: "string", format: "date-time" }
                },
                required: ["error", "timestamp"]
              },
              examples: {
                "invalid-pagination": {
                  summary: "Invalid pagination token",
                  value: {
                    error: "Invalid lastKey parameter",
                    timestamp: "2025-07-10T09:55:59.955Z"
                  }
                }
              }
            }
          }
        },
        "500": {
          description: "Server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  timestamp: { type: "string", format: "date-time" }
                },
                required: ["error", "timestamp"]
              },
              examples: {
                "database-error": {
                  summary: "Database connection error",
                  value: {
                    error: "Failed to fetch file list",
                    timestamp: "2025-07-10T09:55:59.955Z"
                  }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ["Ingestion"],
      summary: "Upload and analyze files",
      description: "Uploads one or more files to S3, analyzes them using AI, and stores structured metadata in DynamoDB. Returns comprehensive file analysis including content summary and classification for each file. Supports batch processing with partial failure handling.",
      security: [{ apiKey: [] }],
      parameters: [
        {
          name: "api-key",
          in: "header",
          description: "API key for authentication",
          required: true,
          schema: {
            type: "string"
          }
        }
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                files: {
                  type: "array",
                  items: {
                    type: "string",
                    format: "binary"
                  },
                  description: "One or more files to upload and analyze (max 1GB each)"
                }
              },
              required: ["files"]
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Files successfully uploaded and analyzed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  files: {
                    type: "array",
                    description: "Array of successfully processed files",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Unique identifier for the uploaded file",
                          example: "550e8400-e29b-41d4-a716-446655440000"
                        },
                        version: {
                          type: "string",
                          description: "File version for tracking changes",
                          example: "1"
                        },
                        name: {
                          type: "string",
                          description: "Original filename",
                          example: "quarterly_report.pdf"
                        },
                        type: {
                          type: "string",
                          description: "Document classification type",
                          example: "PDF Report"
                        },
                        size: {
                          type: "number",
                          description: "File size in bytes",
                          example: 2048576
                        },
                        summary: {
                          type: "string",
                          description: "1-2 sentence summary of file content",
                          example: "A quarterly financial report containing revenue analysis and market trends. Includes detailed breakdowns of performance metrics across different business units."
                        },
                        key_topics: {
                          type: "array",
                          items: {
                            type: "string"
                          },
                          description: "Key topics identified in the file",
                          example: ["financial analysis", "quarterly results", "market trends"]
                        },
                        data_classification: {
                          type: "string",
                          description: "Data classification category",
                          example: "Financial Report"
                        },
                        upload_timestamp: {
                          type: "string",
                          format: "date-time",
                          description: "ISO timestamp of upload",
                          example: "2024-01-15T10:30:00.000Z"
                        },
                        s3_key: {
                          type: "string",
                          description: "S3 object key for the uploaded file",
                          example: "uploads/2024-01-15/550e8400-e29b-41d4-a716-446655440000-quarterly_report.pdf"
                        },
                        s3_bucket: {
                          type: "string",
                          description: "S3 bucket name",
                          example: "dev-starfire-rag-agent"
                        }
                      },
                      required: ["id", "version", "name", "type", "size", "summary", "key_topics", "data_classification", "upload_timestamp", "s3_key", "s3_bucket"]
                    }
                  },
                  summary: {
                    type: "object",
                    description: "Processing summary statistics",
                    properties: {
                      total: {
                        type: "number",
                        description: "Total number of files submitted",
                        example: 2
                      },
                      successful: {
                        type: "number",
                        description: "Number of files successfully processed",
                        example: 2
                      },
                      failed: {
                        type: "number",
                        description: "Number of files that failed processing",
                        example: 0
                      }
                    },
                    required: ["total", "successful", "failed"]
                  },
                  errors: {
                    type: "array",
                    description: "Array of error messages for failed files (only present if any files failed)",
                    items: {
                      type: "string"
                    },
                    example: ["file1.pdf: S3 upload failed", "file2.docx: Invalid file format"]
                  }
                },
                required: ["files", "summary"]
              },
              examples: {
                "single-file-success": {
                  summary: "Single file upload success",
                  value: {
                    files: [
                      {
                        id: "550e8400-e29b-41d4-a716-446655440000",
                        version: "1",
                        name: "drug_utilization_report.pdf",
                        type: "PDF Report",
                        size: 3145728,
                        summary: "Healthcare drug utilization analysis covering prescription patterns and cost trends. Contains detailed statistical breakdowns by therapeutic categories and geographic regions.",
                        key_topics: ["drug utilization", "prescription patterns", "healthcare analytics", "cost analysis"],
                        data_classification: "Healthcare Data",
                        upload_timestamp: "2024-01-15T10:30:00.000Z",
                        s3_key: "uploads/2024-01-15/550e8400-e29b-41d4-a716-446655440000-drug_utilization_report.pdf",
                        s3_bucket: "dev-starfire-rag-agent"
                      }
                    ],
                    summary: {
                      total: 1,
                      successful: 1,
                      failed: 0
                    }
                  }
                },
                "multiple-files-success": {
                  summary: "Multiple files upload success",
                  value: {
                    files: [
                      {
                        id: "550e8400-e29b-41d4-a716-446655440000",
                        version: "1",
                        name: "drug_utilization_report.pdf",
                        type: "PDF Report",
                        size: 3145728,
                        summary: "Healthcare drug utilization analysis covering prescription patterns and cost trends. Contains detailed statistical breakdowns by therapeutic categories and geographic regions.",
                        key_topics: ["drug utilization", "prescription patterns", "healthcare analytics", "cost analysis"],
                        data_classification: "Healthcare Data",
                        upload_timestamp: "2024-01-15T10:30:00.000Z",
                        s3_key: "uploads/2024-01-15/550e8400-e29b-41d4-a716-446655440000-drug_utilization_report.pdf",
                        s3_bucket: "dev-starfire-rag-agent"
                      },
                      {
                        id: "550e8400-e29b-41d4-a716-446655440001",
                        version: "1",
                        name: "patient_data.xlsx",
                        type: "Excel Spreadsheet",
                        size: 1048576,
                        summary: "Patient demographics and treatment outcome data spreadsheet. Includes anonymized patient records with treatment efficacy metrics.",
                        key_topics: ["patient data", "treatment outcomes", "demographics", "clinical metrics"],
                        data_classification: "Healthcare Data",
                        upload_timestamp: "2024-01-15T11:15:00.000Z",
                        s3_key: "uploads/2024-01-15/550e8400-e29b-41d4-a716-446655440001-patient_data.xlsx",
                        s3_bucket: "dev-starfire-rag-agent"
                      }
                    ],
                    summary: {
                      total: 2,
                      successful: 2,
                      failed: 0
                    }
                  }
                },
                "partial-failure": {
                  summary: "Partial success with some failed files",
                  value: {
                    files: [
                      {
                        id: "550e8400-e29b-41d4-a716-446655440000",
                        version: "1",
                        name: "drug_utilization_report.pdf",
                        type: "PDF Report",
                        size: 3145728,
                        summary: "Healthcare drug utilization analysis covering prescription patterns and cost trends. Contains detailed statistical breakdowns by therapeutic categories and geographic regions.",
                        key_topics: ["drug utilization", "prescription patterns", "healthcare analytics", "cost analysis"],
                        data_classification: "Healthcare Data",
                        upload_timestamp: "2024-01-15T10:30:00.000Z",
                        s3_key: "uploads/2024-01-15/550e8400-e29b-41d4-a716-446655440000-drug_utilization_report.pdf",
                        s3_bucket: "dev-starfire-rag-agent"
                      }
                    ],
                    summary: {
                      total: 2,
                      successful: 1,
                      failed: 1
                    },
                    errors: [
                      "corrupted_file.pdf: S3 upload failed - file corrupted"
                    ]
                  }
                }
              }
            }
          }
        },
        "401": {
          description: "Unauthorized - Invalid or missing API key",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "Error" },
                  message: { type: "string", example: "APIKey invalid or not present" }
                },
                required: ["status", "message"]
              }
            }
          }
        },
        "400": {
          description: "Bad request - no file provided or invalid file",
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
              },
              examples: {
                "no-file": {
                  summary: "No file provided",
                  value: {
                    error: "No file provided"
                  }
                },
                "file-too-large": {
                  summary: "File size exceeds limit",
                  value: {
                    error: "File size exceeds 1GB limit"
                  }
                }
              }
            }
          }
        },
        "500": {
          description: "Server error during file processing",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    description: "Error message"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    description: "Error timestamp"
                  }
                },
                required: ["error", "timestamp"]
              },
              examples: {
                "s3-error": {
                  summary: "S3 upload failed",
                  value: {
                    error: "Failed to upload file to S3",
                    timestamp: "2024-01-15T10:30:00.000Z"
                  }
                },
                "analysis-error": {
                  summary: "LLM analysis failed",
                  value: {
                    error: "File analysis failed",
                    timestamp: "2024-01-15T10:30:00.000Z"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};