# Visualization Routes Diagram

```mermaid
graph TD
    A[POST /api/visualize/generate] --> B[Generate Visualization Set ID]
    B --> C[Retrieve Knowledge Base Data]
    C --> D[Retrieve File Metadata from DynamoDB]
    D --> E[Prepare LLM Analysis Prompt]
    E --> F[Call ChatBedrockConverse for Analysis]
    F --> G[Parse LLM Response]
    G --> H[Create Visualization Set]
    H --> I[Store in DynamoDB]
    I --> J[Return Visualization Summary]
    
    K[GET /api/visualize/:id] --> L[Query DynamoDB by ID]
    L --> M[Return Full Visualization Set]
    
    N[DELETE /api/visualize/:id] --> O[Delete from DynamoDB]
    O --> P[Return Delete Confirmation]
    
    Q[GET /api/visualize] --> R[Scan DynamoDB Table]
    R --> S[Return All Visualization Sets]
    
    T[POST /api/visualize/:id/powerpoint] --> U[Retrieve Visualization Set]
    U --> V[Generate PowerPoint Slides]
    V --> W[Create Custom Charts with Shapes]
    W --> X[Add Corporate Branding]
    X --> Y[Generate PPTX Buffer]
    Y --> Z[Upload to S3]
    Z --> AA[Generate Pre-signed URL]
    AA --> BB[Return Download URL]
    
    CC[POST /api/visualize/:id/pdf] --> DD[Retrieve Visualization Set]
    DD --> EE[Generate HTML Content]
    EE --> FF[Convert to PDF with Puppeteer]
    FF --> GG[Upload to S3]
    GG --> HH[Generate Pre-signed URL]
    HH --> II[Return Download URL]
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style F fill:#e8f5e8
    style I fill:#fff3e0
    style V fill:#fce4ec
    style W fill:#f1f8e9
    style EE fill:#e3f2fd
    style FF fill:#f8bbd9
```

## Description
Comprehensive visualization system that generates executive-ready charts, insights, and export capabilities.

## User Flow - POST /api/visualize/generate

```
[User] (via Dashboard UI)
   ↓
HTTP POST → `/api/visualize/generate`
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