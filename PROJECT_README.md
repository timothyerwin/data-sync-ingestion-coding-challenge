# DataSync Ingestion Coding Challenge - Solution

Complete TypeScript-based solution for ingesting 3M events from DataSync Analytics API.

## Quick Start

```bash
# 1. Set your API key
echo "TARGET_API_KEY=your_api_key_here" > .env

# 2. Run the ingestion
sh run-ingestion.sh

# 3. Wait for completion (monitor in real-time)
# The script will show progress every 5 seconds

# 4. Export event IDs
docker exec assignment-ingestion npm run export-ids
docker cp assignment-ingestion:/app/event_ids.txt .

# 5. Submit results
./submit.sh https://github.com/yourusername/your-repo
```

## Pre-Flight Testing (Recommended)

Before starting the 3-hour timer, test the API:

```bash
# Set API key
echo "TARGET_API_KEY=your_key" > .env

# Start services
docker compose up -d --build

# Quick connection test
docker exec assignment-ingestion npm run test

# Full API exploration (tests different batch sizes, endpoints)
docker exec assignment-ingestion npm run explore

# Stop services (doesn't count against 3-hour timer)
docker compose down
```

## Architecture

### Components

```
┌─────────────┐
│   API       │ ← Fetch events with pagination
│   Client    │   Track rate limits from headers
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   State     │ ← Lock file (/data/ingestion.state)
│   Manager   │   Cursor, rate limits, progress
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Ingestion  │ ← Orchestration & buffering
│  Service    │   Batch writes, cursor refresh
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │ ← PostgreSQL bulk inserts
│   Layer     │   Deduplication, connection pool
└─────────────┘
```

### Key Features

1. **Resumable**: State persisted in Docker volume
2. **Rate limit aware**: Parses headers, respects limits with buffer
3. **Cursor lifecycle**: Auto-refresh stale cursors (60s)
4. **Bulk inserts**: Batched PostgreSQL writes
5. **Progress tracking**: Real-time events/sec metrics

## File Structure

```
.
├── packages/ingestion/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── ingestion.ts      # Main orchestration
│   │   ├── api.ts            # API client with rate limit parsing
│   │   ├── database.ts       # PostgreSQL bulk operations
│   │   ├── state.ts          # Lock file state management
│   │   ├── config.ts         # Environment configuration
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── export-ids.ts     # Export event IDs for submission
│   │   ├── explore-api.ts    # API exploration tool
│   │   └── quick-test.ts     # Quick connection test
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml         # Services: postgres + ingestion
├── run-ingestion.sh          # Main entry point
├── submit.sh                 # Submit results
├── SOLUTION.md               # Detailed architecture docs
└── .env                      # Your API key (create this)
```

## Configuration

Edit `.env` to tune performance:

```bash
# Required
TARGET_API_KEY=your_key_here

# Performance tuning (optional)
WORKER_CONCURRENCY=10         # Parallel workers (increase if rate limits allow)
BATCH_SIZE=1000               # Events per API request (test 5000, 10000)
RATE_LIMIT_BUFFER=5           # Stay 5 requests away from limit
CURSOR_REFRESH_THRESHOLD=60   # Refresh cursor after 60 seconds
```

## Monitoring

During ingestion, the system outputs:

```
Progress: 150,000 events | 250 events/sec | Requests: 150
Progress: 300,000 events | 245 events/sec | Requests: 300
...
```

Check state file:
```bash
docker exec assignment-ingestion cat /data/ingestion.state
```

Check database:
```bash
docker exec assignment-postgres psql -U postgres -d ingestion -c "SELECT COUNT(*) FROM ingested_events;"
```

## Resumability

If the process crashes:

1. State is saved in `/data/ingestion.state` (Docker volume)
2. Database has all events inserted so far
3. Simply restart: `sh run-ingestion.sh`
4. System resumes from last cursor position

## Performance Tips

1. **Start conservative**: Default settings work for most scenarios
2. **Monitor first 10k events**: Check rate limit headers
3. **Increase batch size**: If limits allow, try 5000 or 10000
4. **Test concurrency**: Increase WORKER_CONCURRENCY if API supports it
5. **Explore endpoints**: `/sessions` or `/metrics` might be faster

## Troubleshooting

**"API connection failed"**
- Check API key is correct
- Verify network connectivity
- Ensure API is accessible

**"Rate limit exceeded"**
- System should wait automatically
- Check RATE_LIMIT_BUFFER setting
- Rate limits reset based on API headers

**"Cursor stale"**
- System auto-refreshes cursors > 60s old
- Check CURSOR_REFRESH_THRESHOLD setting

**"Database connection failed"**
- Ensure postgres service is healthy: `docker compose ps`
- Check DATABASE_URL in docker-compose.yml

## Development

Run locally (outside Docker):

```bash
cd packages/ingestion
npm install

# Set environment variables
export DATABASE_URL=postgresql://postgres:postgres@localhost:5434/ingestion
export TARGET_API_KEY=your_key

# Test API
npm run test

# Explore API
npm run explore

# Run ingestion
npm start
```

## Next Steps After Ingestion

1. **Verify count**: Should have 3,000,000 events
   ```bash
   docker exec assignment-postgres psql -U postgres -d ingestion -c "SELECT COUNT(*) FROM ingested_events;"
   ```

2. **Export IDs**:
   ```bash
   docker exec assignment-ingestion npm run export-ids
   docker cp assignment-ingestion:/app/event_ids.txt .
   ```

3. **Submit**:
   ```bash
   ./submit.sh https://github.com/yourusername/your-repo
   ```

4. **Check submissions**:
   ```bash
   curl -H "X-API-Key: YOUR_KEY" \
     http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions
   ```

## Tools Used

- **Cursor IDE**: AI-assisted code generation
- **TypeScript**: Type safety and tooling
- **Node.js 20**: Modern async/await patterns
- **PostgreSQL 16**: Reliable data storage
- **Docker**: Reproducible environment

## Time Optimization Strategy

Target: Complete in < 30 minutes

1. **Pre-test** (before 3-hour timer): Explore API, test batch sizes
2. **Optimize settings**: Set BATCH_SIZE and WORKER_CONCURRENCY based on findings
3. **Start ingestion**: Begin 3-hour timer on first real API call
4. **Monitor**: Watch for rate limits, adjust if needed
5. **Submit**: Export and submit immediately upon completion

## Further Optimizations

If throughput is lower than expected:

1. Test `/sessions` endpoint for bulk access
2. Test `/metrics` endpoint for total count validation
3. Increase BATCH_SIZE to 5000-10000
4. Increase WORKER_CONCURRENCY to 20-50
5. Consider parallel cursor fetching if API allows
6. Profile database insert performance
7. Test compression (gzip encoding)

Good luck! 🚀
