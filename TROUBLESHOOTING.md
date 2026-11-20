# Troubleshooting Guide

## Redis List Operations Not Persisting (RESOLVED)

### Symptom
Jobs were being created and their status was stored in Redis, but they were not appearing in the job queue list. The worker would wait indefinitely without picking up any jobs.

**Example:**
```
$ redis-cli LPUSH job-queue '{"id":"test"}'
(integer) 1

$ redis-cli LLEN job-queue
(integer) 0  ❌ Expected 1!
```

### Root Cause
The Redis Search module (v8.10.1) in this Docker Compose setup was silently intercepting and failing certain list operations. This happened inconsistently with different key names and after FLUSHALL operations.

The redis-cli npm module's helper methods (`lPush()`, `lLen()`, etc.) were also affected, returning success (1) while the data was never actually written.

### Solution
Use the low-level `sendCommand()` API instead of the helper methods. This bypasses the Search module compatibility issue.

**Before (broken):**
```javascript
await redis.lPush('job-queue', JSON.stringify(job));
await redis.lLen('job-queue');  // Returns 0 ❌
```

**After (working):**
```javascript
await redis.sendCommand(['LPUSH', 'job-queue', JSON.stringify(job)]);
await redis.sendCommand(['LLEN', 'job-queue']);  // Returns 1 ✅
```

### Files Changed
- `src/shared/queue.js` - All queue operations now use `sendCommand()`
- `src/worker/worker.js` - Worker uses BRPOP via `sendCommand()`
- `scripts/migrate-jobs.js` - Migration script uses `sendCommand()`

### Verification
After the fix, jobs flow through the system properly:
1. POST /job creates job with status=queued in Redis hash
2. Job is enqueued to `job-queue` list via LPUSH
3. Worker BRPOP blocks on queue and receives the job
4. Worker marks job as processing, then completed
5. GET /jobs returns job with correct status

## Related Issues

### Key Names with Redis Search
Certain key names like "document-jobs" or "q" may be affected by the Search module. If you experience issues:
- Try using simple key names with hyphens: `job-queue`, `test-queue`
- Avoid single-letter keys
- Use `sendCommand()` for all Redis operations as a safety measure

### Node Version Compatibility
The Docker images use Node 18, but redis@6.3.1 requires Node 20+. This generates warnings but doesn't prevent operation:
```
npm warn EBADENGINE Unsupported engine {
  package: 'redis@6.3.1',
  required: { node: '>= 20.0.0' },
  current: { node: 'v18.20.8' }
}
```

Consider upgrading Node in Dockerfiles if issues arise, though current setup works.

## Testing

Run the full workflow test:
```bash
# Terminal 1: Start services
docker-compose up --build

# Terminal 2: Create jobs and verify processing
npm run api:dev:job:create
npm run api:dev:job:create
npm run api:dev:jobs:list

# Check worker logs
docker-compose logs worker --tail 20
```

Expected output:
- Jobs are created successfully (201 response)
- Worker logs show jobs being dequeued and completed
- List jobs shows completed status for processed jobs
