# Health Routes Diagram

```mermaid
graph TD
    A[GET /healthcheck] --> B[Health Check Handler]
    B --> C[Check System Status]
    C --> D[Return JSON Response]
    D --> E[{<br/>status: "healthy",<br/>uptime: performance.now() / 1000,<br/>timestamp: new Date().toISOString()<br/>}]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fce4ec
```

## Description
Simple health check endpoint that returns the server's health status, uptime, and current timestamp.

## Response Format
- **Status**: 200 OK
- **Content-Type**: application/json
- **Body**: Contains status, uptime in seconds, and ISO timestamp