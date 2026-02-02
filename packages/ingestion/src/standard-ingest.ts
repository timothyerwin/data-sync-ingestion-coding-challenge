import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { Database } from './database.js';
import { config } from './config.js';
import { StateManager } from './state.js';

async function go() {
  const db = new Database();
  await db.initialize();

  const state = new StateManager();
  const savedState = state.getState();
  
  let cursor: string | null = savedState.cursor;
  let total = savedState.eventsIngested;
  let hasMore = true;
  let apiTotal: number | null = null;
  const start = Date.now();
  
  if (total > 0) {
    console.log(`Resuming from ${total.toLocaleString()} events already ingested`);
  }
  console.log('Starting ingestion...\n');

  while (hasMore) {
    const url = new URL(`${config.apiBaseUrl}/events`);
    url.searchParams.set('limit', '5000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': config.apiKey
      }
    });

    if (res.status === 429) {
      const data = await res.json() as any;
      const retryAfter = data.rateLimit?.retryAfter || 60;
      console.log(`\nRate limited, waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, (retryAfter + 1) * 1000));
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`\nHTTP ${res.status}: ${errorText.substring(0, 200)}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const json = await res.json() as any;
    const events = json.data || [];

    if (apiTotal === null && json.meta?.total) {
      apiTotal = json.meta.total as number;
      console.log(`API reports ${apiTotal.toLocaleString()} total events\n`);
    }

    if (events.length > 0) {
      const inserted = await db.batchInsert(events);
      total += inserted;
    }

    cursor = json.pagination?.nextCursor || null;
    hasMore = json.pagination?.hasMore || false;
    
    if (total % 5000 === 0) {
      state.updateState({
        cursor,
        cursorCreatedAt: cursor ? new Date().toISOString() : null,
        eventsIngested: total,
        status: 'running'
      });
    }

    const elapsed = (Date.now() - start) / 1000;
    const rate = total / elapsed;
    const target = apiTotal || 3000000;
    const eta = (target - total) / rate / 60;
    process.stdout.write(`\r${total.toLocaleString()} / ${(target / 1000000).toFixed(1)}M | ${rate.toFixed(0)} ev/s | ETA: ${eta.toFixed(1)} min   `);

    if (!hasMore) {
      console.log('\n\nReached end of data (hasMore=false)');
      break;
    }

    // Rate limit: 10 req/min = wait 6 seconds between requests
    await new Promise(r => setTimeout(r, 6000));
  }

  const totalTime = ((Date.now() - start) / 60000).toFixed(2);
  console.log(`\n\nDONE: ${total.toLocaleString()} events in ${totalTime} minutes`);
  if (apiTotal && total !== apiTotal) {
    console.warn(`WARNING: Ingested ${total} but API reported ${apiTotal!} total`);
  }
  
  state.updateState({
    cursor: null,
    cursorCreatedAt: null,
    eventsIngested: total,
    status: 'complete'
  });
  
  await db.close();
}

go().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
