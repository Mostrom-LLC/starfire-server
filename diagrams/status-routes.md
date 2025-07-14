# Status Routes Diagram

```mermaid
graph TD
    A[GET /api/status] --> B[Status Handler]
    B --> C[Get Environment Variables]
    C --> D[Build Status Object]
    D --> E[Return JSON Response]
    E --> F[{<br/>status: "online",<br/>timestamp: ISO string,<br/>version: "1.0.0",<br/>environment: NODE_ENV<br/>}]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fce4ec
    style F fill:#f1f8e9
```

## Description
API status endpoint that provides information about the running server instance including version and environment.

## Response Format
- **Status**: 200 OK
- **Content-Type**: application/json
- **Body**: Contains online status, timestamp, version, and environment