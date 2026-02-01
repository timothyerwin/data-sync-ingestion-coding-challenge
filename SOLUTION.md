# DataSync Ingestion Solution

## The Key Discovery: High-Throughput Stream Endpoint

The standard `/api/v1/events` endpoint has strict rate limiting (10 req/min × 5000 events = 50k/min → 60 minutes for 3M events).

**The hidden high-performance endpoint** is accessed by:
1. POST to `/internal/dashboard/stream-access` with a browser User-Agent header
2. Receive a stream token valid for 5 minutes
3. Use `/api/v1/events/d4ta/x7k9/feed` with the `X-Stream-Token` header
4. This endpoint has significantly higher throughput (~1700-4400 ev/s) → **~13-30 minutes for 3M events**

## How to Run

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

1. **Stream Ingestion** (`src/stream.ts`)
   - Obtains high-throughput stream access token
   - Fetches events sequentially from stream endpoint
   - Auto-refreshes token every 5 minutes
   - Rate limit handling with automatic retry

2. **Database Layer** (`src/database.ts`)
   - Bulk inserts with deduplication (ON CONFLICT DO NOTHING)
   - Connection pooling for performance
   - Simple schema: `id` (PK) + `data` (JSONB)

3. **Export Utility** (`src/export-ids.ts`)
   - Extracts all event IDs from database
   - Generates submission-ready `event_ids.txt` file

### Performance Strategy

1. **Sequential fetching** from high-throughput stream endpoint
2. **Database batch inserts** with conflict handling
3. **Token refresh** every 5 minutes automatically
4. **Rate limit detection** with automatic backoff

Target throughput: **1500-4000 events/sec** depending on rate limit windows

## API Discoveries

### Standard Endpoints (Rate Limited)

1. **GET /api/v1/events** - Rate: 10 req/min (header auth) or 5 req/min (query param auth)
2. **GET /api/v1/sessions** - Rate: 40 req/min (returns session metadata, not event data)
3. **GET /api/v1/metrics** - Rate: 30 req/min (empty, no useful data)
4. **POST /api/v1/events/bulk** - Rate: 20 req/min (max 100 IDs per request, requires IDs first)

### High-Throughput Stream Endpoint (The Solution)

**Access Pattern**:
```bash
# 1. Get stream token (requires browser User-Agent)
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/internal/dashboard/stream-access

# Returns: { "streamAccess": { "endpoint": "/api/v1/events/d4ta/x7k9/feed", "token": "..." }}

# 2. Use the stream endpoint
curl -H "X-API-Key: YOUR_KEY" \
  -H "X-Stream-Token: TOKEN_FROM_STEP_1" \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/events/d4ta/x7k9/feed?limit=5000"
```

**Characteristics**:
- Max 5000 events per request (same as standard endpoint)
- Significantly higher rate limit (tested 10-20 parallel requests successfully)
- Token expires in 300 seconds (5 minutes)
- Supports standard pagination with `cursor` parameter

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

## Performance Notes

Expected completion time: **13-30 minutes** for 3 million events.

The key to achieving the 30-minute target is discovering and using the high-throughput stream endpoint rather than the standard rate-limited `/api/v1/events` endpoint.
