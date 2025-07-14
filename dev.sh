#!/bin/bash

# Kill any existing Deno processes
pkill -f "deno.*main.ts" 2>/dev/null

# Start the dev server
echo "🚀 Starting Deno development server..."
echo "Press Ctrl+C to stop the server"

# Trap SIGINT (Ctrl+C) to clean up
trap 'echo -e "\n🔴 Stopping server..."; pkill -f "deno.*main.ts"; exit 0' INT

# Run the development server
deno task dev

# Cleanup on exit
pkill -f "deno.*main.ts" 2>/dev/null