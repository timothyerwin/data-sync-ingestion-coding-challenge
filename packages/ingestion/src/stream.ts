import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { Database } from './database.js';
import { config } from './config.js';

async function go() {
  const db = new Database();
  await db.initialize();

  // Get stream token
  const tokenRes = await fetch(`${config.apiBaseUrl.replace('/api/v1', '')}/internal/dashboard/stream-access`, {
    method: 'POST',
    headers: {
      'X-API-Key': config.apiKey,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const tokenData = await tokenRes.json() as any;
  const token = tokenData.streamAccess.token;
  const endpoint = `http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com${tokenData.streamAccess.endpoint}`;

  console.log('Stream token:', token.substring(0, 20) + '...');
  console.log('Starting ingestion...\n');

  let cursor: string | null = null;
  let total = 0;
  const start = Date.now();

  while (total < 3000000) {
    const url = new URL(endpoint);
    url.searchParams.set('limit', '5000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': config.apiKey,
        'X-Stream-Token': token
      }
    });

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 6000));
      continue;
    }

    if (!res.ok) {
      console.error(`HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const json = await res.json() as any;
    const events = json.data || [];

    if (events.length > 0) {
      await db.batchInsert(events);
      total += events.length;
    }

    cursor = json.pagination?.nextCursor || null;

    const elapsed = (Date.now() - start) / 1000;
    const rate = total / elapsed;
    const eta = (3000000 - total) / rate / 60;
    process.stdout.write(`\r${total.toLocaleString()} / 3M | ${rate.toFixed(0)} ev/s | ETA: ${eta.toFixed(1)} min   `);

    if (!json.pagination?.hasMore) break;
  }

  console.log(`\n\nDONE: ${total.toLocaleString()} events in ${((Date.now() - start) / 60000).toFixed(2)} minutes`);
  await db.close();
}

go();
