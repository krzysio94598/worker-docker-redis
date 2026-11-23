const redis = require('redis');

let client;

/**
 * Retry a Redis operation until it succeeds.
 * @param {() => Promise<*>} operation
 * @returns {Promise<*>}
 */
async function retryRedisOperation(operation) {
  let delayMs = 1000;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      console.error(
        `Redis operation failed; retrying in ${delayMs}ms:`,
        error.message
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30000);
    }
  }
}

/**
 * Get a shared Redis client. The client is created lazily and connected once.
 * @param {Object} options - Redis client options
 * @returns {Promise<Object>} - Redis client instance
 */
async function getRedisClient(options = {}) {
  if (!client) {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;

    const defaultOptions = {
      socket: {
        host: redisHost,
        port: redisPort,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return retries * 100;
        },
      },
      ...options,
    };

    client = redis.createClient(defaultOptions);

    client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    client.on('connect', () => {
      console.log(`Connected to Redis at ${redisHost}:${redisPort}`);
    });
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

/**
 * Close the Redis client connection
 */
async function closeRedisClient() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = undefined;
}

/**
 * Check Redis connection status
 * @returns {Promise<boolean>}
 */
async function isRedisConnected() {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  retryRedisOperation,
  getRedisClient,
  closeRedisClient,
  isRedisConnected,
};
