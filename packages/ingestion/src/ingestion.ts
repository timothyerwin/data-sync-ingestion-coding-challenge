import { ApiClient } from './api.js';
import { Database } from './database.js';
import { StateManager } from './state.js';
import { config } from './config.js';
import { Event } from './types.js';

export class IngestionService {
  private apiHeader: ApiClient;  // 10 req/min
  private apiQuery: ApiClient;   // 5 req/min
  private db: Database;
  private state: StateManager;
  private eventBuffer: Event[] = [];
  private totalIngested = 0;
  private startTime = Date.now();

  constructor() {
    this.apiHeader = new ApiClient(false);  // Header auth
    this.apiQuery = new ApiClient(true);     // Query param auth
    this.db = new Database();
    this.state = new StateManager();
  }

  async start(): Promise<void> {
    console.log('Starting ingestion service...');
    console.log('Configuration:', {
      concurrency: config.workerConcurrency,
      batchSize: config.batchSize,
      rateLimitBuffer: config.rateLimitBuffer,
    });

    await this.db.initialize();

    // Load existing state
    const currentState = this.state.getState();
    console.log('Current state:', currentState);

    // Get initial count from database
    const existingCount = await this.db.getCount();
    if (existingCount > 0) {
      console.log(`Resuming from ${existingCount} events already ingested`);
      this.totalIngested = existingCount;
    }

    await this.ingest();
  }

  private async ingest(): Promise<void> {
    let cursor = this.state.getState().cursor;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore) {
      // Check if we can make a request
      if (!this.state.canMakeRequest()) {
        const waitTime = this.state.getWaitTime();
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime + 1000);
      }

      // Check if cursor needs refresh
      if (cursor && this.state.shouldRefreshCursor()) {
        console.log('Cursor is stale, fetching fresh cursor...');
        cursor = null;
      }

      try {
        // Alternate between header auth and query param auth to maximize throughput
        // Header: 10 req/min, Query: 5 req/min = 15 req/min total
        const useQueryAuth = requestCount % 3 === 2; // Every 3rd request uses query auth (5 out of 15)
        const api = useQueryAuth ? this.apiQuery : this.apiHeader;
        
        const { response, rateLimit } = await api.fetchEvents(cursor, config.batchSize);
        requestCount++;

        // Update rate limit info
        if (rateLimit) {
          this.state.updateState({
            rateLimitRemaining: rateLimit.remaining,
            rateLimitResetAt: rateLimit.resetAt,
          });
        }

        // Add events to buffer
        this.eventBuffer.push(...response.data);

        // Flush buffer if it's large enough
        if (this.eventBuffer.length >= config.batchSize) {
          await this.flushBuffer();
        }

        // Update cursor
        cursor = response.nextCursor || response.cursor || null;
        hasMore = response.hasMore;

        // Update state
        this.state.updateState({
          cursor,
          cursorCreatedAt: cursor ? new Date().toISOString() : null,
          eventsIngested: this.totalIngested,
        });

        // Progress update
        if (requestCount % 10 === 0) {
          const elapsed = (Date.now() - this.startTime) / 1000;
          const rate = this.totalIngested / elapsed;
          console.log(`Progress: ${this.totalIngested.toLocaleString()} events | ${rate.toFixed(0)} events/sec | Requests: ${requestCount}`);
        }

      } catch (error) {
        const errorMsg = String(error);
        
        // Handle rate limit errors
        if (errorMsg.includes('RATE_LIMIT_EXCEEDED')) {
          const parts = errorMsg.split(':');
          const retryAfter = parts.length > 2 ? parseInt(parts[2], 10) : 60;
          console.log(`Rate limit exceeded. Waiting ${retryAfter}s before retry...`);
          await this.sleep((retryAfter || 60) * 1000 + 1000); // Add 1s buffer
          continue;
        }
        
        console.error('Error fetching events:', error);
        await this.sleep(config.retryDelay);
      }
    }

    // Flush remaining buffer
    await this.flushBuffer();

    console.log('\n===========================================');
    console.log('INGESTION COMPLETE');
    console.log(`Total events: ${this.totalIngested.toLocaleString()}`);
    console.log(`Time taken: ${((Date.now() - this.startTime) / 1000).toFixed(0)}s`);
    console.log('===========================================');

    this.state.updateState({
      status: 'complete',
      eventsIngested: this.totalIngested,
    });

    await this.db.close();
  }

  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const inserted = await this.db.batchInsert(events);
    this.totalIngested += inserted;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
