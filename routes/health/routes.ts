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

export default router;