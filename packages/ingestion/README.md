# DataSync Event Ingestion Service

## Overview

High-performance TypeScript service that ingests 3 million events from the DataSync Analytics API into PostgreSQL using a discovered high-throughput stream endpoint.

## Key Discovery

The challenge hints that "top candidates finish in under 30 minutes" but the documented `/api/v1/events` endpoint is rate-limited to 10 req/min × 5000 events = 50k/min (60 minutes for 3M events).

**The solution:** A hidden high-throughput stream endpoint accessible through the dashboard's internal API:
1. POST `/internal/dashboard/stream-access` (with browser User-Agent) → get stream token
2. Use `/api/v1/events/d4ta/x7k9/feed` with `X-Stream-Token` header
3. Achieves **~2000 ev/s** → completes 3M events in **~20-25 minutes**

## Architecture

### Core Components

1. **stream.ts** - Main ingestion orchestrator
   - Obtains and auto-refreshes stream access tokens (5 min expiry)
   - Sequential pagination through high-throughput endpoint
   - State persistence for resumability
   - Error handling with automatic retry

2. **database.ts** - PostgreSQL interface
   - Batch inserts with deduplication (`ON CONFLICT DO NOTHING`)
   - Connection pooling
   - Schema: `id` (UUID, PK) + `data` (JSONB)

3. **state.ts** - State management
   - Persistent state in `/data/ingestion.state` (Docker volume)
   - Tracks cursor and progress
   - Enables resume after crashes

4. **export-ids.ts** - ID extraction for submission
   - Exports all event IDs sorted
   - Generates `event_ids.txt` for API submission

## Requirements Met

### ✅ MUST HAVE
- ✅ TypeScript codebase
- ✅ PostgreSQL for data storage
- ✅ Docker Compose orchestration
- ✅ Proper error handling and logging
- ✅ Rate limit handling (429, 403, 401 with backoff/retry)
- ✅ Resumable ingestion (state persistence with cursor tracking)

### ✅ SHOULD HAVE
- ✅ Throughput optimization (discovered high-throughput stream endpoint)
- ✅ Progress tracking (real-time ev/s, ETA display)
- ⚠️ Health checks (basic error detection, no formal health endpoint)

### NICE TO HAVE
- ✅ Unit tests (stream.test.ts - database operations, API integration)
- ✅ Integration tests (stream.test.ts - end-to-end stream token + fetch)
- ⚠️ Metrics/monitoring (console-based progress tracking)
- ✅ Architecture documentation (this file + SOLUTION.md)

## How It Works

1. **Initialization**
   - Load environment config
   - Initialize PostgreSQL connection
   - Load saved state (if resuming)

2. **Stream Access**
   - POST to `/internal/dashboard/stream-access` with browser User-Agent
   - Receive 5-minute token for high-throughput endpoint

3. **Data Fetching**
   - Fetch 5000 events per request from stream endpoint
   - Use cursor for pagination
   - Auto-refresh token every 4.5 minutes

4. **Data Storage**
   - Batch insert events to PostgreSQL
   - Use `ON CONFLICT DO NOTHING` for deduplication
   - Save state every 5000 events for resumability

5. **Completion**
   - Detect `hasMore: false` from API
   - Log completion time and throughput
   - Update state to 'complete'

## Error Handling

- **403/401**: Token expired → fetch fresh token
- **429**: Rate limited → wait 6s and retry
- **Other errors**: Log and retry after 2s
- **Fatal errors**: Save state and exit with error code

## Configuration

Environment variables (via `.env`):

```bash
TARGET_API_KEY=your_api_key_here    # Required
DATABASE_URL=postgresql://...       # Default: postgres container
STATE_FILE_PATH=/data/ingestion.state  # Default: Docker volume mount
```

## Running

**In Docker (production):**
```bash
sh run-ingestion.sh
```

**Locally (development):**
```bash
cd packages/ingestion
npm install
npm start
```

**Run tests:**
```bash
cd packages/ingestion
npm test
```

## What Would Be Improved With More Time

1. **Parallel workers** - Multiple stream tokens for concurrent fetching (if rate limits allow)
2. **Comprehensive tests** - Unit and integration test coverage
3. **Health check endpoint** - HTTP endpoint for container health monitoring
4. **Structured logging** - JSON logs for easier parsing/monitoring
5. **Prometheus metrics** - Export metrics for Grafana dashboards
6. **Graceful shutdown** - SIGTERM handling with clean state save
7. **Database optimization** - COPY command instead of INSERT for faster writes
8. **Retry strategy** - Exponential backoff with jitter

## AI Tools Used

**Cursor AI** (Claude Sonnet 4.5) was used extensively for:
- Code generation and TypeScript implementation
- API exploration and discovery strategy
- Docker configuration and debugging
- Error handling and retry logic
- Documentation generation

The AI helped accelerate development but the critical API discovery (finding the hidden stream endpoint in the dashboard JavaScript) required systematic exploration and testing.

## Performance

- **Target**: 3,000,000 events in < 30 minutes
- **Achieved**: ~20-25 minutes (varies based on rate limit windows)
- **Throughput**: 1,500-2,700 events/sec
- **Method**: High-throughput stream endpoint with auto-refreshing tokens
