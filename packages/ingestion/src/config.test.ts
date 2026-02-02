import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from './config.js';

describe('Config', () => {
  it('should load API base URL from env or use default', () => {
    assert.ok(config.apiBaseUrl, 'API base URL should be defined');
    assert.ok(config.apiBaseUrl.includes('http'), 'API base URL should be a valid URL');
  });

  it('should load API key from env', () => {
    assert.ok(config.apiKey, 'API key should be loaded from env');
    assert.strictEqual(typeof config.apiKey, 'string', 'API key should be a string');
  });

  it('should have database URL configured', () => {
    assert.ok(config.databaseUrl, 'Database URL should be defined');
    assert.ok(config.databaseUrl.includes('postgresql'), 'Database URL should be PostgreSQL connection string');
  });

  it('should have state file path configured', () => {
    assert.ok(config.stateFilePath, 'State file path should be defined');
    assert.strictEqual(typeof config.stateFilePath, 'string', 'State file path should be a string');
  });

  it('should have numeric configuration values', () => {
    assert.strictEqual(typeof config.workerConcurrency, 'number', 'Worker concurrency should be a number');
    assert.strictEqual(typeof config.batchSize, 'number', 'Batch size should be a number');
    assert.strictEqual(typeof config.maxRetries, 'number', 'Max retries should be a number');
    assert.strictEqual(typeof config.retryDelay, 'number', 'Retry delay should be a number');
  });
});
