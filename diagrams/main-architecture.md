# Starfire API Server Architecture

```mermaid
graph TD
    A[Client Applications] --> B[Express.js Server]
    B --> C[CORS Middleware]
    C --> D[Route Handlers]
    
    D --> E[Bedrock Routes]
    D --> F[Ingestion Routes]
    D --> G[Visualization Routes]
    D --> H[Health & Status Routes]
    
    H --> I[/healthcheck, /api/status]
    
    E --> J[WebSocket /ws/query]
    J --> K[DynamoDB Chat History]
    J --> L[AWS Bedrock Knowledge Base]
    J --> M[ChatBedrockConverse LLM]
    
    F --> N[POST /api/ingest]
    F --> O[GET /api/ingest]
    N --> P[AWS S3 Storage]
    N --> Q[DynamoDB Metadata]
    N --> R[Bedrock Knowledge Base Sync]
    O --> Q
    
    G --> S[POST /api/visualize/generate]
    G --> T[GET /api/visualize/:id]
    G --> U[POST /api/visualize/:id/powerpoint]
    G --> V[POST /api/visualize/:id/pdf]
    
    S --> L
    S --> Q
    S --> W[DynamoDB Visualizations]
    T --> W
    U --> W
    U --> X[PowerPoint Generation]
    U --> Y[S3 Document Storage]
    V --> W
    V --> Z[PDF Generation]
    V --> Y
    
    AA[OpenAPI Documentation] --> BB[Scalar API Docs]
    BB --> CC[/api-docs]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style D fill:#e8f5e8
    style L fill:#fff3e0
    style P fill:#fce4ec
    style Q fill:#f1f8e9
    style W fill:#e3f2fd
    style Y fill:#f8bbd9
```

## Technology Stack
- **Runtime**: Deno with TypeScript
- **Framework**: Express.js with WebSocket support
- **Documentation**: Scalar API documentation
- **Cloud Services**: AWS (Bedrock, S3, DynamoDB)
- **AI/ML**: AWS Bedrock with Claude models
- **Real-time**: WebSocket streaming
- **File Processing**: Multer for uploads
- **Export**: PowerPoint (PptxGenJS) and PDF (Puppeteer)

## Key Components

### Bedrock Integration
- Real-time WebSocket streaming
- Conversational memory with DynamoDB
- Knowledge base querying
- Request cancellation support

### Data Ingestion
- Multi-file upload processing
- AI-powered content analysis
- S3 storage with metadata
- Automatic knowledge base synchronization

### Visualization Engine
- Automated chart generation
- Executive-ready presentations
- Multiple export formats (PPTX, PDF)
- Commercial intelligence focus

## Data Flow
1. **Files** → S3 Storage + DynamoDB Metadata
2. **Ingestion** → Knowledge Base Sync
3. **Queries** → Knowledge Base + Chat History
4. **Visualizations** → Data Analysis + Chart Generation
5. **Exports** → Document Generation + S3 Storage

## Security Features
- API key authentication
- CORS protection
- Type-safe request handling
- Environment variable validation