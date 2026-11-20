#!/usr/bin/env node

/**
 * Migration script to re-enqueue jobs that only have status stored
 * but not in the queue list
 */

const { getRedisClient } = require('../src/shared/redis');

async function migrateJobs() {
  try {
    const redis = await getRedisClient();
    
    console.log('🔄 Migrating jobs to queue...\n');
    
    // Get all job keys
    const jobKeys = await redis.keys('job:*');
    console.log(`Found ${jobKeys.length} jobs with status`);
    
    if (jobKeys.length === 0) {
      console.log('No jobs to migrate.');
      await redis.quit();
      return;
    }
    
    // Check current queue length
    const currentQueueLen = await redis.lLen('document-jobs');
    console.log(`Current queue length: ${currentQueueLen}\n`);
    
    // Re-enqueue each job
    let enqueued = 0;
    for (const key of jobKeys) {
      const jobId = key.replace('job:', '');
      const status = await redis.hGet(key, 'status');
      
      // Only re-enqueue if status is 'queued' or 'processing'
      if (status === 'queued' || status === 'processing') {
        const job = { id: jobId, documentId: `doc-${jobId}` };
        await redis.lPush('document-jobs', JSON.stringify(job));
        console.log(`✅ Re-enqueued: ${jobId}`);
        enqueued++;
      } else {
        console.log(`⏭️  Skipped (${status}): ${jobId}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Re-enqueued: ${enqueued} jobs`);
    
    const newQueueLen = await redis.lLen('document-jobs');
    console.log(`   New queue length: ${newQueueLen}\n`);
    
    await redis.quit();
    console.log('✨ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrateJobs();
