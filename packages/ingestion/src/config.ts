import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env before defining config
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

export const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1',
  apiKey: process.env.TARGET_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/ingestion',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  batchSize: parseInt(process.env.BATCH_SIZE || '1000', 10),
  rateLimitBuffer: parseInt(process.env.RATE_LIMIT_BUFFER || '5', 10),
  cursorRefreshThreshold: parseInt(process.env.CURSOR_REFRESH_THRESHOLD || '60', 10),
  stateFilePath: process.env.STATE_FILE_PATH || '/data/ingestion.state',
  maxRetries: 3,
  retryDelay: 1000,
};
