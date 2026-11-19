const test = require('node:test');
const assert = require('node:assert');

// Mock Redis client for testing
const mockRedisClient = {
  lPush: async () => 1,
  hSet: async () => 1,
  hGet: async (key, field) => {
    if (key === 'job:test-job-1') {
      return 'queued';
    }
    return null;
  },
};

// Mock getRedisClient to return our mock
let mockGetRedisClient = async () => mockRedisClient;

test('queue operations - enqueueJob structure', async () => {
  // This is a structural test that validates the module loads
  const queue = require('./queue');
  
  assert.strictEqual(typeof queue.enqueueJob, 'function');
  assert.strictEqual(typeof queue.getJobStatus, 'function');
  assert.strictEqual(typeof queue.updateJobStatus, 'function');
  assert.strictEqual(typeof queue.retryJob, 'function');
});
