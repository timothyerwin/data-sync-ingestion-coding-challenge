import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Database } from './database.js';

describe('Database', () => {
  let db: Database;

  before(async () => {
    db = new Database();
    await db.initialize();
  });

  after(async () => {
    await db.close();
  });

  it('should initialize database and create table', async () => {
    const client = await (db as any).pool.connect();
    try {
      const result = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ingested_events')");
      assert.strictEqual(result.rows[0].exists, true, 'Table should exist');
    } finally {
      client.release();
    }
  });

  it('should insert events', async () => {
    const testEvents = [
      { id: 'test-db-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
      { id: 'test-db-2', sessionId: 's1', userId: 'u1', type: 'click', name: 'e2', properties: {}, timestamp: 124 },
    ];

    const inserted = await db.batchInsert(testEvents);
    assert.strictEqual(inserted, 2, 'Should insert 2 events');

    await (db as any).pool.query("DELETE FROM ingested_events WHERE id LIKE 'test-db-%'");
  });

  it('should deduplicate on conflict', async () => {
    const testEvents = [
      { id: 'test-dup-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
      { id: 'test-dup-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
    ];

    const inserted = await db.batchInsert(testEvents);
    assert.strictEqual(inserted, 1, 'Should insert only 1 unique event');

    await (db as any).pool.query("DELETE FROM ingested_events WHERE id = 'test-dup-1'");
  });

  it('should handle empty batch', async () => {
    const inserted = await db.batchInsert([]);
    assert.strictEqual(inserted, 0, 'Should return 0 for empty batch');
  });

  it('should query inserted events', async () => {
    const testEvents = [
      { id: 'test-query-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
    ];

    await db.batchInsert(testEvents);
    
    const client = await (db as any).pool.connect();
    try {
      const result = await client.query("SELECT * FROM ingested_events WHERE id = 'test-query-1'");
      assert.strictEqual(result.rows.length, 1, 'Should find the inserted event');
      assert.strictEqual(result.rows[0].id, 'test-query-1', 'ID should match');
    } finally {
      client.release();
    }

    await (db as any).pool.query("DELETE FROM ingested_events WHERE id = 'test-query-1'");
  });
});
