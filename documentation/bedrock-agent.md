# Bedrock Agent Documentation

## Overview
The Bedrock Agent is a conversational AI agent that provides real-time streaming responses to user queries using AWS Bedrock's knowledge base capabilities. It combines LangChain's conversational memory with DynamoDB for persistent chat history and AWS Bedrock for intelligent document retrieval and response generation.

## Architecture

### Core Components
- **WebSocket Endpoint**: `/ws/query` for real-time bidirectional communication
- **LangChain Integration**: Conversational memory and history-aware retrieval
- **DynamoDB**: Persistent chat session storage
- **AWS Bedrock**: Knowledge base retrieval and response generation
- **S3**: Document storage backend

### Key Features
- **Session-based Conversations**: Each chat session maintains context across multiple queries
- **History-aware Retrieval**: Queries are enhanced with conversation context for better results
- **Real-time Streaming**: Responses are streamed token-by-token for immediate user feedback
- **Source Attribution**: Provides source documents used to generate responses
- **Cancellation Support**: Users can cancel ongoing requests mid-stream

## API Specification

### WebSocket Connection
- **Endpoint**: `ws://localhost:8000/ws/query`
- **Protocol**: WebSocket with JSON message format
- **Headers**: 
  - `Upgrade: websocket`
  - `Connection: Upgrade`

### Message Format

#### Request Messages
```json
{
  "sessionId": "user-session-123",
  "query": "What are the latest drug utilization trends?"
}
```

#### Response Messages

**Streaming Chunks**:
```json
{
  "type": "chunk",
  "data": "Based on the provided search results,"
}
```

**Completion with Sources**:
```json
{
  "type": "done",
  "sources": [
    {
      "content": "Drug utilization data shows...",
      "metadata": {
        "source": "s3://bucket/document.pdf",
        "page": 1
      }
    }
  ]
}
```

**Error Response**:
```json
{
  "error": "SessionId is required for v3 endpoint"
}
```

**Cancellation Request**:
```json
{
  "type": "cancel",
  "sessionId": "user-session-123"
}
```

## Implementation Details

### Technology Stack
- **Runtime**: Deno
- **Framework**: Express.js with WebSocket support
- **AWS Services**: 
  - Bedrock (Claude 3.5 Sonnet)
  - DynamoDB (Chat history)
  - S3 (Document storage)
- **Libraries**:
  - `@langchain/aws`: Bedrock integration
  - `@langchain/community`: DynamoDB chat history
  - `@aws-sdk/client-bedrock-agent-runtime`: Direct Bedrock streaming

### Configuration
Required environment variables:
- `AWS_REGION`: AWS region (default: us-east-1)
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: anthropic.claude-3-5-sonnet-20240620-v1:0)
- `DYNAMODB_CHATS_TABLE`: DynamoDB table for chat history (default: langchain)
- `BEDROCK_KNOWLEDGE_BASE_ID`: Bedrock knowledge base ID

### Processing Flow
1. **WebSocket Connection**: Client connects to `/ws/query`
2. **Message Validation**: Validate sessionId and query parameters
3. **Component Initialization**: Set up DynamoDB chat history, LLM, and retriever
4. **History-aware Retrieval**: Combine current query with conversation history
5. **Document Retrieval**: Query knowledge base for relevant documents
6. **Context Preparation**: Format retrieved documents and conversation history
7. **Response Generation**: Stream response using Bedrock's RetrieveAndGenerateStream
8. **History Storage**: Save user query and AI response to DynamoDB
9. **Source Attribution**: Return source documents used for response generation

### Performance Optimizations
- **Chunked Processing**: Content is truncated to prevent token limit issues
- **Async Knowledge Base Sync**: Non-blocking background synchronization
- **Streaming Response**: Real-time token delivery for better user experience
- **Cancellation Support**: Ability to abort long-running requests

## Commercial Intelligence Context

### System Prompt
The agent is specifically configured for pharmaceutical commercial intelligence with a focus on:
- Healthcare commercial intelligence for life sciences teams
- Business-relevant insights for informed decision-making
- Actionable intelligence based on healthcare datasets
- Professional language for healthcare commercial teams
- Trend identification and pattern recognition

### Target Use Cases
- Drug utilization analysis
- Market access insights
- Competitive intelligence
- Healthcare analytics
- Commercial decision support

## Error Handling
- **Validation Errors**: Missing sessionId or query parameters
- **Stream Cancellation**: Graceful handling of user-initiated cancellations
- **AWS Service Errors**: Retry logic and fallback mechanisms
- **Connection Errors**: WebSocket connection management

## Monitoring and Logging
- **Performance Metrics**: Detailed timing for each processing stage
- **Request Tracking**: Full request lifecycle logging
- **Error Tracking**: Comprehensive error reporting
- **Token Metrics**: Streaming performance and token count tracking

## Security Considerations
- **Session Isolation**: Each session maintains separate conversation history
- **Input Validation**: Sanitization of user inputs
- **AWS IAM**: Service-to-service authentication
- **Data Privacy**: Conversation history stored in secure DynamoDB tables