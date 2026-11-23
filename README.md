# Job Queue with Express API and Worker Service

A Node.js project featuring:
- **Express API** - REST endpoints for job management
- **Redis** - Message queue and job state storage
- **Worker Service** - Background job processor with retry logic
- **Docker Compose** - Orchestrate all services

## Project Structure

```
src/
├── shared/           # Shared code between API and Worker
│   ├── redis.js      # Redis client configuration
│   ├── queue.js      # Queue operations
│   ├── validation.js # Input validation
│   └── *.test.js     # Unit tests
├── api/              # Express API service
│   ├── server.js     # API server and routes
│   └── server.test.js
└── worker/           # Background worker service
    ├── worker.js     # Job processor
    └── worker.test.js
```

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:latest
   ```

3. **Run services in separate terminals:**
   ```bash
   # Terminal 1 - API
   npm run api:dev

   # Terminal 2 - Worker
   npm run worker:dev
   ```

4. **Test the API:**
   ```bash
   curl http://localhost:3000/health
   
   # Enqueue a job
   curl -X POST http://localhost:3000/jobs \
     -H "Content-Type: application/json" \
     -d '{"id": "job-1", "documentId": "doc-123"}'

   # Check job status
   curl http://localhost:3000/jobs/job-1
   ```

### Docker Compose

1. **Start all services:**
   ```bash
   npm run docker:up
   ```

2. **Stop all services:**
   ```bash
   npm run docker:down
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| POST | `/jobs` | Enqueue a job |
| GET | `/jobs/:jobId` | Get job status |

### Request/Response Examples

**Enqueue Job:**
```bash
POST /jobs
Content-Type: application/json

{
  "id": "job-123",
  "documentId": "doc-456"
}
```

Response (201):
```json
{
  "message": "Job enqueued successfully",
  "job": {
    "id": "job-123",
    "documentId": "doc-456"
  }
}
```

**Get Status:**
```bash
GET /jobs/job-123
```

Response:
```json
{
  "jobId": "job-123",
  "status": "completed"
}
```

## Job Lifecycle

Jobs transition through these states:
- **queued** - Waiting to be processed
- **processing** - Currently being processed
- **completed** - Successfully completed
- **failed** - Failed after all retries

## Worker Features

- **Polling:** Blocks on Redis `brPop` to fetch jobs from `document-jobs` queue
- **Retry Logic:** Up to 3 retries with exponential backoff (1s → 2s → 4s up to 30s max)
- **Idempotency:** Skips processing if job is already completed
- **Idempotency Keys:** Persists a claim for each job/document operation and suppresses duplicate processing
- **Graceful Shutdown:** Handles SIGTERM and SIGINT signals

Document-processing integrations should forward the supplied idempotency key to
the downstream system that produces side effects. This allows that system to
reject duplicate requests even when a worker crashes after the side effect but
before recording completion.

## Testing

Run all tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `NODE_ENV` | development | Environment mode |
| `REDIS_HOST` | localhost | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |

## Shared Code

### `src/shared/redis.js`
- Singleton Redis client management
- Lazy connection with reconnection logic
- Health check utilities

### `src/shared/queue.js`
- Job enqueueing
- Status management
- Retry logic

### `src/shared/validation.js`
- Job schema validation
- Status enum validation

## Configuration

### Docker Compose Services

- **redis** - Redis container with persistence
- **api** - Express API (port 3000)
- **worker** - Job processor

All services are connected via the `redis-network` bridge network.

## Next Steps

- Implement `processDocument()` in `src/worker/worker.js`
- Add more comprehensive integration tests
- Implement job result storage
- Add monitoring/observability
- Extend job schema as needed
