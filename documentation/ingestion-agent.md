# Ingestion Agent Documentation

## Overview
The Ingestion Agent is a file processing and analysis system that handles document upload, AI-powered content analysis, and metadata storage for the Starfire commercial intelligence platform. It provides a complete pipeline for ingesting pharmaceutical and healthcare documents, analyzing them for commercial relevance, and making them available for downstream query processing.

## Architecture

### Core Components
- **File Upload Service**: Multipart file upload handling with 1GB size limit
- **S3 Storage**: Secure document storage with metadata
- **AI Analysis**: LLM-powered content analysis and classification
- **DynamoDB**: Structured metadata storage with GSI support
- **Knowledge Base Sync**: Automated Bedrock knowledge base synchronization

### Key Features
- **Batch Processing**: Multiple file uploads in a single request
- **AI Content Analysis**: Automatic document classification and summarization
- **Commercial Intelligence Focus**: Specialized analysis for pharmaceutical business context
- **Metadata Management**: Rich metadata extraction and storage
- **Fault Tolerance**: Partial failure handling with detailed error reporting
- **Knowledge Base Integration**: Automatic sync with AWS Bedrock knowledge base

## API Specification

### Endpoints

#### POST /api/ingest
Upload and analyze files with AI-powered commercial intelligence extraction.

**Authentication**: API key required in header
**Content-Type**: multipart/form-data
**File Limit**: 1GB per file

**Request Example**:
```bash
curl -X POST \
  -H "api-key: YOUR_API_KEY" \
  -F "files=@drug_report.pdf" \
  -F "files=@patient_data.xlsx" \
  http://localhost:8000/api/ingest
```

**Response Example**:
```json
{
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "version": "1",
      "name": "drug_utilization_report.pdf",
      "type": "Market Access Analysis",
      "size": 3145728,
      "summary": "Enables pricing strategy optimization through Medicare Utilization and Payment (MUP) data analysis, supporting payor negotiations and access decisions.",
      "key_topics": ["market access", "pricing strategy", "payor intelligence", "utilization data"],
      "data_classification": "Market Access Intelligence",
      "upload_timestamp": "2024-01-15T10:30:00.000Z",
      "s3_key": "uploads/2024-01-15/drug_utilization_report.pdf",
      "s3_bucket": "dev-starfire-rag-agent"
    }
  ],
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  }
}
```

#### GET /api/ingest
Retrieve paginated list of ingested files with metadata.

**Authentication**: API key required in header
**Query Parameters**:
- `limit`: Number of items (1-100, default: 20)
- `lastKey`: Pagination token for next page

**Response Example**:
```json
{
  "data": [
    {
      "id": "3e3bc54d-6d62-4f37-89ae-d1e89722d759",
      "version": "1",
      "name": "MUP_DPR_RY22_20220715_DD_PRV_Drug.pdf",
      "type": "Market Access Analysis",
      "size": 131517,
      "summary": "Contains Medicare Utilization and Payment (MUP) drug price regulation data for Canadian provinces with detailed cost analysis and utilization metrics.",
      "key_topics": ["Drug Prices", "Price Regulation", "Healthcare Metrics"],
      "data_classification": "Market Access Intelligence",
      "upload_timestamp": "2025-07-10T09:55:59.955Z",
      "s3_key": "uploads/2025-07-10/3e3bc54d-filename.pdf",
      "s3_bucket": "dev-starfire-rag-agent"
    }
  ],
  "pagination": {
    "limit": 20,
    "count": 1,
    "hasMore": false
  }
}
```

## Implementation Details

### Technology Stack
- **Runtime**: Deno
- **Framework**: Express.js with Multer for file handling
- **AWS Services**:
  - S3 (Document storage)
  - DynamoDB (Metadata storage)
  - Bedrock (AI analysis and knowledge base)
- **Libraries**:
  - `multer`: File upload handling
  - `@aws-sdk/client-s3`: S3 operations
  - `@aws-sdk/client-dynamodb`: DynamoDB operations
  - `@langchain/aws`: Bedrock LLM integration

### Configuration
Required environment variables:
- `AWS_REGION`: AWS region (default: us-east-1)
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: anthropic.claude-3-5-sonnet-20240620-v1:0)
- `S3_BUCKET_NAME`: S3 bucket for document storage
- `DYNAMODB_S3_TABLE`: DynamoDB table for metadata
- `BEDROCK_KNOWLEDGE_BASE_ID`: Knowledge base ID (optional)
- `BEDROCK_DATA_SOURCE_ID`: Data source ID (optional)

### Processing Pipeline

#### File Upload Flow
1. **Authentication**: Validate API key
2. **File Validation**: Check file size and format
3. **S3 Upload**: Store file with metadata
4. **AI Analysis**: Process content with commercial intelligence focus
5. **Metadata Storage**: Save structured data to DynamoDB
6. **Knowledge Base Sync**: Trigger background sync (non-blocking)
7. **Response Generation**: Return analysis results

