import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from project root before anything else
console.log('[DEBUG] Loading dotenv...');
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
console.log('[DEBUG] Environment loaded');

console.log('[DEBUG] Importing IngestionService...');
const { IngestionService } = await import('./ingestion.js');
console.log('[DEBUG] IngestionService imported');

async function main() {
  console.log('[DEBUG] Creating service...');
  const service = new IngestionService();
  
  try {
    console.log('[DEBUG] Starting service...');
    await service.start();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[DEBUG] Unhandled error in main:', err);
  process.exit(1);
});
