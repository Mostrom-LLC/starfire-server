# Starfire API Server Architecture

```mermaid
graph TD
    A[Client Applications] --> B[Express.js Server]
    B --> C[CORS Middleware]
    C --> D[Route Handlers]
    
    D --> E[Health Routes]
    D --> F[Status Routes]
    D --> G[Bedrock Routes]
    D --> H[Ingestion Routes]
    D --> I[Visualization Routes]
    
    E --> J[/healthcheck]
    F --> K[/api/status]
    
    G --> L[WebSocket /ws/query]
    L --> M[DynamoDB Chat History]
    L --> N[AWS Bedrock Knowledge Base]
    L --> O[ChatBedrockConverse LLM]
    
    H --> P[POST /api/ingest]
    H --> Q[GET /api/ingest]
    P --> R[AWS S3 Storage]
    P --> S[DynamoDB Metadata]
    P --> T[Bedrock Knowledge Base Sync]
    Q --> S
    
    I --> U[POST /api/visualize/generate]
    I --> V[GET /api/visualize/:id]
    I --> W[POST /api/visualize/:id/powerpoint]
    I --> X[POST /api/visualize/:id/pdf]
    
    U --> N
    U --> S
    U --> Y[DynamoDB Visualizations]
    V --> Y
    W --> Y
    W --> Z[PowerPoint Generation]
    W --> AA[S3 Document Storage]
    X --> Y
    X --> BB[PDF Generation]
    X --> AA
    
    CC[OpenAPI Documentation] --> DD[Scalar API Docs]
    DD --> EE[/api-docs]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style D fill:#e8f5e8
    style N fill:#fff3e0
    style R fill:#fce4ec
    style S fill:#f1f8e9
    style Y fill:#e3f2fd
    style AA fill:#f8bbd9
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

### Health & Status
- Simple monitoring endpoints
- System health checks
- Environment information

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