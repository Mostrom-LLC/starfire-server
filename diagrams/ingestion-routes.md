# Ingestion Routes Diagram

```mermaid
graph TD
    A[POST /api/ingest] --> B[Multer File Upload]
    B --> C[Process Each File]
    
    C --> D[Generate File ID & S3 Key]
    D --> E[Upload to S3]
    E --> F[Trigger Knowledge Base Sync]
    E --> G[LLM File Analysis]
    
    F --> H[StartIngestionJob Command]
    H --> I[Background Knowledge Base Update]
    
    G --> J[Generate Analysis Prompt]
    J --> K[Call ChatBedrockConverse]
    K --> L[Parse LLM Response]
    L --> M{Parse Success?}
    M -->|Yes| N[Use LLM Analysis]
    M -->|No| O[Use Intelligent Fallback]
    
    N --> P[Create File Analysis Object]
    O --> P
    P --> Q[Store in DynamoDB]
    Q --> R[Add to Results]
    
    R --> S{More Files?}
    S -->|Yes| C
    S -->|No| T[Return Batch Results]
    
    U[GET /api/ingest] --> V[Parse Pagination Parameters]
    V --> W[Scan DynamoDB Table]
    W --> X[Transform Items]
    X --> Y[Sort by Upload Time]
    Y --> Z[Apply Pagination]
    Z --> AA[Return Paginated Results]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style E fill:#e8f5e8
    style G fill:#fff3e0
    style Q fill:#fce4ec
    style U fill:#e1f5fe
    style W fill:#f1f8e9
```

## Description
File ingestion system that uploads files to S3, analyzes them with AI, and stores metadata in DynamoDB.

## User Flow - POST /api/ingest

```
[User] (via File Upload UI)
   ↓
HTTP POST → `/api/ingest` (with files)
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