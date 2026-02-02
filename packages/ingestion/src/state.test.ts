import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { StateManager } from './state.js';
import { unlinkSync, existsSync } from 'fs';

describe('StateManager', () => {
  before(() => {
    // Clean up any test state files
    const testFiles = [
      '/tmp/test-ingestion-state.json',
      '/tmp/test-nonexistent-state.json',
      '/tmp/test-rate-limit-state.json'
    ];
    testFiles.forEach(f => {
      try { if (existsSync(f)) unlinkSync(f); } catch {}
    });
  });

  it('should update state', () => {
    const state = new StateManager();
    
    state.updateState({
      cursor: 'test-cursor',
      eventsIngested: 1000,
      status: 'running'
    });

    const currentState = state.getState();
    assert.strictEqual(currentState.cursor, 'test-cursor', 'Cursor should be updated');
    assert.strictEqual(currentState.eventsIngested, 1000, 'Events count should be updated');
  });

  it('should persist state to file', () => {
    const uniquePath = `/tmp/test-persist-${Date.now()}-${Math.random()}.json`;
    process.env.STATE_FILE_PATH = uniquePath;
    
    const state1 = new StateManager();
    state1.updateState({
      cursor: 'persisted-cursor',
      eventsIngested: 5000,
      status: 'running'
    });

    const state2 = new StateManager();
    const loaded = state2.getState();
    
    assert.strictEqual(loaded.cursor, 'persisted-cursor', 'Cursor should persist');
    assert.strictEqual(loaded.eventsIngested, 5000, 'Events count should persist');
    
    try { unlinkSync(uniquePath); } catch {}
    process.env.STATE_FILE_PATH = '/data/ingestion.state';
  });

  it('should handle rate limit state', () => {
    const uniquePath = `/tmp/test-rate-${Date.now()}-${Math.random()}.json`;
    process.env.STATE_FILE_PATH = uniquePath;
    
    const state = new StateManager();
    state.updateState({
      rateLimitRemaining: 10,
      rateLimitResetAt: new Date(Date.now() + 60000).toISOString()
    });

    assert.strictEqual(state.canMakeRequest(), true, 'Should allow requests when rate limit remaining > buffer');
    
    // Test when rate limit is low
    state.updateState({
      rateLimitRemaining: 2,
      rateLimitResetAt: new Date(Date.now() + 60000).toISOString()
    });
    
    assert.strictEqual(state.canMakeRequest(), false, 'Should not allow requests when rate limit remaining <= buffer');
    
    try { unlinkSync(uniquePath); } catch {}
    process.env.STATE_FILE_PATH = '/data/ingestion.state';
  });
});
