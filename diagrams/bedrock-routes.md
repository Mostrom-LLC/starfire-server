# Bedrock Routes Diagram

```mermaid
graph TD
    A[WebSocket /ws/query] --> B[WebSocket Connection Handler]
    B --> C[Listen for Messages]
    C --> D{Message Type}
    D -->|cancel| E[Cancel Request]
    D -->|query| F[Process Query]
    
    E --> G[Abort Stream Controller]
    G --> H[Send Cancellation Confirmation]
    
    F --> I[Validate Query & SessionId]
    I --> J[Initialize Components]
    J --> K[DynamoDB Chat History]
    J --> L[ChatBedrockConverse LLM]
    J --> M[Knowledge Base Retriever]
    
    K --> N[Get Chat History]
    L --> O[Create History-Aware Retriever]
    M --> O
    N --> O
    
    O --> P[Invoke History-Aware Retriever]
    P --> Q[Format Context & History]
    Q --> R[Build System Prompt]
    R --> S[Create Bedrock Stream Command]
    S --> T[Send to Bedrock]
    
    T --> U[Process Stream Events]
    U --> V{Stream Event}
    V -->|text chunk| W[Send WebSocket Chunk]
    V -->|end| X[Save to DynamoDB]
    
    W --> Y[Continue Streaming]
    Y --> U
    
    X --> Z[Send Done Message with Sources]
    Z --> AA[Performance Logging]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style F fill:#e8f5e8
    style J fill:#fff3e0
    style T fill:#fce4ec
    style U fill:#f1f8e9
    style X fill:#e3f2fd
```

## Description
WebSocket endpoint for real-time knowledge base querying with conversational memory. Supports streaming responses and request cancellation.

## User Flow

```
[User] (via Chat UI)
   ↓
WebSocket Connection → `/ws/query`
   ↓
LangChainJS stack:
   • ChatBedrockConverse (LLM)
   • DynamoDBChatMessageHistory
   • AmazonKnowledgeBaseRetriever (Bedrock KB)
   • createHistoryAwareRetriever (LangChain)
   ↓
Prompt construction:
   • Truncated context from retrieved docs
   • Recent conversation history
   • Business-aligned system prompt
   ↓
AWS Bedrock `RetrieveAndGenerateStreamCommand`
   ↓
Response streamed token-by-token via WebSocket
   ↓
Frontend renders in real-time
   ↓
Final result + source docs
```

## Key Features
- **Conversational Memory**: Uses DynamoDB to store chat history per session
- **Streaming**: Real-time token streaming via WebSocket
- **Cancellation**: Ability to cancel in-progress requests
- **Context-Aware**: Uses LangChain history-aware retriever
- **Performance Tracking**: Detailed timing metrics for each phase

## Message Format
### Input
```json
{
  "sessionId": "unique-session-id",
  "query": "your question here"
}
```

### Output (Streaming)
```json
{"type": "chunk", "data": "text token"}
{"type": "done", "sources": [...]}
```

### Cancellation
```json
{"type": "cancel", "sessionId": "session-id"}
```