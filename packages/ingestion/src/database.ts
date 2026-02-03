import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { config } from './config.js';
import { Event } from './types.js';

const { Pool } = pg;

export class Database {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
    });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE UNLOGGED TABLE IF NOT EXISTS ingested_events (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL
        )
      `);

      console.log('Database initialized');
    } finally {
      client.release();
    }
  }

  async batchInsert(events: Event[]): Promise<number> {
    if (events.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      // Use COPY directly to main table via temp staging
      const tableName = `temp_copy_${Date.now()}`;
      await client.query(`CREATE TEMP TABLE ${tableName} (id TEXT, data JSONB)`);
      
      // COPY is 10-100x faster than INSERT
      const stream = client.query(copyFrom(`COPY ${tableName} (id, data) FROM STDIN`));
      
      const copyPromise = new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });
      
      for (const event of events) {
        stream.write(`${event.id}\t${JSON.stringify(event)}\n`);
      }
      
      stream.end();
      await copyPromise;
      
      // Insert with deduplication
      const result = await client.query(`
        INSERT INTO ingested_events (id, data)
        SELECT id, data FROM ${tableName}
        ON CONFLICT (id) DO NOTHING
      `);
      
      await client.query(`DROP TABLE ${tableName}`);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  async getCount(): Promise<number> {
    const result = await this.pool.query('SELECT COUNT(*) FROM ingested_events');
    return parseInt(result.rows[0].count, 10);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
