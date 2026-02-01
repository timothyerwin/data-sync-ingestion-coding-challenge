# DataSync Ingestion Solution

## How to Run

### Option 1: Explore API First (Recommended)

Before running the full ingestion, explore the API to understand its behavior:

```bash
# Set your API key
echo "TARGET_API_KEY=your_api_key_here" > .env

# Start services
docker compose up -d

# Run API exploration
docker exec assignment-ingestion npm run explore
```

This will test different batch sizes, endpoints, and provide recommendations.

### Option 2: Direct Ingestion

1. **Set your API key**:
   ```bash
   echo "TARGET_API_KEY=your_api_key_here" > .env
   ```

2. **Run the ingestion**:
   ```bash
   sh run-ingestion.sh
   ```

3. **Export event IDs** (after completion):
   ```bash
   docker exec assignment-ingestion npm run export-ids
   docker cp assignment-ingestion:/app/event_ids.txt .
   ```

4. **Submit results**:
   ```bash
   ./submit.sh https://github.com/yourusername/your-repo
   ```

## Architecture Overview

### Core Components

1. **State Manager** (`src/state.ts`)
   - Manages persistent state in `/data/ingestion.state` (Docker volume)
   - Tracks cursor, rate limits, and progress
   - Enables full resumability across restarts

2. **API Client** (`src/api.ts`)
   - Handles HTTP requests to DataSync API
   - Parses rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
   - Configurable pagination limits

3. **Database Layer** (`src/database.ts`)
   - Bulk inserts with deduplication (ON CONFLICT DO NOTHING)
   - Connection pooling for performance
   - Simple schema: `id` (PK) + `data` (JSONB)

4. **Ingestion Service** (`src/ingestion.ts`)
   - Main orchestration logic
   - Buffer management for batch writes
   - Progress tracking with events/sec metrics
   - Automatic cursor refresh before stale (60s threshold)
   - Rate limit compliance with configurable buffer

### State Management

The lock file approach ensures:
- **Fast access**: No DB query overhead for rate limit checks
- **Atomic updates**: File operations are atomic
- **Persistent**: Survives container restarts via Docker volume
- **Simple**: Single JSON file, easy to inspect/debug

Example state file:
```json
{
  "cursor": "eyJpZCI6MTUwMDAwMH0=",
  "cursorCreatedAt": "2024-01-31T10:00:00.000Z",
  "eventsIngested": 150000,
  "rateLimitRemaining": 45,
  "rateLimitResetAt": "2024-01-31T10:05:00.000Z",
  "lastUpdated": "2024-01-31T10:02:30.000Z",
  "status": "running"
}
```

### Resumability

On restart, the system:
1. Loads state from lock file
2. Checks if rate limit window has reset
3. Validates cursor age (refreshes if stale)
4. Queries DB for actual event count
5. Resumes pagination from last cursor

### Rate Limit Handling

- Parses `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
- Maintains buffer (default: 5 requests) before limit
- Automatically waits until reset time when limit approached
- Persists rate limit state across requests

### Cursor Lifecycle

- Tracks cursor creation timestamp
- Refreshes cursor if > 60 seconds old (configurable)
- Prevents stale cursor errors
- Cursor stored in persistent state file

## API Discoveries

### Documented Endpoints

1. **GET /api/v1/events** - Main pagination endpoint
   - Params: `limit`, `cursor`
   - Response: `{ data, hasMore, nextCursor }`
   - Rate limited (headers track limits)

### Undocumented Findings

*(To be discovered during testing)*

- Optimal `limit` parameter (testing: 1000, 5000, 10000)
- Concurrent request tolerance
- `/sessions` endpoint capabilities
- `/metrics` endpoint for progress tracking
- Actual rate limit values
- Cursor expiration timing

## Configuration

Environment variables in `.env`:

```bash
# Required
TARGET_API_KEY=your_key_here

# Optional (defaults shown)
API_BASE_URL=http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1
WORKER_CONCURRENCY=10
BATCH_SIZE=1000
RATE_LIMIT_BUFFER=5
CURSOR_REFRESH_THRESHOLD=60
```

## Performance Optimizations

### Current

1. Batch database inserts (1000 events per batch)
2. Connection pooling (max 20 connections)
3. Deduplication at insert time
4. In-memory event buffer
5. Rate limit buffer to avoid throttling

### Potential Improvements

1. **Parallel pagination**: Multiple cursors simultaneously
2. **Larger batches**: Test 5000-10000 events per request
3. **Database COPY**: Use PostgreSQL COPY for faster inserts
4. **Compression**: Request gzip encoding
5. **Sessions endpoint**: Bulk fetch if available
6. **Worker pool**: Async concurrent fetchers
7. **Metrics endpoint**: Validate progress without querying DB

## Testing Strategy

1. **Start with conservative settings** (limit=1000, concurrency=10)
2. **Monitor first 10k events** for rate limit patterns
3. **Increase batch size** if limits allow
4. **Test concurrent requests** (5, 10, 20)
5. **Explore sessions/metrics** endpoints
6. **Optimize based on findings**

## Monitoring

During ingestion, monitor:
- Events/second throughput
- Rate limit remaining
- API response times
- Database insert performance
- Memory usage

## Error Handling

- Automatic retry on transient failures (max 3 retries)
- State persistence on every batch
- Graceful shutdown with final state save
- Resume from exact position on restart

## What Would Improve With More Time

1. **Distributed workers**: Redis queue for horizontal scaling
2. **Metrics dashboard**: Real-time Grafana visualization
3. **Unit tests**: Full test coverage
4. **Integration tests**: Mock API testing
5. **Health checks**: Liveness/readiness probes
6. **Alerting**: Slack/PagerDuty on failures
7. **Benchmarking**: A/B test different strategies
8. **Documentation**: API behavior documentation

## Tools Used

- **Cursor IDE**: Code generation and assistance
- **GitHub Copilot**: Autocomplete suggestions
- **TypeScript**: Type safety and developer experience
- **Docker**: Containerization and reproducibility

## Time to Complete

*(To be filled after actual run)*

- First API call: [timestamp]
- Submission: [timestamp]
- Duration: [X minutes Y seconds]
- Average throughput: [events/sec]
