const test = require('node:test');
const assert = require('node:assert');

// Test that redis module loads correctly
test('redis module - exports required functions', () => {
  const redis = require('./redis');
  
  assert.strictEqual(typeof redis.retryRedisOperation, 'function');
  assert.strictEqual(typeof redis.getRedisClient, 'function');
  assert.strictEqual(typeof redis.closeRedisClient, 'function');
  assert.strictEqual(typeof redis.isRedisConnected, 'function');
});

test('retryRedisOperation returns a successful result', async () => {
  const { retryRedisOperation } = require('./redis');

  const result = await retryRedisOperation(async () => 'completed');

  assert.strictEqual(result, 'completed');
});

test('retryRedisOperation retries with capped exponential backoff', async () => {
  const { retryRedisOperation } = require('./redis');
  const originalSetTimeout = global.setTimeout;
  const originalConsoleError = console.error;
  const delays = [];
  let attempts = 0;

  global.setTimeout = (callback, delayMs) => {
    delays.push(delayMs);
    callback();
    return {};
  };
  console.error = () => {};

  try {
    const result = await retryRedisOperation(async () => {
      attempts++;
      if (attempts <= 7) {
        throw new Error('temporary Redis failure');
      }
      return 'recovered';
    });

    assert.strictEqual(result, 'recovered');
    assert.strictEqual(attempts, 8);
    assert.deepStrictEqual(
      delays,
      [1000, 2000, 4000, 8000, 16000, 30000, 30000]
    );
  } finally {
    global.setTimeout = originalSetTimeout;
    console.error = originalConsoleError;
  }
});
