const crypto = require('crypto');
const {
  getRedisClient,
  closeRedisClient,
  retryRedisOperation,
} = require('../shared/redis');
const { updateJobStatus, retryJob } = require('../shared/queue');
const { validateJob } = require('../shared/validation');
const {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} = require('../shared/idempotency');

const QUEUE_NAME = 'document-jobs';
const DEAD_LETTER_QUEUE_NAME = `${QUEUE_NAME}:invalid`;

async function retryWorkerRedisOperation(operation) {
  return retryRedisOperation(async () => {
    const redis = await getRedisClient();
    return operation(redis);
  });
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a document (placeholder)
 * Replace this with your actual document processing logic
 * @param {string|number} documentId
 * @param {string} idempotencyKey
 */
async function processDocument(documentId, idempotencyKey) {
  // TODO: Implement actual document processing logic
  console.log(`Processing document: ${documentId} (idempotency key: ${idempotencyKey})`);
  // throw new Error('Document processing not implemented');
}

/**
 * Process a job with exponential backoff
 * @param {Object} job - { id, documentId, retryCount }
 */
async function processWithRetry(job) {
  const retryDelay = Math.min(
    1000 * (2 ** (job.retryCount || 0)),
    30000
  );

  const currentStatus = await retryWorkerRedisOperation(
    redis => redis.hGet(`job:${job.id}`, 'status')
  );

  console.log(`[Job ${job.id}] Current status: ${currentStatus}`);

  if (currentStatus === 'completed') {
    console.log(`[Job ${job.id}] Already completed. Skipping.`);
    return;
  }

  const claimOwnerToken = crypto.randomUUID();
  const claim = await retryWorkerRedisOperation(redis => claimIdempotencyKey(
    redis,
    job,
    undefined,
    claimOwnerToken
  ));
  if (!claim.acquired) {
    console.log(
      `[Job ${job.id}] Idempotency key is already ${claim.state}. Skipping duplicate.`
    );

    if (claim.state === 'completed') {
      await retryRedisOperation(() => updateJobStatus(job, 'completed'));
    }
    return;
  }

  await retryRedisOperation(() => updateJobStatus(job, 'processing'));
  console.log(`[Job ${job.id}] Processing started`);

  try {
    await processDocument(job.documentId, claim.key);
  } catch (error) {
    await retryWorkerRedisOperation(
      redis => releaseIdempotencyKey(redis, claim)
    );
    console.error(`[Job ${job.id}] Error during processing:`, error.message);
    console.log(`[Job ${job.id}] Retrying in ${retryDelay}ms`);
    await sleep(retryDelay);
    await retryRedisOperation(() => retryJob({ ...job }));
    return;
  }

  await retryWorkerRedisOperation(
    redis => completeIdempotencyKey(redis, claim)
  );
  await retryRedisOperation(() => updateJobStatus(job, 'completed'));
  console.log(`[Job ${job.id}] Completed successfully`);
}

function parseJobPayload(jobData) {
  let job;

  try {
    job = JSON.parse(jobData);
  } catch (error) {
    throw new Error(`Invalid JSON (${error.message})`);
  }

  const validation = validateJob(job);
  if (!validation.valid) {
    throw new Error(`Invalid job: ${validation.errors.join(', ')}`);
  }

  return job;
}

async function deadLetterInvalidJob(redis, jobData, error) {
  await redis.lPush(DEAD_LETTER_QUEUE_NAME, JSON.stringify({
    payload: jobData,
    error: error.message,
    receivedAt: new Date().toISOString(),
  }));
}

/**
 * Start the worker service
 * Polls the document-jobs queue and processes jobs
 */
async function startWorker() {
  console.log('Worker service started');

  while (true) {
    // Block and pop a job from the queue (0 means block indefinitely)
    const result = await retryWorkerRedisOperation(
      redis => redis.brPop(QUEUE_NAME, 0)
    );

    if (!result) {
      console.log('No job received');
      continue;
    }

    const jobData = result.element;

    if (!jobData) {
      console.error('❌ Received null/undefined job data from queue');
      continue;
    }

    let job;
    try {
      job = parseJobPayload(jobData);
    } catch (error) {
      console.error(`❌ Discarding invalid job payload: ${jobData}`);
      console.error(`   Error: ${error.message}`);
      await retryWorkerRedisOperation(
        redis => deadLetterInvalidJob(redis, jobData, error)
      );
      continue;
    }

    console.log(`\n[Job ${job.id}] Dequeued from queue`);

    await processWithRetry(job);
  }
}

// Start the worker
if (require.main === module) {
  startWorker().catch(async (error) => {
    console.error('Fatal worker error:', error);
    await closeRedisClient();
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received, shutting down gracefully');
    await closeRedisClient();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully');
    await closeRedisClient();
    process.exit(0);
  });
}

module.exports = {
  parseJobPayload,
  deadLetterInvalidJob,
  processWithRetry,
};
