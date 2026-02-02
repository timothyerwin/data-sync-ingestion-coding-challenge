import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { StateManager } from './state.js';
import { unlinkSync } from 'fs';

describe('StateManager', () => {
  const testStatePath = '/tmp/test-ingestion-state.json';

  after(() => {
    try {
      unlinkSync(testStatePath);
    } catch {}
  });

  it('should initialize with default state', () => {
    const state = new StateManager();
    const currentState = state.getState();
    
    assert.strictEqual(currentState.cursor, null, 'Initial cursor should be null');
    assert.strictEqual(currentState.eventsIngested, 0, 'Initial events ingested should be 0');
    assert.strictEqual(currentState.status, 'running', 'Initial status should be running');
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
    process.env.STATE_FILE_PATH = testStatePath;
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
  });

  it('should handle rate limit state', () => {
    const state = new StateManager();
    
    state.updateState({
      rateLimitRemaining: 5,
      rateLimitResetAt: new Date(Date.now() + 60000).toISOString()
    });

    assert.strictEqual(state.canMakeRequest(), true, 'Should allow requests when rate limit remaining > 0');
  });
});
