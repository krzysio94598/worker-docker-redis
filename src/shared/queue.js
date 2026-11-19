const { getRedisClient } = require('./redis');

/**
 * Enqueue a job to the document-jobs queue
 * @param {Object} job - { id, documentId }
 */
async function enqueueJob(job) {
  const redis = await getRedisClient();
  await redis.lPush('document-jobs', JSON.stringify(job));
  await redis.hSet(`job:${job.id}`, 'status', 'queued');
}

/**
 * Get the status of a job
 * @param {string|number} jobId
 * @returns {Promise<string|null>}
 */
async function getJobStatus(jobId) {
  const redis = await getRedisClient();
  return redis.hGet(`job:${jobId}`, 'status');
}

/**
 * Update job status in Redis
 * @param {Object} job - { id, documentId }
 * @param {string} status - 'queued', 'processing', 'completed', 'failed'
 */
async function updateJobStatus(job, status) {
  const redis = await getRedisClient();
  await redis.hSet(`job:${job.id}`, 'status', status);
}

/**
 * Retry a job by re-enqueueing it
 * @param {Object} job - { id, documentId, retryCount }
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 */
async function retryJob(job, maxRetries = 3) {
  const retryCount = job.retryCount || 0;

  if (retryCount < maxRetries) {
    job.retryCount = retryCount + 1;
    const redis = await getRedisClient();
    await redis.lPush('document-jobs', JSON.stringify(job));
  } else {
    await updateJobStatus(job, 'failed');
  }
}

module.exports = {
  enqueueJob,
  getJobStatus,
  updateJobStatus,
  retryJob,
};
