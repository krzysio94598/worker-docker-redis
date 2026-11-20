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
        const pushResult = await redis.lPush('document-jobs', JSON.stringify(job));
        console.log(`✅ Re-enqueued: ${jobId} (list len now: ${pushResult})`);
        enqueued++;
      } else {
        console.log(`⏭️  Skipped (${status}): ${jobId}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Re-enqueued: ${enqueued} jobs`);
    
    // Check queue length multiple times to verify
    let queueLen = await redis.lLen('document-jobs');
    console.log(`   Queue length (immediate): ${queueLen}`);
    
    // Double check by listing items
    const items = await redis.lRange('document-jobs', 0, -1);
    console.log(`   Items in queue (by range): ${items.length}`);
    
    if (items.length > 0) {
      console.log('\n   Queue contents:');
      items.forEach((item, i) => {
        const job = JSON.parse(item);
        console.log(`     [\${i}] ${job.id}`);
      });
    }
    
    console.log('');
    
    await redis.quit();
    console.log('✨ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateJobs();

