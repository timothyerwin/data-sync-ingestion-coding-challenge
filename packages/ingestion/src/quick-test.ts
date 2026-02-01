import fetch from 'node-fetch';
import { config } from './config.js';

async function quickTest() {
  console.log('Testing API connection...');
  console.log('API Base URL:', config.apiBaseUrl);
  console.log('API Key:', config.apiKey ? '***' + config.apiKey.slice(-4) : 'NOT SET');
  console.log();

  if (!config.apiKey) {
    console.error('ERROR: TARGET_API_KEY not set in environment');
    process.exit(1);
  }

  try {
    // Test 1: Base endpoint
    console.log('1. Testing base endpoint...');
    const baseResponse = await fetch(config.apiBaseUrl, {
      headers: { 'X-API-Key': config.apiKey }
    });
    const baseData = await baseResponse.json();
    console.log('Response:', JSON.stringify(baseData, null, 2));
    console.log();

    // Test 2: Events endpoint
    console.log('2. Testing /events endpoint (limit=10)...');
    const eventsUrl = `${config.apiBaseUrl}/events?limit=10`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: { 'X-API-Key': config.apiKey }
    });

    // Check headers
    console.log('Response Headers:');
    console.log('  Status:', eventsResponse.status, eventsResponse.statusText);
    console.log('  Content-Type:', eventsResponse.headers.get('content-type'));
    console.log('  X-RateLimit-Limit:', eventsResponse.headers.get('x-ratelimit-limit'));
    console.log('  X-RateLimit-Remaining:', eventsResponse.headers.get('x-ratelimit-remaining'));
    console.log('  X-RateLimit-Reset:', eventsResponse.headers.get('x-ratelimit-reset'));
    
    // Show all headers
    console.log('\nAll response headers:');
    eventsResponse.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const eventsData = await eventsResponse.json() as any;
    console.log('\nResponse body:');
    console.log('  Events count:', eventsData.data?.length || 0);
    console.log('  Has more:', eventsData.hasMore);
    console.log('  Next cursor:', eventsData.nextCursor ? 'present' : 'none');
    console.log('  Cursor:', eventsData.cursor ? 'present' : 'none');
    
    if (eventsData.data && eventsData.data.length > 0) {
      console.log('\nFirst event sample:');
      console.log(JSON.stringify(eventsData.data[0], null, 2));
    }

    console.log('\n✓ API connection successful!');
    console.log('Ready to start ingestion.');
    
  } catch (error) {
    console.error('\n✗ API connection failed:', error);
    process.exit(1);
  }
}

quickTest();
