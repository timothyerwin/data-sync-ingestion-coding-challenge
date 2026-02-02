import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { Database } from './database.js';
import { config } from './config.js';
import { StateManager } from './state.js';

async function getStreamToken() {
  const tokenRes = await fetch(`${config.apiBaseUrl.replace('/api/v1', '')}/internal/dashboard/stream-access`, {
    method: 'POST',
    headers: {
      'X-API-Key': config.apiKey,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const tokenData = await tokenRes.json() as any;
  return {
    token: tokenData.streamAccess.token,
    endpoint: `http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com${tokenData.streamAccess.endpoint}`,
    expiresIn: tokenData.streamAccess.expiresIn,
    fetchedAt: Date.now()
  };
}

async function go() {
  const db = new Database();
  await db.initialize();

  const state = new StateManager();
  const savedState = state.getState();
  
  let streamAccess = await getStreamToken();
  console.log('Stream token:', streamAccess.token.substring(0, 20) + '...');
  
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
    // Refresh token if expired (5 min = 300s, refresh at 270s)
    if ((Date.now() - streamAccess.fetchedAt) > 270000) {
      console.log('\nRefreshing stream token...');
      streamAccess = await getStreamToken();
      console.log('New token acquired.');
    }

    const url = new URL(streamAccess.endpoint);
    url.searchParams.set('limit', '5000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': config.apiKey,
        'X-Stream-Token': streamAccess.token
      }
    });

    if (res.status === 403 || res.status === 401) {
      console.log('\nToken expired, fetching new token...');
      streamAccess = await getStreamToken();
      continue;
    }

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 6000));
      continue;
    }

    if (res.status >= 500) {
      console.error(`\nServer error ${res.status}, waiting 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    if (!res.ok) {
      console.error(`\nHTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const json = await res.json() as any;
    const events = json.data || [];

    // Get total from first response
    if (apiTotal === null && json.meta?.total) {
      apiTotal = json.meta.total;
      console.log(`API reports ${apiTotal!.toLocaleString()} total events\n`);
    }

    if (events.length > 0) {
      await db.batchInsert(events);
      total += events.length;
    }

    cursor = json.pagination?.nextCursor || null;
    hasMore = json.pagination?.hasMore || false;
    
    // Save state periodically (every 5000 events)
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
  }

  const totalTime = ((Date.now() - start) / 60000).toFixed(2);
  console.log(`\n\nDONE: ${total.toLocaleString()} events in ${totalTime} minutes`);
  if (apiTotal && total !== apiTotal) {
    console.warn(`WARNING: Ingested ${total} but API reported ${apiTotal} total`);
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


go();
