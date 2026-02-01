# Local Development Setup

Run the ingestion service locally (outside Docker) for faster iteration and debugging.

## Setup

### 1. Start PostgreSQL in Docker

```bash
# Start only postgres (not the ingestion service)
docker compose up -d postgres

# Verify it's running
docker compose ps
```

### 2. Install Dependencies

```bash
cd packages/ingestion
npm install
cd ../..
```

### 3. Configure Environment

Your `.env` is already configured for local development with `localhost:5434`.

**Set your API key** in `.env`:
```bash
TARGET_API_KEY=your_actual_api_key_here
```

## Running Locally

### Quick API Test

```bash
cd packages/ingestion
npm run test
```

### Explore API

```bash
cd packages/ingestion
npm run explore
```

### Run Full Ingestion

```bash
cd packages/ingestion
npm start
```

### Export IDs

```bash
cd packages/ingestion
npm run export-ids
```

## Debugging

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Ingestion",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "args": ["${workspaceFolder}/packages/ingestion/src/index.ts"],
      "cwd": "${workspaceFolder}/packages/ingestion",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Test",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "args": ["${workspaceFolder}/packages/ingestion/src/quick-test.ts"],
      "cwd": "${workspaceFolder}/packages/ingestion",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Set Breakpoints

1. Open any `.ts` file in `packages/ingestion/src/`
2. Click in the gutter to set breakpoints
3. Press F5 or use "Run and Debug" panel
4. Step through code, inspect variables, etc.

## State File Location (Local Dev)

When running locally, the state file is at:
```bash
/data/ingestion.state
```

**Note:** This requires write permissions to `/data/`. If you get permission errors, either:

1. **Option A:** Run with sudo (not recommended)
2. **Option B:** Change the state file path:

Edit `packages/ingestion/src/config.ts`:
```typescript
stateFilePath: process.env.STATE_FILE_PATH || './ingestion.state',
```

Then the state file will be in `packages/ingestion/ingestion.state`

## Database Access

### psql

```bash
psql postgresql://postgres:postgres@localhost:5434/ingestion
```

### Quick queries

```bash
# Count events
psql postgresql://postgres:postgres@localhost:5434/ingestion -c "SELECT COUNT(*) FROM ingested_events;"

# Check state
cat /data/ingestion.state
# Or if using local path:
cat packages/ingestion/ingestion.state

# Sample events
psql postgresql://postgres:postgres@localhost:5434/ingestion -c "SELECT * FROM ingested_events LIMIT 5;"
```

## Switching Between Local and Docker

### Local Development
```bash
# Start postgres only
docker compose up -d postgres

# Run ingestion locally
cd packages/ingestion
npm start
```

### Full Docker
```bash
# Run everything in Docker
sh run-ingestion.sh
```

## Performance Tips for Local Dev

1. **Smaller batches for testing**: Set `BATCH_SIZE=100` in `.env` for faster iteration
2. **Single worker**: Set `WORKER_CONCURRENCY=1` for easier debugging
3. **Test with limited data**: Modify the code to stop after N events

Example quick test (add to `ingestion.ts`):
```typescript
// In the ingest() method, add a limit for testing
let totalFetched = 0;
const TEST_LIMIT = 10000; // Stop after 10k events for testing

while (hasMore && totalFetched < TEST_LIMIT) {
  // ... existing code ...
  totalFetched += response.data.length;
}
```

## Cleaning Up

### Reset database
```bash
docker compose down postgres
docker volume rm data-sync-ingestion-coding-challenge_assignment_postgres_data
docker compose up -d postgres
```

### Clear state file
```bash
rm -f /data/ingestion.state
# Or if using local path:
rm -f packages/ingestion/ingestion.state
```

## Troubleshooting

### "Cannot find module" errors
```bash
cd packages/ingestion
npm install
```

### "Connection refused" to database
```bash
# Check postgres is running
docker compose ps postgres

# Restart if needed
docker compose restart postgres
```

### "EACCES: permission denied" for state file
Either:
1. Create `/data` with permissions: `sudo mkdir -p /data && sudo chmod 777 /data`
2. Or change `stateFilePath` in config.ts to use local directory

### Environment variables not loading
Make sure you're in the right directory when running, or use:
```bash
# Explicit env file
node --loader ts-node/esm --env-file=../../.env src/index.ts
```

Or use `dotenv`:
```bash
cd packages/ingestion
npm install dotenv
```

Then add to top of `index.ts`:
```typescript
import 'dotenv/config';
```
