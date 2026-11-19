# Development Guide

## Project Architecture

### Services

```
┌─────────────┐         ┌──────────────┐
│   Express   │         │    Worker    │
│     API     │◄────────┤   Service    │
└─────────────┘         └──────────────┘
      ▲                        ▲
      │                        │
      └────────────┬───────────┘
                   │
              ┌────▼────┐
              │  Redis  │
              │  Queue  │
              └─────────┘
```

## Running Locally

### Prerequisites
- Node.js 18+
- Redis running locally (or Docker)

### Setup

```bash
# Install dependencies
npm install

# Start Redis (using Docker)
docker run -d -p 6379:6379 redis:latest
```

### Development Mode

**Terminal 1 - API Service:**
```bash
npm run api:dev
```
API will be available at `http://localhost:3000`

**Terminal 2 - Worker Service:**
```bash
npm run worker:dev
```

### Manual Testing

```bash
# Health check
curl http://localhost:3000/health

# Enqueue a job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "job-001",
    "documentId": "doc-123"
  }'

# Check job status
curl http://localhost:3000/jobs/job-001

# Watch worker logs to see processing
```

## Docker Deployment

### Build and Run

```bash
# Start all services
npm run docker:up

# View logs
docker-compose logs -f

# Stop services
npm run docker:down
```

### Docker Network

Services communicate via the `redis-network` bridge:
- **redis**: `redis://redis:6379`
- **api**: `http://api:3000`
- **worker**: Background service (no exposed port)

## Testing

### Run All Tests
```bash
npm test
```

### Run Tests by Module
```bash
npm run test:shared   # Shared utilities
npm run test:api      # API server
npm run test:worker   # Worker service
```

### Watch Mode
```bash
npm run test:watch
```

## Code Organization

### Shared Code (`src/shared/`)
- **redis.js** - Redis client singleton and utilities
- **queue.js** - Job queue operations
- **validation.js** - Input validation helpers

### API Service (`src/api/`)
- **server.js** - Express application and routes
- **server.test.js** - API tests

### Worker Service (`src/worker/`)
- **worker.js** - Job processor with retry logic
- **worker.test.js** - Worker tests

## Adding New Endpoints

1. Edit [src/api/server.js](/src/api/server.js)
2. Add route handler
3. Add corresponding test in [src/api/server.test.js](/src/api/server.test.js)
4. Run tests: `npm run test:api`

Example:
```javascript
app.get('/jobs', async (req, res) => {
  try {
    // Your logic here
    res.json({ jobs: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Extending Job Processing

The worker's `processDocument()` function in [src/worker/worker.js](/src/worker/worker.js) is where you implement actual business logic.

```javascript
async function processDocument(documentId) {
  // TODO: Implement actual document processing
  console.log(`Processing document: ${documentId}`);
  
  // Example: fetch document, process, store results
  // throw new Error('Processing failed'); // Worker will retry
}
```

## Debugging

### View Redis Keys
```bash
# Connect to Redis
redis-cli

# List all keys
keys *

# Check job status
hgetall job:job-001

# View queue
lrange document-jobs 0 -1
```

### Docker Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f redis
```

## Environment Configuration

Create `.env` file for local overrides:
```
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
```

## Performance Considerations

- **Redis Persistence**: Data survives container restarts
- **Worker Retry**: 3 retries with exponential backoff (max 30s)
- **Connection Pooling**: Shared Redis client across app
- **Health Checks**: API has `/health` and `/ready` endpoints

## Extending the Schema

Currently jobs have: `id`, `documentId`, `status`

To add fields:
1. Update [src/shared/validation.js](/src/shared/validation.js)
2. Update job creation in [src/api/server.js](/src/api/server.js)
3. Update worker processing in [src/worker/worker.js](/src/worker/worker.js)
4. Add tests

## Production Checklist

- [ ] Environment variables configured
- [ ] Redis persistence enabled
- [ ] Health checks configured
- [ ] Logging setup (consider structured logging)
- [ ] Error tracking (Sentry, etc.)
- [ ] API rate limiting
- [ ] Job timeout configuration
- [ ] Database for audit trail (optional)
- [ ] Monitoring/alerting
