const { getRedisClient, closeRedisClient } = require('../shared/redis');
const { updateJobStatus, retryJob } = require('../shared/queue');

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
 */
async function processDocument(documentId) {
  // TODO: Implement actual document processing logic
  console.log(`Processing document: ${documentId}`);
  // throw new Error('Document processing not implemented');
}

/**
 * Process a job with retry logic and exponential backoff
 * @param {Object} job - { id, documentId, retryCount }
 */
async function processWithRetry(job) {
  const maxRetries = 3;
  let retryCount = 0;
  let retryDelay = 1000; // Initial delay in milliseconds
  const maxRetryDelay = 30000; // 30 seconds

  while (retryCount < maxRetries) {
    try {
      const redis = await getRedisClient();
      const currentStatus = await redis.hGet(`job:${job.id}`, 'status');

      console.log(`[Job ${job.id}] Current status: ${currentStatus}`);

      if (currentStatus === 'completed') {
        console.log(`[Job ${job.id}] Already completed. Skipping.`);
        break;
      }

      // Mark as processing
      await updateJobStatus(job, 'processing');
      console.log(`[Job ${job.id}] Processing started`);

      // Process the document
      await processDocument(job.documentId);

      // Mark as completed
      await updateJobStatus(job, 'completed');
      console.log(`[Job ${job.id}] Completed successfully`);

      retryDelay = 1000; // Reset retry delay after success
      break;
    } catch (error) {
      console.error(
        `[Job ${job.id}] Error (retry ${retryCount + 1}/${maxRetries}):`,
        error.message
      );

      retryCount++;

      if (retryCount < maxRetries) {
        console.log(`[Job ${job.id}] Retrying in ${retryDelay}ms`);
        await sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
      } else {
        console.error(`[Job ${job.id}] Max retries exceeded. Marking as failed.`);
        try {
          await updateJobStatus(job, 'failed');
        } catch (statusError) {
          console.error(
            `[Job ${job.id}] Failed to update status to failed:`,
            statusError.message
          );
        }
      }
    }
  }
}

/**
 * Start the worker service
 * Polls the document-jobs queue and processes jobs
 */
async function startWorker() {
  console.log('Worker service started');

  const redis = await getRedisClient();

  while (true) {
    try {
      // Block and pop a job from the queue (0 means block indefinitely)
      const result = await redis.brPop('document-jobs', 0);

      if (!result) {
        console.log('No job received');
        continue;
      }

      const jobData = result[1];
      const job = JSON.parse(jobData);

      console.log(`\n[Job ${job.id}] Dequeued from queue`);

      // Process the job with retry logic
      await processWithRetry(job);
    } catch (error) {
      console.error('Worker error:', error.message);
      // Sleep before retrying the main loop
      await sleep(5000);
    }
  }
}

// Start the worker
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
