import type { OpenAPIPath } from "../../lib/types.ts";

export const statusApiSpec: OpenAPIPath = {
  "/api/status": {
    get: {
      tags: ["Status"],
      summary: "Get API status",
      description: "Returns the current status of the API",
      responses: {
        "200": {
          description: "API status information",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    description: "API status",
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    description: "Current timestamp",
                  },
                  version: {
                    type: "string",
                    description: "API version",
                  },
                  environment: {
                    type: "string",
                    description: "Current environment",
                  },
                },
                required: ["status", "timestamp", "version"],
              },
            },
          },
        },
      },
    },
  },
};