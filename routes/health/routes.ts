import { Router, Request, Response } from "express";

const router = Router();

// Health check endpoint
router.get("/healthcheck", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    uptime: performance.now() / 1000, // Deno equivalent of process.uptime()
    timestamp: new Date().toISOString(),
  });
});

// AWS ECS health check endpoint - minimal overhead
router.get("/health", (_req: Request, res: Response) => {
  // Simple 200 OK response for AWS health checks
  res.status(200).send("OK");
});

export default router;