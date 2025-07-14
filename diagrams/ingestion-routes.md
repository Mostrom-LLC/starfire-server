# Ingestion Routes Diagram

```mermaid
graph TD
    A[POST /api/ingest] --> B[API Key Check]
    B --> C[Multer File Upload]
    C --> D[Process Each File]
    
    D --> E[Generate File ID & S3 Key]
    E --> F[Upload to S3]
    F --> G[Trigger Knowledge Base Sync]
    F --> H[LLM File Analysis]
    
    G --> I[StartIngestionJob Command]
    I --> J[Background Knowledge Base Update]
    
    H --> K[Generate Analysis Prompt]
    K --> L[Call ChatBedrockConverse]
    L --> M[Parse LLM Response]
    M --> N{Parse Success?}
    N -->|Yes| O[Use LLM Analysis]
    N -->|No| P[Use Intelligent Fallback]
    
    O --> Q[Create File Analysis Object]
    P --> Q
    Q --> R[Store in DynamoDB]
    R --> S[Add to Results]
    
    S --> T{More Files?}
    T -->|Yes| D
    T -->|No| U[Return Batch Results]
    
    V[GET /api/ingest] --> W[API Key Check]
    W --> X[Parse Pagination Parameters]
    X --> Y[Scan DynamoDB Table]
    Y --> Z[Transform Items]
    Z --> AA[Sort by Upload Time]
    AA --> BB[Apply Pagination]
    BB --> CC[Return Paginated Results]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style F fill:#e8f5e8
    style H fill:#fff3e0
    style R fill:#fce4ec
    style V fill:#e1f5fe
    style Y fill:#f1f8e9
```

## Description
File ingestion system that uploads files to S3, analyzes them with AI, and stores metadata in DynamoDB.

## User Flow - POST /api/ingest

```
[User] (via File Upload UI)
   ↓
HTTP POST → `/api/ingest` (with files)
   ↓
API Key validation
   ↓
Multer file processing (up to 1GB per file)
   ↓
For each file:
   • Generate UUID & S3 key
   • Upload to S3 with metadata
   • Trigger Bedrock Knowledge Base sync (async)
   • AI analysis with ChatBedrockConverse
   ↓
Commercial intelligence extraction:
   • Market access themes
   • HEOR insights
   • Competitive analysis
   • Physician profiling data
   ↓
Structured metadata → DynamoDB
   ↓
Batch response with analysis results
```

## User Flow - GET /api/ingest

```
[User] (via File Management UI)
   ↓
HTTP GET → `/api/ingest?page=1&pageCount=20`
   ↓
API Key validation
   ↓
DynamoDB scan with pagination
   ↓
Sort by upload timestamp (newest first)
   ↓
Return paginated file metadata
```

## POST /api/ingest Features
- **Multi-file Upload**: Supports batch file uploads
- **AI Analysis**: Uses Claude to analyze file content and extract commercial intelligence
- **S3 Storage**: Stores original files in S3 with metadata
- **DynamoDB Metadata**: Stores structured analysis results
- **Knowledge Base Sync**: Automatically triggers AWS Bedrock knowledge base updates
- **Intelligent Fallbacks**: Uses filename-based analysis when AI parsing fails

## GET /api/ingest Features
- **Pagination**: Supports page-based pagination
- **Sorting**: Returns files sorted by upload time (newest first)
- **Filtering**: Can be extended for content type or topic filtering

## File Analysis Structure
```json
{
  "id": "uuid",
  "name": "filename.pdf",
  "type": "Commercial Intelligence Report",
  "summary": "Business-focused summary",
  "key_topics": ["market access", "pricing"],
  "data_classification": "Market Access Intelligence",
  "s3_key": "uploads/2024-01-01/filename.pdf",
  "upload_timestamp": "2024-01-01T12:00:00Z"
}
```

## Commercial Intelligence Themes
- Market Access (payor coverage, formulary positioning)
- HEOR (Health Economics & Outcomes Research)
- Omnichannel Engagement (HCP interactions)
- Patient Journey (treatment pathways)
- Physician Profiling (prescriber behavior)
- Pricing/GTN (gross-to-net, pricing strategy)
- Competitive Intelligence (market share analysis)