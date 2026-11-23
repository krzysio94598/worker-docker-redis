const crypto = require('crypto');

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

function createIdempotencyKey(job) {
  const jobId = encodeURIComponent(String(job.id));
  const documentId = encodeURIComponent(String(job.documentId));
  return `idempotency:process-document:${jobId}:${documentId}`;
}

async function claimIdempotencyKey(
  redis,
  job,
  leaseMs = DEFAULT_LEASE_MS,
  ownerToken = crypto.randomUUID()
) {
  const key = createIdempotencyKey(job);
  const claimedAt = new Date().toISOString();
  const record = {
    state: 'processing',
    jobId: job.id,
    documentId: job.documentId,
    ownerToken,
    claimedAt,
  };

  const result = await redis.set(key, JSON.stringify(record), {
    NX: true,
    PX: leaseMs,
  });

  if (result === 'OK') {
    return { acquired: true, state: 'processing', key, ownerToken };
  }

  const existingValue = await redis.get(key);
  if (!existingValue) {
    return claimIdempotencyKey(redis, job, leaseMs);
  }

  const existing = JSON.parse(existingValue);
  if (existing.state === 'processing' && existing.ownerToken === ownerToken) {
    return { acquired: true, state: 'processing', key, ownerToken };
  }

  return {
    acquired: false,
    state: existing.state,
    key,
    ownerToken: null,
  };
}

async function completeIdempotencyKey(redis, claim) {
  const result = await redis.eval(
    `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return 0
      end

      local record = cjson.decode(current)
      if record.ownerToken ~= ARGV[1] then
        return -1
      end

      record.state = 'completed'
      record.completedAt = ARGV[2]
      redis.call('SET', KEYS[1], cjson.encode(record))
      return 1
    `,
    {
      keys: [claim.key],
      arguments: [claim.ownerToken, new Date().toISOString()],
    }
  );

  if (result !== 1) {
    throw new Error(`Unable to complete idempotency key: ${claim.key}`);
  }
}

async function releaseIdempotencyKey(redis, claim) {
  const result = await redis.eval(
    `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return 0
      end

      local record = cjson.decode(current)
      if record.ownerToken ~= ARGV[1] then
        return -1
      end

      return redis.call('DEL', KEYS[1])
    `,
    {
      keys: [claim.key],
      arguments: [claim.ownerToken],
    }
  );

  if (result === 0) {
    return;
  }

  if (result !== 1) {
    throw new Error(`Unable to release idempotency key: ${claim.key}`);
  }
}

module.exports = {
  createIdempotencyKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
};
