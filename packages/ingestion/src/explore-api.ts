import fetch from 'node-fetch';
import { config } from './config.js';

interface TestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
}

async function exploreAPI() {
  const results: TestResult[] = [];
  
  console.log('='.repeat(60));
  console.log('DataSync API Explorer');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Base API endpoint
  console.log('1. Testing base API endpoint...');
  try {
    const response = await fetch(config.apiBaseUrl, {
      headers: { 'X-API-Key': config.apiKey }
    });
    const data = await response.json();
    results.push({
      test: 'Base API',
      success: true,
      data
    });
    console.log('✓ Success:', JSON.stringify(data, null, 2));
  } catch (error) {
    results.push({
      test: 'Base API',
      success: false,
      error: String(error)
    });
    console.log('✗ Failed:', error);
  }
  console.log();

  // Test 2: Events endpoint with different limits
  for (const limit of [100, 1000, 5000, 10000]) {
    console.log(`2. Testing events endpoint with limit=${limit}...`);
    try {
      const url = `${config.apiBaseUrl}/events?limit=${limit}`;
      const startTime = Date.now();
      const response = await fetch(url, {
        headers: { 'X-API-Key': config.apiKey }
      });
      const elapsed = Date.now() - startTime;
      
      const data = await response.json() as any;
      
      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');
      const rateLimitLimit = response.headers.get('x-ratelimit-limit');
      
      results.push({
        test: `Events (limit=${limit})`,
        success: true,
        data: {
          eventCount: data.data?.length || 0,
          hasMore: data.hasMore,
          hasCursor: !!data.nextCursor || !!data.cursor,
          responseTime: elapsed,
          rateLimit: {
            limit: rateLimitLimit,
            remaining: rateLimitRemaining,
            reset: rateLimitReset
          }
        }
      });
      
      console.log(`✓ Success:`);
      console.log(`  - Events received: ${data.data?.length || 0}`);
      console.log(`  - Has more: ${data.hasMore}`);
      console.log(`  - Response time: ${elapsed}ms`);
      console.log(`  - Rate limit: ${rateLimitRemaining}/${rateLimitLimit}`);
      console.log(`  - Rate limit reset: ${rateLimitReset}`);
    } catch (error) {
      results.push({
        test: `Events (limit=${limit})`,
        success: false,
        error: String(error)
      });
      console.log('✗ Failed:', error);
    }
    console.log();
  }

  // Test 3: Sessions endpoint
  console.log('3. Testing sessions endpoint...');
  try {
    const response = await fetch(`${config.apiBaseUrl}/sessions`, {
      headers: { 'X-API-Key': config.apiKey }
    });
    const data = await response.json();
    results.push({
      test: 'Sessions endpoint',
      success: true,
      data
    });
    console.log('✓ Success:', JSON.stringify(data, null, 2));
  } catch (error) {
    results.push({
      test: 'Sessions endpoint',
      success: false,
      error: String(error)
    });
    console.log('✗ Failed:', error);
  }
  console.log();

  // Test 4: Metrics endpoint
  console.log('4. Testing metrics endpoint...');
  try {
    const response = await fetch(`${config.apiBaseUrl}/metrics`, {
      headers: { 'X-API-Key': config.apiKey }
    });
    const data = await response.json();
    results.push({
      test: 'Metrics endpoint',
      success: true,
      data
    });
    console.log('✓ Success:', JSON.stringify(data, null, 2));
  } catch (error) {
    results.push({
      test: 'Metrics endpoint',
      success: false,
      error: String(error)
    });
    console.log('✗ Failed:', error);
  }
  console.log();

  // Test 5: Concurrent requests
  console.log('5. Testing concurrent requests (5 parallel)...');
  try {
    const startTime = Date.now();
    const promises = Array(5).fill(0).map(() =>
      fetch(`${config.apiBaseUrl}/events?limit=100`, {
        headers: { 'X-API-Key': config.apiKey }
      })
    );
    const responses = await Promise.all(promises);
    const elapsed = Date.now() - startTime;
    
    results.push({
      test: 'Concurrent requests (5)',
      success: true,
      data: {
        totalTime: elapsed,
        avgTime: elapsed / 5,
        allSuccessful: responses.every(r => r.ok)
      }
    });
    
    console.log(`✓ Success:`);
    console.log(`  - Total time: ${elapsed}ms`);
    console.log(`  - Avg per request: ${(elapsed / 5).toFixed(0)}ms`);
    console.log(`  - All successful: ${responses.every(r => r.ok)}`);
  } catch (error) {
    results.push({
      test: 'Concurrent requests (5)',
      success: false,
      error: String(error)
    });
    console.log('✗ Failed:', error);
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log();

  console.log('Recommendations:');
  const eventsTests = results.filter(r => r.test.startsWith('Events (limit='));
  if (eventsTests.length > 0) {
    const maxLimit = eventsTests
      .filter(r => r.success)
      .reduce((max, r) => {
        const limit = parseInt(r.test.match(/\d+/)?.[0] || '0');
        return limit > max ? limit : max;
      }, 0);
    console.log(`- Maximum working limit: ${maxLimit}`);
    
    const bestTest = eventsTests
      .filter(r => r.success)
      .sort((a, b) => {
        const aSpeed = (a.data?.eventCount || 0) / (a.data?.responseTime || 1);
        const bSpeed = (b.data?.eventCount || 0) / (b.data?.responseTime || 1);
        return bSpeed - aSpeed;
      })[0];
    
    if (bestTest) {
      const limit = parseInt(bestTest.test.match(/\d+/)?.[0] || '0');
      console.log(`- Optimal limit for throughput: ${limit}`);
    }
  }

  const sessionsTest = results.find(r => r.test === 'Sessions endpoint');
  if (sessionsTest?.success) {
    console.log('- Sessions endpoint is available - explore for bulk access');
  }

  const metricsTest = results.find(r => r.test === 'Metrics endpoint');
  if (metricsTest?.success) {
    console.log('- Metrics endpoint is available - use for progress tracking');
  }
}

exploreAPI().catch(console.error);
