#!/usr/bin/env node

/**
 * Helper script to list all jobs via the local dev API
 * Usage:
 *   npm run api:dev:jobs:list
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/jobs',
  method: 'GET',
};

console.log('\n📋 Fetching all jobs...\n');

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log(`✅ Response (${res.statusCode}):\n`);
    try {
      const parsed = JSON.parse(body);
      
      if (parsed.jobs && parsed.jobs.length > 0) {
        console.log(`Total: ${parsed.count} job(s)\n`);
        
        // Group by status
        const byStatus = {};
        parsed.jobs.forEach(job => {
          if (!byStatus[job.status]) {
            byStatus[job.status] = [];
          }
          byStatus[job.status].push(job);
        });
        
        // Display by status
        const statuses = ['queued', 'processing', 'completed', 'failed'];
        statuses.forEach(status => {
          if (byStatus[status]) {
            console.log(`📌 ${status.toUpperCase()} (${byStatus[status].length}):`);
            byStatus[status].forEach(job => {
              console.log(`   - ${job.id}`);
            });
            console.log('');
          }
        });
      } else {
        console.log('No jobs found.\n');
      }
    } catch {
      console.log(body);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:\n', error.message);
  console.error('\nMake sure the API is running: npm run api:dev\n');
  process.exit(1);
});

req.end();
