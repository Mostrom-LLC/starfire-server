import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import expressWs from 'express-ws';
import cors from 'cors';
import morgan from 'morgan';
import { apiReference } from "@scalar/express-api-reference";
import bedrockRouter, { setupWebSocketRoutes } from "./routes/bedrock/routes.ts";
import { bedrockApiSpec } from "./routes/bedrock/api.ts";
import healthRouter from "./routes/health/routes.ts";
import { healthApiSpec } from "./routes/health/api.ts";
import statusRouter from "./routes/status/routes.ts";
import { statusApiSpec } from "./routes/status/api.ts";
import ingestionRouter from "./routes/ingestion/routes.ts";
import { ingestionApiSpec } from "./routes/ingestion/api.ts";
import visualizationRouter from "./routes/visualization/routes.ts";
import { visualizationApiSpec } from "./routes/visualization/api.ts";

// Load environment variables
dotenv.config();

// Initialize Express app with WebSocket support
const { app } = expressWs(express());
const PORT = parseInt(Deno.env.get("PORT") || "8000");
const HOST_HEADER = Deno.env.get("HOST_HEADER") || "localhost";


// Configure CORS middleware
const allowedOrigins = [
  `${HOST_HEADER}`,
  Deno.env.get("VITE_BASE_URL")
].filter(Boolean);

console.log("Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin) return callback(null, true);

      // Allow file:// protocol for local HTML testing
      if (origin.startsWith('file://')) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static('.'));

// Configure middleware
app.use(morgan("dev", {
  skip: (req: Request, res: Response) => {
    if (req.url === "/healthcheck") return true;
    return res.statusCode < 400;
  }
}));

// Define routes
app.get("/", (_req: Request, res: Response) => {
  // Ensure we return a 200 status code for AWS health checks
  res.status(200).json({
    status: "healthy",
    message: "Knowledge Base API is running",
    documentation: "/api-docs",
    endpoints: {
      "websocket-v1": "ws://localhost:8000/ws/query (LangChain + DynamoDB + WebSocket streaming)",
      "ingestion": "POST /api/ingest (File upload, analysis & storage), GET /api/ingest (List files)",
      "visualization": "POST /api/visualize (Generate chart data and insights), GET /api/visualize/topics (Get available topics)"
    }
  });
});

// Mount routers
app.use(healthRouter);
app.use(statusRouter);
app.use(bedrockRouter);
app.use(ingestionRouter);
app.use(visualizationRouter);

// Setup WebSocket routes
setupWebSocketRoutes(app);


// OpenAPI configuration
const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Knowledge Base API",
    version: "1.0.0",
    description: "A simple Knowledge Base API built with Deno and Express for AWS Bedrock integration",
  },
  servers:
  {
    url: HOST_HEADER,
    description: "Local Dev Server",
  },
  tags: [
    {
      name: "Health",
      description: "Health check endpoints",
    },
    {
      name: "Status",
      description: "API status endpoints",
    },
    {
      name: "Bedrock",
      description: "AWS Bedrock knowledge base endpoints",
    },
    {
      name: "Ingestion",
      description: "File upload and analysis endpoints",
    },
    {
      name: "Visualization",
      description: "Data visualization and insights endpoints",
    },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        name: "api-key",
        in: "header",
        description: "API key for authentication. Use 'api-key' header or 'Authorization: APIKey <key>' format.",
        "x-displayName": "API Key"
      }
    }
  },
  paths: {
    ...healthApiSpec,
    ...statusApiSpec,
    ...bedrockApiSpec,
    ...ingestionApiSpec,
    ...visualizationApiSpec,
  }
};

// Serve OpenAPI spec
app.get("/api-docs/json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Scalar API documentation
app.use(
  "/api-docs",
  apiReference({
    spec: {
      url: "/api-docs/json",
    },
    theme: "default",
    layout: "classic",
  })
);

// Error handling middleware
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Add shutdown handlers for better process management
const shutdown = () => {
  console.log("\n🔴 Shutting down server...");
  Deno.exit(0);
};

// Handle different termination signals
Deno.addSignalListener("SIGINT", shutdown);   // Ctrl+C
Deno.addSignalListener("SIGTERM", shutdown);  // Termination signal

// Handle unhandled rejections
globalThis.addEventListener("unhandledrejection", (e) => {
  console.error("❌ Unhandled promise rejection:", e.reason);
  e.preventDefault();
});

// Handle uncaught exceptions
globalThis.addEventListener("error", (e) => {
  console.error("❌ Uncaught exception:", e.error);
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${HOST_HEADER}`);
  console.log(`📚 API Documentation: ${HOST_HEADER}/api-docs`);
  console.log(`🔌 WebSocket v3: ws://${HOST_HEADER}/ws/query`);
});