import { Database } from './database.js';
import { writeFileSync } from 'fs';

async function exportIds() {
  const db = new Database();
  
  try {
    await db.initialize();
    
    console.log('Exporting event IDs...');
    
    const client = await (db as any).pool.connect();
    try {
      const result = await client.query('SELECT id FROM ingested_events ORDER BY id');
      const ids = result.rows.map((row: any) => row.id).join('\n');
      
      writeFileSync('event_ids.txt', ids);
      console.log(`Exported ${result.rows.length} event IDs to event_ids.txt`);
    } finally {
      client.release();
    }
    
    await db.close();
  } catch (error) {
    console.error('Error exporting IDs:', error);
    process.exit(1);
  }
}

exportIds();