#### AI Analysis Pipeline
The system uses a sophisticated commercial intelligence analysis prompt that:
- Focuses on pharmaceutical business context
- Identifies commercial intelligence themes
- Extracts actionable business insights
- Classifies documents by commercial relevance

### Commercial Intelligence Themes
The AI analysis identifies these key commercial intelligence areas:
- **Market Access**: Payor coverage, formulary positioning, access barriers
- **HEOR**: Health Economics & Outcomes Research, cost-effectiveness
- **Omnichannel Engagement**: HCP interactions, digital touchpoints
- **Patient Journey**: Treatment pathways, patient flow analysis
- **Physician Profiling**: Prescriber behavior, targeting insights
- **Pricing/GTN**: Gross-to-net, pricing strategy, rebates
- **Contracting/Compliance**: Managed care contracts, regulatory compliance
- **Forecasting**: Demand planning, market projections
- **Competitive Intelligence**: Market share, competitor analysis
- **Brand Performance**: Launch metrics, sales performance

### Document Classification
The system provides intelligent document classification including:
- **Market Access Analysis**: Payor and access-related documents
- **Brand Performance Dashboard**: Sales and performance metrics
- **Payor Coverage Report**: Insurance and coverage analysis
- **Competitive Intelligence Brief**: Market and competitor analysis
- **Launch Readiness Assessment**: Product launch preparation
- **HEOR Evidence Package**: Health economic evidence
- **Physician Profiling Report**: Prescriber behavior analysis

### Fallback Analysis
If AI analysis fails, the system provides intelligent fallbacks based on:
- **Filename Patterns**: MUP, DPR, prescription, clinical terms
- **File Types**: PDF reports, Excel spreadsheets, CSV datasets
- **Commercial Context**: Business-focused default classifications

## Data Storage

### DynamoDB Schema
- **Partition Key**: `objectKey` (S3 key)
- **Sort Key**: `version` (document version)
- **Attributes**:
  - `id`: Unique file identifier
  - `name`: Original filename
  - `type`: Document classification
  - `size`: File size in bytes
  - `summary`: AI-generated summary
  - `key_topics`: Array of identified topics
  - `data_classification`: Commercial classification
  - `upload_timestamp`: Upload time
  - `s3_bucket`: S3 bucket name
  - `contentType`: MIME type
  - `lastModified`: Last modification time

### S3 Storage Structure
```
uploads/
├── 2024-01-15/
│   ├── uuid-filename.pdf
│   └── uuid-filename.xlsx
├── 2024-01-16/
│   └── uuid-filename.csv
```

## Error Handling

### Upload Errors
- **File size exceeded**: 1GB limit enforcement
- **No files provided**: Validation error
- **S3 upload failure**: AWS service error handling
- **DynamoDB storage failure**: Database error handling

### Analysis Errors
- **AI analysis failure**: Fallback to intelligent defaults
- **JSON parsing errors**: Graceful degradation
- **Knowledge base sync failure**: Non-blocking background operation

### Partial Failures
The system supports partial success scenarios:
- Some files process successfully while others fail
- Detailed error reporting for failed files
- Successful files are still stored and available
- Error details provided in response

## Performance Optimizations

### Batch Processing
- Multiple files processed in single request
- Parallel processing where possible
- Shared knowledge base sync for batch uploads

### Background Operations
- Non-blocking knowledge base synchronization
- Asynchronous AI analysis where possible
- Efficient DynamoDB batch operations

### Memory Management
- Streaming file uploads
- Memory-efficient file processing
- Proper cleanup of temporary resources

## Security Considerations

### Authentication
- API key validation for all endpoints
- Secure key storage and validation

### Data Privacy
- Secure S3 storage with proper IAM policies
- DynamoDB encryption at rest
- No sensitive data in logs

### Input Validation
- File type validation
- Size limit enforcement
- Content sanitization

## Monitoring and Logging

### Performance Metrics
- Upload timing and throughput
- AI analysis performance
- Storage operation timing
- Overall request completion time

### Error Tracking
- Detailed error logging
- Failure categorization
- Recovery recommendations

### Business Intelligence
- Document classification statistics
- Commercial intelligence theme analysis
- Usage patterns and trends

## Integration Points

### Knowledge Base Integration
- Automatic sync with Bedrock knowledge base
- Background ingestion job triggering
- Status monitoring and reporting

### Downstream Systems
- Structured metadata for query agents
- Commercial intelligence data pipeline
- Business intelligence dashboards

## Usage Examples

### Single File Upload
```bash
curl -X POST \
  -H "api-key: YOUR_API_KEY" \
  -F "files=@market_analysis.pdf" \
  http://localhost:8000/api/ingest
```

### Multiple File Upload
```bash
curl -X POST \
  -H "api-key: YOUR_API_KEY" \
  -F "files=@report1.pdf" \
  -F "files=@data.xlsx" \
  -F "files=@analysis.csv" \
  http://localhost:8000/api/ingest
```

### List Files
```bash
curl -H "api-key: YOUR_API_KEY" \
  "http://localhost:8000/api/ingest?limit=10&lastKey=PAGINATION_TOKEN"
```