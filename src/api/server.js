const express = require('express');
const { validateJob } = require('../shared/validation');
const { enqueueJob, getJobStatus, getAllJobs } = require('../shared/queue');
const { isRedisConnected } = require('../shared/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const redisConnected = await isRedisConnected();

  if (redisConnected) {
    res.status(200).json({ status: 'ok', redis: 'connected' });
  } else {
    res.status(503).json({ status: 'error', redis: 'disconnected' });
  }
});

/**
 * Ready check endpoint
 */
app.get('/ready', async (req, res) => {
  const redisConnected = await isRedisConnected();

  if (redisConnected) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Redis not connected' });
  }
});

/**
 * Enqueue a new job
 * POST /jobs
 * Body: { id, documentId }
 */
app.post('/jobs', async (req, res) => {
  try {
    const job = req.body;

    // Validate job
    const validation = validateJob(job);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid job',
        details: validation.errors,
      });
    }

    // Enqueue the job
    await enqueueJob(job);

    res.status(201).json({
      message: 'Job enqueued successfully',
      job,
    });
  } catch (error) {
    console.error('Error enqueueing job:', error.message);
    res.status(500).json({
      error: 'Failed to enqueue job',
      message: error.message,
    });
  }
});

/**
 * Get all jobs
 * GET /jobs
 */
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await getAllJobs();
    res.status(200).json({
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error('Error getting jobs:', error.message);
    res.status(500).json({
      error: 'Failed to get jobs',
      message: error.message,
    });
  }
});

/**
 * Get job status
 * GET /jobs/:jobId
 */
app.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);

    if (status === null) {
      return res.status(404).json({
        error: 'Job not found',
        jobId,
      });
    }

    res.status(200).json({
      jobId,
      status,
    });
  } catch (error) {
    console.error('Error getting job status:', error.message);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message,
    });
  }
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Job Queue API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      ready: 'GET /ready',
      listJobs: 'GET /jobs',
      enqueueJob: 'POST /jobs',
      getJobStatus: 'GET /jobs/:jobId',
    },
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server only if this module is run directly (not imported for testing)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

module.exports = app;
