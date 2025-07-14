import { Request, Response, NextFunction } from "express";

/**
 * Middleware to check for API KEY in the request headers
 */
export const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
    const APIKEY = Deno.env.get("APIKEY"); // Your API Key from environment variables


    const apiKeyHeader = req.headers["api-key"] as string | undefined;
    const authHeader = req.headers.authorization ?? "";


    const extractedKey = authHeader.startsWith("APIKey ")
        ? authHeader.split(" ")[1]
        : apiKeyHeader;

    if (APIKEY !== extractedKey) {
        return res.status(401).json({ status: "Error", message: "APIKey invalid or not present" });
    }


    next();
};
