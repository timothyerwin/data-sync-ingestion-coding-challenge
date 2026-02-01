// Simple, reliable ingestion with header auth only (10 req/min)
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { ApiClient } from './api.js';
import { Database } from './database.js';

async function ingest() {
  const api = new ApiClient(false); // Header auth only
  const db = new Database();
  await db.initialize();
  
  let cursor: string | null = null;
  let totalIngested = 0;
  const startTime = Date.now();
  
  while (totalIngested < 3000000) {
    try {
      const { response } = await api.fetchEvents(cursor, 5000);
      
      await db.batchInsert(response.data);
      totalIngested += response.data.length;
      cursor = response.nextCursor || null;
      
      if (totalIngested % 50000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        console.log(`${totalIngested.toLocaleString()} | ${elapsed.toFixed(1)}min | ${(totalIngested / elapsed / 1000).toFixed(1)}k/min`);
      }
      
      if (!response.hasMore) break;
      
      await new Promise(r => setTimeout(r, 6100)); // 10 req/min = 6s between requests
    } catch (error: any) {
      if (error.message?.includes('RATE_LIMIT')) {
        await new Promise(r => setTimeout(r, 60000));
      } else {
        console.error('Error:', error.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  
  console.log(`\nDONE: ${totalIngested.toLocaleString()} events in ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);
  await db.close();
}

ingest();
