# Getting Started - Pre-Flight Checklist

## Before Starting the 3-Hour Timer

**IMPORTANT**: Your API key is valid for 3 hours from FIRST USE. Do NOT start ingestion until you've prepared everything.

### Phase 1: Setup (No API calls)

1. **Clone/review the solution**
   ```bash
   git status
   ls -la packages/ingestion/
   ```

2. **Check Docker is running**
   ```bash
   docker --version
   docker compose version
   ```

3. **Review configuration**
   - Read `PROJECT_README.md`
   - Read `SOLUTION.md`
   - Understand the architecture

### Phase 2: Build & Test (No API calls to DataSync)

1. **Build the Docker image**
   ```bash
   docker compose build
   ```

2. **Start services**
   ```bash
   docker compose up -d
   ```

3. **Verify services are healthy**
   ```bash
   docker compose ps
   # postgres and ingestion should be running
   ```

### Phase 3: API Discovery (Starts 3-hour timer)

**THIS IS WHERE THE TIMER STARTS - BE READY**

1. **Set your API key**
   ```bash
   echo "TARGET_API_KEY=your_actual_key_here" > .env
   docker compose restart ingestion
   ```

2. **Quick connection test**
   ```bash
   docker exec assignment-ingestion npm run test
   ```

   This shows:
   - API connectivity
   - Rate limit headers
   - Response format
   - Event structure

3. **Full API exploration**
   ```bash
   docker exec assignment-ingestion npm run explore
   ```

   This tests:
   - Different batch sizes (100, 1000, 5000, 10000)
   - Response times
   - Rate limits
   - Sessions/metrics endpoints
   - Concurrent requests

4. **Adjust configuration based on findings**
   
   Edit `.env` if needed:
   ```bash
   # If exploration shows higher limits work
   BATCH_SIZE=5000
   WORKER_CONCURRENCY=20
   ```

### Phase 4: Full Ingestion

1. **Start ingestion**
   ```bash
   sh run-ingestion.sh
   ```

2. **Monitor progress**
   - Watch the output (updates every 5 seconds)
   - Check state: `docker exec assignment-ingestion cat /data/ingestion.state`
   - Check DB: `docker exec assignment-postgres psql -U postgres -d ingestion -c "SELECT COUNT(*) FROM ingested_events;"`

3. **Wait for completion**
   - Should see "INGESTION COMPLETE!" message
   - Should have 3,000,000 events

### Phase 5: Submission

1. **Export event IDs**
   ```bash
   docker exec assignment-ingestion npm run export-ids
   docker cp assignment-ingestion:/app/event_ids.txt .
   ```

2. **Verify count**
   ```bash
   wc -l event_ids.txt
   # Should show: 3000000
   ```

3. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Complete DataSync ingestion solution"
   git push origin main
   ```

4. **Submit results**
   ```bash
   ./submit.sh https://github.com/yourusername/your-repo
   ```

5. **Verify submission**
   ```bash
   curl -H "X-API-Key: YOUR_KEY" \
     http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions
   ```

## Optimization Strategy

### Conservative Approach (Safe)
- Use default settings (BATCH_SIZE=1000, WORKER_CONCURRENCY=10)
- Let the system run
- Should complete in 30-60 minutes

### Aggressive Approach (Faster)
- Run exploration first
- If API allows, increase BATCH_SIZE to 5000-10000
- If rate limits allow, increase WORKER_CONCURRENCY to 20-50
- Target: complete in < 20 minutes

### Key Metrics to Watch

During exploration, look for:
- **Max batch size**: Test 1000, 5000, 10000
- **Rate limit**: Check `X-RateLimit-Limit` header
- **Concurrent requests**: Can you run 10, 20, 50 in parallel?
- **Response time**: Events per second
- **Alternative endpoints**: `/sessions` or `/metrics` for bulk access

### Expected Performance

With defaults:
- ~1000 events per API call
- ~10 concurrent workers
- ~10,000 events per batch cycle
- 3,000,000 / 10,000 = ~300 batch cycles
- At 1 request/second rate limit: ~300 seconds = 5 minutes
- At 10 requests/second rate limit: ~30 seconds = 30 seconds

**If it takes > 5 minutes, there's optimization opportunity!**

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### API Key Invalid
```bash
# Check .env file
cat .env
# Should show: TARGET_API_KEY=your_key

# Restart service to pick up changes
docker compose restart ingestion
```

### Service Not Starting
```bash
# Check logs
docker logs assignment-ingestion

# Common issues:
# - Missing .env file
# - Invalid DATABASE_URL
# - Node modules not installed
```

### Rate Limit Hit
- System should wait automatically
- Check state file for reset time
- Adjust RATE_LIMIT_BUFFER if too aggressive

### Postgres Connection Failed
```bash
# Check postgres is healthy
docker compose ps

# If not, restart
docker compose restart postgres
sleep 5
docker compose restart ingestion
```

## Success Criteria

✅ All 3,000,000 events ingested
✅ No duplicate events
✅ Completion time recorded
✅ event_ids.txt contains all IDs
✅ Submission successful
✅ Code pushed to GitHub

## Time Budget

- **Setup & Build**: 5 minutes
- **API Exploration**: 5 minutes (part of 3-hour timer)
- **Configuration**: 2 minutes
- **Full Ingestion**: 5-30 minutes (depends on optimization)
- **Export & Submit**: 5 minutes
- **Total**: ~20-50 minutes

**Target: Complete everything in under 30 minutes to match top candidates!**

Good luck! 🚀
