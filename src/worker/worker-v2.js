const {
  getRedisClient,
  closeRedisClient,
  retryRedisOperation,
} = require('../shared/redis');
const { retryJob } = require('../shared/queue');

const QUEUE_NAME = 'document-jobs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processDocument(documentId) {
  console.log(`Processing document: ${documentId}`);
}

async function processJob(job) {
  await retryRedisOperation(async () => {
    const redis = await getRedisClient();
    return redis.hSet(`job:${job.id}`, 'status', 'processing');
  });

  try {
    await processDocument(job.documentId);
  } catch (error) {
    const retryDelay = Math.min(
      1000 * (2 ** (job.retryCount || 0)),
      30000
    );

    console.error(
      `[Job ${job.id}] Error during processing:`,
      error.message
    );
    console.log(`[Job ${job.id}] Retrying in ${retryDelay}ms`);
    await sleep(retryDelay);
    await retryRedisOperation(() => retryJob({ ...job }));
    return;
  }

  await retryRedisOperation(async () => {
    const redis = await getRedisClient();
    return redis.hSet(`job:${job.id}`, 'status', 'completed');
  });
  console.log(`[Job ${job.id}] Completed successfully`);
}

async function startWorker() {
  console.log('Worker started');

  while (true) {
    const result = await retryRedisOperation(async () => {
      const redis = await getRedisClient();
      return redis.brPop(QUEUE_NAME, 0);
    });

    if (!result) {
      continue;
    }

    const job = JSON.parse(result.element);
    await processJob(job);
  }
}

if (require.main === module) {
  startWorker().catch(async (error) => {
    console.error('Fatal worker error:', error);
    await closeRedisClient();
    process.exit(1);
  });
}

module.exports = {
  processJob,
  startWorker,
};
