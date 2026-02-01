import pg from 'pg';
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
        CREATE TABLE IF NOT EXISTS ingested_events (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          ingested_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ingested_at ON ingested_events(ingested_at)
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
      // Use COPY for fast bulk insert
      const values = events.map(event => 
        `${event.id}\t${JSON.stringify(event)}`
      ).join('\n');

      // Use INSERT with ON CONFLICT for deduplication
      const placeholders = events.map((_, i) => {
        const offset = i * 2;
        return `($${offset + 1}, $${offset + 2})`;
      }).join(', ');

      const values2 = events.flatMap(event => [event.id, JSON.stringify(event)]);

      const result = await client.query(
        `INSERT INTO ingested_events (id, data) 
         VALUES ${placeholders}
         ON CONFLICT (id) DO NOTHING`,
        values2
      );

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
