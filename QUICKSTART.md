# Quick Start

## 60-Second Setup

```bash
# 1. Install
npm install

# 2. Start Redis (in background)
docker run -d -p 6379:6379 redis:latest

# 3. Start API (Terminal 1)
npm run api:dev

# 4. Start Worker (Terminal 2)
npm run worker:dev

# 5. Test (Terminal 3)
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"id":"test-1","documentId":"doc-123"}'

# Check status
curl http://localhost:3000/jobs/test-1
```

## Using Docker Compose

One command to rule them all:

```bash
npm run docker:up
# Services up and running. Press Ctrl+C to stop.

npm run docker:down
```

## Project at a Glance

| Component | Location | Purpose |
|-----------|----------|---------|
| API Server | `src/api/server.js` | REST endpoints for job management |
| Worker | `src/worker/worker.js` | Processes jobs from Redis queue |
| Shared Code | `src/shared/` | Common utilities, validation, Redis config |
| Config | `docker-compose.yml` | Orchestrates all services |
| Tests | `src/**/*.test.js` | Unit tests (run with `npm test`) |

## Key Features

✅ Express API with input validation  
✅ Redis-based job queue  
✅ Background worker with retry logic  
✅ Health check endpoints  
✅ Docker Compose ready  
✅ Full test coverage  
✅ Shared code between services  

## API Endpoints

```
POST   /jobs              - Enqueue a job
GET    /jobs/:jobId       - Check job status
GET    /health            - Health check
GET    /ready             - Ready check
GET    /                  - Service info
```

## Next Steps

1. **Implement business logic** in `src/worker/worker.js` → `processDocument()`
2. **Add custom endpoints** in `src/api/server.js`
3. **Extend job schema** in `src/shared/validation.js`
4. **Write integration tests** using existing test structure
5. See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed guide

## Default Ports

- **API**: 3000
- **Redis**: 6379

## Logs

```bash
# Docker Compose logs
docker-compose logs -f

# Specific service
docker-compose logs -f worker
```

---

**Ready to go!** See [README.md](./README.md) and [DEVELOPMENT.md](./DEVELOPMENT.md) for more details.
