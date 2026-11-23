const test = require('node:test');
const assert = require('node:assert');
const { parseJobPayload, deadLetterInvalidJob } = require('./worker');

test('parseJobPayload parses a valid job', () => {
  assert.deepStrictEqual(
    parseJobPayload('{"id":"job-1","documentId":"doc-1"}'),
    { id: 'job-1', documentId: 'doc-1' }
  );
});

test('parseJobPayload rejects non-JSON payloads', () => {
  assert.throws(
    () => parseJobPayload('item1'),
    /Invalid JSON/
  );
});

test('parseJobPayload rejects invalid job objects', () => {
  assert.throws(
    () => parseJobPayload('{"id":"job-1"}'),
    /Invalid job: Job must have a documentId/
  );
});

test('deadLetterInvalidJob preserves malformed payload details', async () => {
  let pushed;
  const redis = {
    lPush: async (queue, value) => {
      pushed = { queue, value: JSON.parse(value) };
    },
  };

  await deadLetterInvalidJob(redis, 'item1', new Error('Invalid JSON'));

  assert.strictEqual(pushed.queue, 'document-jobs:invalid');
  assert.strictEqual(pushed.value.payload, 'item1');
  assert.strictEqual(pushed.value.error, 'Invalid JSON');
  assert.match(pushed.value.receivedAt, /^\d{4}-\d{2}-\d{2}T/);
});
