import type { OpenAPIPath } from "../../lib/types.ts";

export const visualizationApiSpec: OpenAPIPath = {
  "/api/visualize": {
    get: {
      tags: ["Visualization"],
      summary: "List all visualization sets",
      description: "Returns a list of all generated visualization sets",
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
      responses: {
        "200": {
          description: "Successful retrieval of visualization sets",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  visualizationSets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Unique identifier for the visualization set"
                        },
                        title: {
                          type: "string",
                          description: "Title of the visualization set"
                        },
                        summary: {
                          type: "string",
                          description: "Summary of the visualization set findings"
                        },
                        createdAt: {
                          type: "string",
                          format: "date-time",
                          description: "When the visualization set was created"
                        },
                        metadata: {
                          type: "object",
                          description: "Metadata about the visualization set"
                        }
                      }
                    }
                  },
                  count: {
                    type: "number",
                    description: "Total number of visualization sets"
                  }
                }
              }
            }
          }
        },
        "401": {
          description: "Unauthorized - Invalid API key",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string"
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
                  error: {
                    type: "string"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/visualize/generate": {
    post: {
      tags: ["Visualization"],
      summary: "Generate multiple visualizations from knowledge base data",
      description: "Automatically analyzes data from the knowledge base and generates multiple chart visualizations",
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
      responses: {
        "200": {
          description: "Successful visualization generation",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  visualizationSetId: {
                    type: "string"
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
                  error: {
                    type: "string"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/visualize/{id}/pdf": {
    post: {
      tags: ["Visualization"],
      summary: "Generate multi-page PDF report from visualization set",
      description: "Takes an existing visualization ID and generates a comprehensive multi-page PDF report containing ALL charts from the visualization set, saves it to S3, and returns a pre-signed download URL",
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
          name: "id",
          in: "path",
          description: "ID of the visualization set containing the charts",
          required: true,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "PDF generated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    description: "Success status"
                  },
                  visualizationTitle: {
                    type: "string",
                    description: "Title of the visualization set that was converted to PDF"
                  },
                  totalCharts: {
                    type: "number",
                    description: "Total number of charts included in the multi-page PDF"
                  },
                  visualizationId: {
                    type: "string",
                    description: "ID of the source visualization set"
                  },
                  downloadUrl: {
                    type: "string",
                    format: "uri",
                    description: "Pre-signed S3 URL to download the PDF"
                  },
                  pdfUrl: {
                    type: "string",
                    format: "uri",
                    description: "Direct link to the generated PDF file"
                  },
                  s3Key: {
                    type: "string",
                    description: "S3 key for the generated PDF file"
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    description: "When the PDF was generated"
                  },
                  metadata: {
                    type: "object",
                    properties: {
                      processingTime: {
                        type: "number",
                        description: "Time taken to generate PDF in milliseconds"
                      },
                      fileSize: {
                        type: "number",
                        description: "Size of the generated PDF in bytes"
                      },
                      format: {
                        type: "string",
                        description: "File format (PDF)"
                      },
                      chartsIncluded: {
                        type: "number",
                        description: "Number of charts included in the multi-page report"
                      },
                      reportType: {
                        type: "string",
                        description: "Type of PDF report generated"
                      }
                    }
                  }
                },
                required: ["success", "visualizationTitle", "totalCharts", "downloadUrl", "pdfUrl"]
              }
            }
          }
        },
        "400": {
          description: "Bad request - invalid parameters"
        },
        "404": {
          description: "Visualization not found"
        },
        "401": {
          description: "Unauthorized - Invalid API key"
        },
        "500": {
          description: "Server error during PDF generation"
        }
      }
    }
  },
  "/api/visualize/{id}/powerpoint": {
    post: {
      tags: ["Visualization"],
      summary: "Generate PowerPoint presentation from visualization set",
      description: "Takes an existing visualization ID and generates a comprehensive PowerPoint presentation containing ALL charts from the visualization set, saves it to S3, and returns a pre-signed download URL",
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
          name: "id",
          in: "path",
          description: "ID of the visualization set containing the charts",
          required: true,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "PowerPoint presentation generated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    description: "Success status"
                  },
                  visualizationTitle: {
                    type: "string",
                    description: "Title of the visualization set that was converted to PowerPoint"
                  },
                  totalCharts: {
                    type: "number",
                    description: "Total number of charts included in the PowerPoint presentation"
                  },
                  visualizationId: {
                    type: "string",
                    description: "ID of the source visualization set"
                  },
                  downloadUrl: {
                    type: "string",
                    format: "uri",
                    description: "Pre-signed S3 URL to download the PowerPoint file"
                  },
                  pptxUrl: {
                    type: "string",
                    format: "uri",
                    description: "Direct link to the generated PPTX file"
                  },
                  s3Key: {
                    type: "string",
                    description: "S3 key for the generated PowerPoint file"
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    description: "When the PowerPoint was generated"
                  },
                  metadata: {
                    type: "object",
                    properties: {
                      processingTime: {
                        type: "number",
                        description: "Time taken to generate PowerPoint in milliseconds"
                      },
                      fileSize: {
                        type: "number",
                        description: "Size of the generated PowerPoint in bytes"
                      },
                      format: {
                        type: "string",
                        description: "File format (PPTX)"
                      },
                      chartsIncluded: {
                        type: "number",
                        description: "Number of charts included in the presentation"
                      },
                      reportType: {
                        type: "string",
                        description: "Type of PowerPoint presentation generated"
                      }
                    }
                  }
                },
                required: ["success", "visualizationTitle", "totalCharts", "downloadUrl", "pptxUrl"]
              }
            }
          }
        },
        "400": {
          description: "Bad request - invalid parameters"
        },
        "404": {
          description: "Visualization not found"
        },
        "401": {
          description: "Unauthorized - Invalid API key"
        },
        "500": {
          description: "Server error during PowerPoint generation"
        }
      }
    }
  },
  "/api/visualize/{id}": {
    get: {
      tags: ["Visualization"],
      summary: "Get a specific visualization set",
      description: "Returns a specific visualization set by ID",
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
          name: "id",
          in: "path",
          description: "ID of the visualization set to retrieve",
          required: true,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "Successful retrieval of visualization set",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Unique identifier for the visualization set"
                  },
                  title: {
                    type: "string",
                    description: "Title of the visualization set"
                  },
                  description: {
                    type: "string",
                    description: "Description of the visualization set"
                  },
                  summary: {
                    type: "string",
                    description: "Summary of the visualization set findings"
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    description: "When the visualization set was created"
                  },
                  visualizations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Unique identifier for the visualization"
                        },
                        title: {
                          type: "string",
                          description: "Title of the visualization"
                        },
                        description: {
                          type: "string",
                          description: "Description of the visualization"
                        },
                        insights: {
                          type: "array",
                          items: {
                            type: "string"
                          },
                          description: "Key insights from the visualization"
                        },
                        chartType: {
                          type: "string",
                          description: "Type of chart (bar, line, pie, radar, scatter)"
                        },
                        chartData: {
                          type: "object",
                          description: "Data for the chart in a format compatible with shadcn/ui charts"
                        },
                        recommendations: {
                          type: "array",
                          items: {
                            type: "string"
                          },
                          description: "Recommendations based on the visualization"
                        }
                      }
                    },
                    description: "Array of visualizations in this set"
                  },
                  metadata: {
                    type: "object",
                    properties: {
                      documentsAnalyzed: {
                        type: "number",
                        description: "Number of documents analyzed"
                      },
                      filesReferenced: {
                        type: "number",
                        description: "Number of files referenced"
                      },
                      processingTime: {
                        type: "number",
                        description: "Processing time in milliseconds"
                      }
                    },
                    description: "Metadata about the visualization generation process"
                  }
                }
              }
            }
          }
        },
        "404": {
          description: "Visualization set not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string"
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
                  error: {
                    type: "string"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time"
                  }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ["Visualization"],
      summary: "Delete a specific visualization set",
      description: "Deletes a visualization set by ID from the database",
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
          name: "id",
          in: "path",
          description: "ID of the visualization set to delete",
          required: true,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "Visualization set deleted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Visualization set deleted successfully"
                  },
                  id: {
                    type: "string",
                    description: "ID of the deleted visualization set"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    description: "When the deletion occurred"
                  }
                },
                required: ["message", "id", "timestamp"]
              }
            }
          }
        },
        "404": {
          description: "Visualization set not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Visualization set not found"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time"
                  }
                },
                required: ["error", "timestamp"]
              }
            }
          }
        },
        "401": {
          description: "Unauthorized - Invalid API key",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string"
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
                  error: {
                    type: "string"
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
};