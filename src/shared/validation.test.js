const test = require('node:test');
const assert = require('node:assert');
const { validateJob, isValidStatus } = require('./validation');

test('validateJob - valid job', () => {
  const job = { id: '123', documentId: 'doc-456' };
  const result = validateJob(job);
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
});

test('validateJob - missing id', () => {
  const job = { documentId: 'doc-456' };
  const result = validateJob(job);
  assert.strictEqual(result.valid, false);
  assert.match(result.errors[0], /id/i);
});

test('validateJob - missing documentId', () => {
  const job = { id: '123' };
  const result = validateJob(job);
  assert.strictEqual(result.valid, false);
  assert.match(result.errors[0], /documentId/i);
});

test('validateJob - invalid id type', () => {
  const job = { id: {}, documentId: 'doc-456' };
  const result = validateJob(job);
  assert.strictEqual(result.valid, false);
  assert.match(result.errors[0], /id.*string or number/i);
});

test('validateJob - not an object', () => {
  const result = validateJob('not-a-job');
  assert.strictEqual(result.valid, false);
  assert.match(result.errors[0], /must be an object/i);
});

test('isValidStatus - valid statuses', () => {
  assert.strictEqual(isValidStatus('queued'), true);
  assert.strictEqual(isValidStatus('processing'), true);
  assert.strictEqual(isValidStatus('completed'), true);
  assert.strictEqual(isValidStatus('failed'), true);
});

test('isValidStatus - invalid status', () => {
  assert.strictEqual(isValidStatus('invalid'), false);
  assert.strictEqual(isValidStatus('pending'), false);
  assert.strictEqual(isValidStatus(''), false);
});
