import type { OpenAPIPath } from "../../lib/types.ts";

export const healthApiSpec: OpenAPIPath = {
  "/healthcheck": {
    get: {
      tags: ["Health"],
      summary: "Health check endpoint",
      description: "Returns health status of the service",
      responses: {
        "200": {
          description: "Service is healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    description: "Health status",
                  },
                  uptime: {
                    type: "number",
                    description: "Service uptime in seconds",
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    description: "Current timestamp",
                  },
                },
                required: ["status", "uptime", "timestamp"],
              },
            },
          },
        },
      },
    },
  },
};