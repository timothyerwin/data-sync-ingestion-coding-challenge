import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { StreamClient } from './stream-client.js';
import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';

const DATA_DIR = existsSync('/data') ? '/data' : '.';
const OUTPUT_FILE = resolve(DATA_DIR, 'events.csv');
const CURSOR_FILE = resolve(DATA_DIR, 'cursor.txt');

async function ingest() {
  const client = new StreamClient();
  
  console.log('Starting fast ingestion to file...');
  console.log(`Output: ${OUTPUT_FILE}`);
  
  let startCursor: string | null = null;
  let total = 0;
  
  // Resumability check
  if (existsSync(CURSOR_FILE) && existsSync(OUTPUT_FILE)) {
    try {
      startCursor = readFileSync(CURSOR_FILE, 'utf-8').trim();
      if (startCursor) {
         console.log(`Resuming from cursor: ${startCursor.substring(0, 20)}...`);
         // We don't verify total count from file to save time, 
         // but we assume we are appending new data.
      }
    } catch (e) {
      console.warn('Failed to read cursor file, starting fresh');
    }
  }

  // Open stream in Append mode ('a')
  const stream = createWriteStream(OUTPUT_FILE, { flags: 'a', highWaterMark: 1024 * 1024 });
  
  const start = Date.now();
  
  // Outer loop ensures we don't stop until we hit the target
  while (total < 3000000) {
    try {
      console.log(startCursor ? `Streaming from cursor...` : `Starting fresh stream...`);
      
      for await (const { events, cursor } of client.streamEvents(startCursor)) {
        if (events.length === 0) continue;

        const lines = events.map(e => `${e.id}\t${JSON.stringify(e)}\n`).join('');
        
        if (!stream.write(lines)) {
            await new Promise<void>(resolve => stream.once('drain', resolve));
        }
        
        // Update cursor for next iteration/resume
        if (cursor) {
          startCursor = cursor;
          writeFileSync(CURSOR_FILE, cursor);
        }
        
        total += events.length;
        
        const elapsed = (Date.now() - start) / 1000;
        const rate = total / elapsed;
        const eventsPerMin = rate * 60;
        
        process.stdout.write(`\rFetched: ${total.toLocaleString()} (new) | ${rate.toFixed(0)} ev/s | ${(eventsPerMin/1000).toFixed(0)}k/min   `);
        
        if (total >= 3000000) break;
      }
      
      if (total < 3000000) {
        console.log(`\nStream ended at ${total.toLocaleString()} events. Waiting 5s before resuming...`);
        await new Promise(r => setTimeout(r, 5000));
        // Loop continues, using last 'startCursor'
      }

    } catch (err) {
      console.error('\nStream error:', err);
      console.log('Waiting 5s before retrying...');
      await new Promise(r => setTimeout(r, 5000));
      // Loop continues
    }
  }
  
  stream.end();
  console.log(`\n\nDONE. Fetched ${total.toLocaleString()} new events.`);
}

ingest();
