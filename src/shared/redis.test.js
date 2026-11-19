const test = require('node:test');
const assert = require('node:assert');

// Test that redis module loads correctly
test('redis module - exports required functions', () => {
  const redis = require('./redis');
  
  assert.strictEqual(typeof redis.getRedisClient, 'function');
  assert.strictEqual(typeof redis.closeRedisClient, 'function');
  assert.strictEqual(typeof redis.isRedisConnected, 'function');
});
