// Test script to verify Scalar dependencies
import { apiReference } from "@scalar/express-api-reference";
import express from 'express';

// Create a simple Express app
const app = express();

// Try to use the Scalar API Reference
const scalarMiddleware = apiReference({
  url: "/api-docs/json",
  theme: "default",
  layout: "classic",
});

console.log("✅ Successfully imported @scalar/express-api-reference");
console.log("✅ Successfully created Scalar middleware");
console.log("All Scalar dependencies are working correctly!");

// Exit
Deno.exit(0);
