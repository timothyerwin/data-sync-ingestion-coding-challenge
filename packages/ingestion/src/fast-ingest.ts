import dotenv from 'dotenv';
import { resolve } from 'path';

// Load env FIRST before any imports
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { ApiClient } from './api.js';
import { Database } from './database.js';
import { config } from './config.js';

async function fastIngest() {
  const db = new Database();
  await db.initialize();
  
  const headerApi = new ApiClient(false);  // 10 req/min
  const queryApi = new ApiClient(true);     // 5 req/min
  
  let cursor: string | null = null;
  let totalIngested = 0;
  const startTime = Date.now();
  let batchNumber = 0;
  
  while (true) {
    batchNumber++;
    const batchStart = Date.now();
    console.log(`\n=== Batch ${batchNumber} starting ===`);
    
    // Make 15 requests in parallel: 10 with header auth, 5 with query auth
    const requests = [
      ...Array(10).fill(0).map(() => headerApi.fetchEvents(cursor, 5000)),
      ...Array(5).fill(0).map(() => queryApi.fetchEvents(cursor, 5000))
    ];
    
    try {
      const results = await Promise.all(requests);
      
      // Process all results
      const allEvents = results.flatMap(r => r.response.data);
      console.log(`Fetched ${allEvents.length} events from ${results.length} requests`);
      
      // Insert to database
      const inserted = await db.batchInsert(allEvents);
      totalIngested += inserted;
      
      // Update cursor from first result
      cursor = results[0].response.nextCursor || null;
      const hasMore = results[0].response.hasMore;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalIngested / elapsed;
      console.log(`Total: ${totalIngested.toLocaleString()} events | ${rate.toFixed(0)} events/sec`);
      
      if (!hasMore || totalIngested >= 3000000) {
        console.log('\n=== INGESTION COMPLETE ===');
        console.log(`Total events: ${totalIngested.toLocaleString()}`);
        console.log(`Time: ${(elapsed / 60).toFixed(1)} minutes`);
        break;
      }
      
      // Wait until next minute mark
      const batchElapsed = Date.now() - batchStart;
      const waitTime = Math.max(0, 60000 - batchElapsed);
      if (waitTime > 0) {
        console.log(`Waiting ${(waitTime / 1000).toFixed(1)}s for rate limit reset...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000)); // Add 1s buffer
      }
      
    } catch (error) {
      console.error('Batch error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  await db.close();
}

fastIngest().catch(console.error);
