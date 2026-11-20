#!/usr/bin/env node

/**
 * Helper script to create a job via the local dev API
 * Usage:
 *   npm run api:dev:job:create
 *   JOB_ID=custom-id npm run api:dev:job:create
 *   JOB_ID=custom-id DOC_ID=custom-doc npm run api:dev:job:create
 */

const http = require('http');

const jobId = process.env.JOB_ID || `job-${Date.now()}`;
const docId = process.env.DOC_ID || `doc-${Math.random().toString(36).substr(2, 9)}`;

const jobData = {
  id: jobId,
  documentId: docId,
};

const data = JSON.stringify(jobData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/jobs',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

console.log(`\n📋 Creating job:\n   ID: ${jobId}\n   Document: ${docId}\n`);

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log(`✅ Response (${res.statusCode}):\n`);
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(body);
    }
    console.log('');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:\n', error.message);
  console.error('\nMake sure the API is running: npm run api:dev\n');
  process.exit(1);
});

req.write(data);
req.end();
