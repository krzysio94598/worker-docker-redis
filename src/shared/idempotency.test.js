const test = require('node:test');
const assert = require('node:assert');
const {
  createIdempotencyKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} = require('./idempotency');

function createRedisMock() {
  const records = new Map();

  return {
    records,
    set: async (key, value, options) => {
      if (options.NX && records.has(key)) {
        return null;
      }
      records.set(key, value);
      return 'OK';
    },
    get: async key => records.get(key) || null,
    eval: async (script, options) => {
      const current = records.get(options.keys[0]);
      if (!current) return 0;

      const record = JSON.parse(current);
      if (record.ownerToken !== options.arguments[0]) return -1;

      if (script.includes("record.state = 'completed'")) {
        record.state = 'completed';
        record.completedAt = options.arguments[1];
        records.set(options.keys[0], JSON.stringify(record));
        return 1;
      }

      records.delete(options.keys[0]);
      return 1;
    },
  };
}

test('createIdempotencyKey identifies a document operation', () => {
  assert.strictEqual(
    createIdempotencyKey({ id: 'job 1', documentId: 'doc/1' }),
    'idempotency:process-document:job%201:doc%2F1'
  );
});

test('claimIdempotencyKey only allows one concurrent owner', async () => {
  const redis = createRedisMock();
  const job = { id: 'job-1', documentId: 'doc-1' };

  const first = await claimIdempotencyKey(redis, job);
  const duplicate = await claimIdempotencyKey(redis, job);

  assert.strictEqual(first.acquired, true);
  assert.strictEqual(first.state, 'processing');
  assert.strictEqual(duplicate.acquired, false);
  assert.strictEqual(duplicate.state, 'processing');
});

test('claimIdempotencyKey safely retries with the same owner token', async () => {
  const redis = createRedisMock();
  const job = { id: 'job-1', documentId: 'doc-1' };
  const ownerToken = 'stable-owner-token';

  const first = await claimIdempotencyKey(
    redis,
    job,
    undefined,
    ownerToken
  );
  const retry = await claimIdempotencyKey(
    redis,
    job,
    undefined,
    ownerToken
  );

  assert.strictEqual(first.acquired, true);
  assert.strictEqual(retry.acquired, true);
  assert.strictEqual(retry.ownerToken, ownerToken);
});

test('completeIdempotencyKey retains a completed record', async () => {
  const redis = createRedisMock();
  const claim = await claimIdempotencyKey(
    redis,
    { id: 'job-1', documentId: 'doc-1' }
  );

  await completeIdempotencyKey(redis, claim);
  const record = JSON.parse(redis.records.get(claim.key));

  assert.strictEqual(record.state, 'completed');
  assert.ok(record.completedAt);
});

test('releaseIdempotencyKey permits a controlled retry', async () => {
  const redis = createRedisMock();
  const job = { id: 'job-1', documentId: 'doc-1' };
  const claim = await claimIdempotencyKey(redis, job);

  await releaseIdempotencyKey(redis, claim);
  const retry = await claimIdempotencyKey(redis, job);

  assert.strictEqual(retry.acquired, true);
});

test('only the claim owner can complete a key', async () => {
  const redis = createRedisMock();
  const claim = await claimIdempotencyKey(
    redis,
    { id: 'job-1', documentId: 'doc-1' }
  );

  await assert.rejects(
    completeIdempotencyKey(redis, { ...claim, ownerToken: 'wrong-owner' }),
    /Unable to complete idempotency key/
  );
});
