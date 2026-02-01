#!/bin/bash
set -e

echo "=============================================="
echo "Local Development Setup"
echo "=============================================="

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "Error: .env file not found"
  echo "Please create .env with your API key"
  exit 1
fi

# Start postgres only
echo "Starting PostgreSQL..."
docker compose up -d postgres

echo "Waiting for PostgreSQL to be ready..."
sleep 3

# Check postgres is healthy
if ! docker compose ps postgres | grep -q "healthy"; then
  echo "Waiting for PostgreSQL health check..."
  sleep 5
fi

echo ""
echo "PostgreSQL is ready!"
echo ""
echo "You can now run commands locally:"
echo "  cd packages/ingestion"
echo "  npm run test      # Test API connection"
echo "  npm run explore   # Explore API capabilities"
echo "  npm start         # Run full ingestion"
echo ""
echo "Database connection:"
echo "  psql postgresql://postgres:postgres@localhost:5434/ingestion"
echo ""
echo "To stop PostgreSQL:"
echo "  docker compose down postgres"
echo "=============================================="
