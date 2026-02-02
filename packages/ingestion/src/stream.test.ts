import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from './config.js';

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
