import { readFileSync, writeFileSync, existsSync } from 'fs';
import { IngestionState } from './types.js';
import { config } from './config.js';

export class StateManager {
  private lockFile = `${config.stateFilePath}.lock`;

  getState(): IngestionState {
    if (!existsSync(config.stateFilePath)) {
      return this.getDefaultState();
    }

    try {
      const data = readFileSync(config.stateFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading state file, using default:', error);
      return this.getDefaultState();
    }
  }

  updateState(updates: Partial<IngestionState>): void {
    const currentState = this.getState();
    const newState: IngestionState = {
      ...currentState,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    try {
      writeFileSync(config.stateFilePath, JSON.stringify(newState, null, 2));
    } catch (error) {
      console.error('Error writing state file:', error);
      throw error;
    }
  }

  private getDefaultState(): IngestionState {
    return {
      cursor: null,
      cursorCreatedAt: null,
      eventsIngested: 0,
      rateLimitRemaining: null,
      rateLimitResetAt: null,
      lastUpdated: new Date().toISOString(),
      status: 'running',
    };
  }

  shouldRefreshCursor(): boolean {
    const state = this.getState();
    if (!state.cursor || !state.cursorCreatedAt) {
      return false;
    }

    const cursorAge = Date.now() - new Date(state.cursorCreatedAt).getTime();
    return cursorAge > config.cursorRefreshThreshold * 1000;
  }

  canMakeRequest(): boolean {
    const state = this.getState();
    
    // If no rate limit info yet, allow request
    if (state.rateLimitRemaining === null) {
      return true;
    }

    // Check if rate limit has reset
    if (state.rateLimitResetAt) {
      const resetTime = new Date(state.rateLimitResetAt).getTime();
      if (Date.now() >= resetTime) {
        return true;
      }
    }

    // Check if we have enough buffer
    return state.rateLimitRemaining > config.rateLimitBuffer;
  }

  getWaitTime(): number {
    const state = this.getState();
    if (!state.rateLimitResetAt) {
      return 0;
    }

    const resetTime = new Date(state.rateLimitResetAt).getTime();
    const waitTime = resetTime - Date.now();
    return Math.max(0, waitTime);
  }
}
