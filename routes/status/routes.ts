import { Router, Request, Response } from "express";

const router = Router();

// API status endpoint
router.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: Deno.env.get("NODE_ENV") || "dev",
  });
});

export default router;