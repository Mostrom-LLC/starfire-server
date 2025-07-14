# Visualization Routes Diagram

```mermaid
graph TD
    A[POST /api/visualize/generate] --> B[API Key Check]
    B --> C[Generate Visualization Set ID]
    C --> D[Retrieve Knowledge Base Data]
    D --> E[Retrieve File Metadata from DynamoDB]
    E --> F[Prepare LLM Analysis Prompt]
    F --> G[Call ChatBedrockConverse for Analysis]
    G --> H[Parse LLM Response]
    H --> I[Create Visualization Set]
    I --> J[Store in DynamoDB]
    J --> K[Return Visualization Summary]
    
    L[GET /api/visualize/:id] --> M[API Key Check]
    M --> N[Query DynamoDB by ID]
    N --> O[Return Full Visualization Set]
    
    P[DELETE /api/visualize/:id] --> Q[API Key Check]
    Q --> R[Delete from DynamoDB]
    R --> S[Return Delete Confirmation]
    
    T[GET /api/visualize] --> U[API Key Check]
    U --> V[Scan DynamoDB Table]
    V --> W[Return All Visualization Sets]
    
    X[POST /api/visualize/:id/powerpoint] --> Y[API Key Check]
    Y --> Z[Retrieve Visualization Set]
    Z --> AA[Generate PowerPoint Slides]
    AA --> BB[Create Custom Charts with Shapes]
    BB --> CC[Add Corporate Branding]
    CC --> DD[Generate PPTX Buffer]
    DD --> EE[Upload to S3]
    EE --> FF[Generate Pre-signed URL]
    FF --> GG[Return Download URL]
    
    HH[POST /api/visualize/:id/pdf] --> II[API Key Check]
    II --> JJ[Retrieve Visualization Set]
    JJ --> KK[Generate HTML Content]
    KK --> LL[Convert to PDF with Puppeteer]
    LL --> MM[Upload to S3]
    MM --> NN[Generate Pre-signed URL]
    NN --> OO[Return Download URL]
    
    style A fill:#e1f5fe
    style D fill:#f3e5f5
    style G fill:#e8f5e8
    style J fill:#fff3e0
    style AA fill:#fce4ec
    style BB fill:#f1f8e9
    style KK fill:#e3f2fd
    style LL fill:#f8bbd9
```

## Description
Comprehensive visualization system that generates executive-ready charts, insights, and export capabilities.

## User Flow - POST /api/visualize/generate

```
[User] (via Dashboard UI)
   ↓
HTTP POST → `/api/visualize/generate`
   ↓
API Key validation
   ↓
Knowledge base data retrieval:
   • AmazonKnowledgeBaseRetriever (topK=20)
   • DynamoDB file metadata scan
   ↓
LLM analysis with ChatBedrockConverse:
   • Commercial intelligence focus
   • Executive-level insights
   • 4 chart types (bar, line, pie, radar)
   ↓
Visualization set creation:
   • Business-relevant titles
   • Actionable recommendations
   • Performance metrics
   ↓
DynamoDB storage → Return summary
```

## User Flow - POST /api/visualize/:id/powerpoint

```
[User] (via Export UI)
   ↓
HTTP POST → `/api/visualize/:id/powerpoint`
   ↓
API Key validation
   ↓
Retrieve visualization set from DynamoDB
   ↓
PowerPoint generation:
   • Corporate branding (Starfire theme)
   • Custom charts with shapes
   • Executive summary slides
   • Two-column layout
   ↓
Upload PPTX → S3
   ↓
Generate pre-signed URL → Return download link
```

## User Flow - POST /api/visualize/:id/pdf

```
[User] (via Export UI)
   ↓
HTTP POST → `/api/visualize/:id/pdf`
   ↓
API Key validation
   ↓
Retrieve visualization set from DynamoDB
   ↓
PDF generation:
   • HTML content creation
   • Puppeteer rendering
   • Professional styling
   • Multi-page report
   ↓
Upload PDF → S3
   ↓
Generate pre-signed URL → Return download link
```

## POST /api/visualize/generate Features
- **Auto-Analysis**: Automatically analyzes knowledge base data
- **Executive Focus**: Generates business-relevant insights for pharmaceutical commercial teams
- **Multiple Charts**: Creates 4 different visualization types (bar, line, pie, radar)
- **Commercial Intelligence**: Focuses on market access, HEOR, competitive analysis
- **Persistent Storage**: Saves visualization sets in DynamoDB for later retrieval

## Visualization Export Features

### PowerPoint Generation
- **Corporate Branding**: Starfire-themed slides with consistent styling
- **Native Charts**: Custom chart rendering using shapes and visual elements
- **Two-Column Layout**: Charts on left, insights/recommendations on right
- **Executive Summary**: Cover page and summary slides
- **Professional Format**: Suitable for C-suite presentations

### PDF Generation
- **Multi-Page Report**: Comprehensive document with cover page
- **HTML-to-PDF**: Uses Puppeteer for high-quality rendering
- **Structured Layout**: Professional formatting with charts and data tables
- **Fallback Support**: Uses jsPDF when Puppeteer fails
- **Executive Ready**: Suitable for board presentations and reports

## Chart Types Supported
- **Bar Charts**: Category comparisons and rankings
- **Line Charts**: Trend analysis and time series
- **Pie Charts**: Market share and distribution analysis
- **Radar Charts**: Multi-dimensional performance analysis
- **Data Tables**: Structured data presentation

## Commercial Intelligence Themes
- **Market Access**: Payor coverage patterns and formulary positioning
- **Brand Performance**: Sales metrics and competitive benchmarking
- **HEOR Evidence**: Cost-effectiveness and clinical outcomes
- **Physician Profiling**: Prescriber behavior and targeting insights
- **Competitive Intelligence**: Market share and competitor analysis
- **Pricing Strategy**: GTN analysis and pricing optimization

## API Response Structure
```json
{
  "visualizationSetId": "uuid",
  "title": "Medicare Drug Utilization Analysis Q2 2025",
  "summary": "Executive summary of key findings",
  "visualizationCount": 4,
  "metadata": {
    "documentsAnalyzed": 20,
    "filesReferenced": 15,
    "processingTime": 5000
  }
}
```