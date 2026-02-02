import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Database } from './database.js';
import { config } from './config.js';

describe('Database', () => {
  let db: Database;

  before(async () => {
    db = new Database();
    await db.initialize();
  });

  after(async () => {
    await db.close();
  });

  it('should insert and deduplicate events', async () => {
    const testEvents = [
      { id: 'test-id-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
      { id: 'test-id-2', sessionId: 's1', userId: 'u1', type: 'click', name: 'e2', properties: {}, timestamp: 124 },
      { id: 'test-id-1', sessionId: 's1', userId: 'u1', type: 'click', name: 'e1', properties: {}, timestamp: 123 },
    ];

    const inserted = await db.batchInsert(testEvents);
    assert.strictEqual(inserted, 2, 'Should insert 2 unique events (deduplicating the duplicate)');

    // Cleanup
    await (db as any).pool.query("DELETE FROM ingested_events WHERE id LIKE 'test-id-%'");
  });

  it('should handle empty batch', async () => {
    const inserted = await db.batchInsert([]);
    assert.strictEqual(inserted, 0);
  });
});

describe('Stream Token', () => {
  it('should get valid stream token', async () => {
    const baseUrl = config.apiBaseUrl.replace('/api/v1', '');
    const res = await fetch(`${baseUrl}/internal/dashboard/stream-access`, {
      method: 'POST',
      headers: {
        'X-API-Key': config.apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    
    const data = await res.json() as any;
    assert.ok(data.streamAccess, 'Should have streamAccess');
    assert.ok(data.streamAccess.token, 'Should have token');
    assert.ok(data.streamAccess.endpoint, 'Should have endpoint');
    assert.strictEqual(data.streamAccess.expiresIn, 300, 'Token should expire in 300s');
  });
});

describe('Stream Endpoint', () => {
  it('should fetch events with stream token', async () => {
    const baseUrl = config.apiBaseUrl.replace('/api/v1', '');
    const tokenRes = await fetch(`${baseUrl}/internal/dashboard/stream-access`, {
      method: 'POST',
      headers: {
        'X-API-Key': config.apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    const tokenData = await tokenRes.json() as any;
    const token = tokenData.streamAccess.token;
    const endpoint = `${baseUrl}${tokenData.streamAccess.endpoint}`;

    const res = await fetch(`${endpoint}?limit=1`, {
      headers: {
        'X-API-Key': config.apiKey,
        'X-Stream-Token': token
      }
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    
    const data = await res.json() as any;
    assert.ok(data.data, 'Should have data array');
    assert.ok(data.pagination, 'Should have pagination');
    assert.ok(data.meta, 'Should have meta');
    assert.ok(data.meta.total > 0, 'Should report total events count');
    assert.strictEqual(typeof data.meta.total, 'number', 'Total should be a number');
  });
});
