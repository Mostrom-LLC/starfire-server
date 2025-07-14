# 🦕 Deno Knowledge Base API

A modern, TypeScript-first API built with Deno and Express for querying AWS Bedrock knowledge bases with real-time WebSocket streaming.

## Features

- ⚡ **Deno Runtime** - Modern, secure JavaScript/TypeScript runtime
- 🔥 **Express Framework** - Battle-tested web framework with WebSocket support
- 🌊 **WebSocket Streaming** - Real-time response streaming from AWS Bedrock
- 📚 **Scalar Documentation** - Beautiful, interactive API documentation
- 🔒 **Type Safety** - Full TypeScript support without any types
- 🚀 **AWS Bedrock Integration** - Native streaming support with AWS SDK v3

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) installed
- AWS credentials configured (via environment variables or AWS CLI)
- Access to AWS Bedrock knowledge base

### Environment Variables

Create a `.env` file or set these environment variables:

```env
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
STRANDS_KNOWLEDGE_BASE_ID=your-knowledge-base-id
AWS_REGION=us-east-1
PORT=8000
```

### Running the Server

```bash
# Development mode with auto-reload
deno task dev

# Production mode
deno task start
```

### API Endpoints

- **GET /** - Root endpoint with basic info
- **GET /healthcheck** - Health check endpoint
- **GET /api-docs** - Interactive Scalar API documentation
- **GET /api-docs/json** - OpenAPI specification
- **WS /ws/query** - WebSocket endpoint for streaming queries
- **POST /api/query-v2** - REST endpoint with LangChain + DynamoDB memory + Ably streaming

### WebSocket Usage

Connect to `ws://localhost:8000/ws/query` and send messages in this format:

```json
{
  "query": "What is the capital of France?"
}
```

You'll receive streaming responses in real-time as individual text chunks:

```json
{"type": "chunk", "data": "The"}
{"type": "chunk", "data": " capital"}
{"type": "chunk", "data": " of"}
{"type": "chunk", "data": " France"}
{"type": "chunk", "data": " is"}
{"type": "chunk", "data": " Paris"}
{"type": "chunk", "data": "."}
```

**Important**: The stream is completed when you receive the end signal:

```json
{"type": "end"}
```

**How to detect when streaming is complete:**
- Listen for messages with `type: "end"`
- This indicates the AI has finished generating the response
- No more chunks will be sent after this message
- Your frontend should stop waiting for additional data

### Complete Example Response

For a query like `{"query": "What are geographic regions where drug utilization differs?"}`, you might receive:

```json
{"type": "chunk", "data": "\nBased"}
{"type": "chunk", "data": " on"}
{"type": "chunk", "data": " the"}
{"type": "chunk", "data": " provided"}
{"type": "chunk", "data": " search"}
{"type": "chunk", "data": " results"}
{"type": "chunk", "data": ","}
{"type": "chunk", "data": " I"}
{"type": "chunk", "data": " could"}
{"type": "chunk", "data": " not"}
{"type": "chunk", "data": " find"}
{"type": "chunk", "data": " any"}
{"type": "chunk", "data": " information"}
{"type": "chunk", "data": " to"}
{"type": "chunk", "data": " determine"}
{"type": "chunk", "data": " if"}
{"type": "chunk", "data": " there"}
{"type": "chunk", "data": " are"}
{"type": "chunk", "data": " geographic"}
{"type": "chunk", "data": " regions"}
{"type": "chunk", "data": " where"}
{"type": "chunk", "data": " drug"}
{"type": "chunk", "data": " utilization"}
{"type": "chunk", "data": " significantly"}
{"type": "chunk", "data": " differs"}
{"type": "chunk", "data": " from"}
{"type": "chunk", "data": " the"}
{"type": "chunk", "data": " national"}
{"type": "chunk", "data": " average"}
{"type": "chunk", "data": "."}
{"type": "end"}
```

**Note**: The `{"type": "end"}` message is **always** sent at the end of every response to signal completion.

### API V2 Usage (with Memory + Ably)

The `/api/query-v2` endpoint uses LangChain with DynamoDB memory and Ably for real-time streaming. Send a POST request to `http://localhost:8000/api/query-v2` with:

```json
{
  "sessionId": "unique-session-id",
  "query": "What is the capital of France?"
}
```

**Response:**
```json
{
  "status": "ok",
  "channel": "query:unique-session-id"
}
```

**Key differences from v1:**
- **REST endpoint**: Uses POST request instead of WebSocket
- **Ably streaming**: Real-time streaming via Ably channels
- **sessionId required**: Each conversation needs a unique session ID
- **Conversational memory**: Previous messages in the session are remembered using DynamoDB
- **Source documents**: Returned in the "done" event
- **Modern LangChain**: Uses latest LCEL with `createHistoryAwareRetriever`, `createRetrievalChain`, and `ChatBedrockConverse`

**Ably Events:**
- **"token"**: Streaming text tokens `{ token: "text" }`
- **"done"**: Completion with answer and sources `{ done: true, answer: "...", sources: [...] }`

### Environment Variables for V2

Add these to your `.env` file:

```env
DYNAMODB_TABLE_NAME=langchain
ABLY_API_KEY=your-ably-api-key
```

**Note**: The ABLY_API_KEY is required for the v2 endpoint to work. You can get an API key from [Ably.com](https://ably.com).

## Testing

1. **Web Interface**: Open `websocket_test.html` in your browser
2. **Postman**: Create a WebSocket request to `ws://localhost:8000/ws/query`
3. **API Docs**: Visit `http://localhost:8000/api-docs` for interactive documentation

## Architecture

- **main.ts** - Main application server with Express framework
- **routes/bedrock/routes.ts** - WebSocket routes for Bedrock integration
- **routes/bedrock/api.ts** - OpenAPI specification for Bedrock endpoints
- **routes/health/routes.ts** - Health check endpoints
- **routes/status/routes.ts** - Status endpoints
- **deno.json** - Deno configuration and dependencies
- **websocket_test.html** - Simple web client for testing
- **.env** - Environment variables

## Dependencies

All dependencies are managed through Deno's import map in `deno.json`:

- **express** - Web framework
- **express-ws** - WebSocket support for Express
- **@aws-sdk/client-bedrock-agent-runtime** - AWS Bedrock client
- **@scalar/express-api-reference** - API documentation
- **cors** - CORS middleware
- **morgan** - HTTP request logger
- **dotenv** - Environment variable loading

## Security

- CORS enabled for development
- Type-safe request/response handling
- Environment variable validation
- Secure WebSocket connections

## Performance

- Streaming responses for real-time user experience
- Efficient memory usage with Deno's modern runtime
- Minimal dependencies with tree-shaking
- Native TypeScript compilation