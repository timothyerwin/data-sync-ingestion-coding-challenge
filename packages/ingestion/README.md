# DataSync Ingestion Service

TypeScript-based data ingestion system for extracting events from DataSync Analytics API.

## Architecture

- **State Management**: JSON lock file with atomic updates
- **Rate Limiting**: Persistent state tracking with buffer management
- **Cursor Management**: Auto-refresh stale cursors (60s threshold)
- **Resumability**: Full state persistence across restarts
- **Batch Processing**: Configurable batch sizes with bulk inserts

## Key Features

1. **Lock File State**: Fast, persistent state in `/data/ingestion.state`
2. **Rate Limit Tracking**: Monitors `X-RateLimit-*` headers, respects limits
3. **Cursor Lifecycle**: Tracks cursor age, refreshes before stale
4. **Bulk Database Writes**: Batched inserts with deduplication
5. **Progress Tracking**: Real-time events/sec metrics

## Running

```bash
# Set your API key in .env
echo "TARGET_API_KEY=your_key_here" >> .env

# Run the ingestion
sh run-ingestion.sh
```

## Configuration

Environment variables (set in `.env` or `docker-compose.yml`):

- `TARGET_API_KEY`: Your DataSync API key
- `WORKER_CONCURRENCY`: Number of concurrent workers (default: 10)
- `BATCH_SIZE`: Events per API request (default: 1000)
- `RATE_LIMIT_BUFFER`: Safety buffer for rate limits (default: 5)
- `CURSOR_REFRESH_THRESHOLD`: Seconds before cursor refresh (default: 60)

## State File

Located at `/data/ingestion.state`:

```json
{
  "cursor": "abc123",
  "cursorCreatedAt": "2024-01-31T10:00:00Z",
  "eventsIngested": 150000,
  "rateLimitRemaining": 45,
  "rateLimitResetAt": "2024-01-31T10:05:00Z",
  "lastUpdated": "2024-01-31T10:02:30Z",
  "status": "running"
}
```

## Next Optimizations

1. Test different batch sizes (1000, 5000, 10000)
2. Discover optimal concurrency level
3. Explore `/sessions` and `/metrics` endpoints
4. Test parallel cursor fetching
5. Add connection pooling tuning
