import { IngestionService } from './ingestion.js';

async function main() {
  const service = new IngestionService();
  
  try {
    await service.start();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
