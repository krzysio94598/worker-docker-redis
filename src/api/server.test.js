const test = require('node:test');
const assert = require('node:assert');

// Test that API server loads correctly
test('api server - module loads and is an Express app', () => {
  const app = require('./server');
  
  assert.strictEqual(typeof app, 'function');
  assert.strictEqual(typeof app.get, 'function');
  assert.strictEqual(typeof app.post, 'function');
});
