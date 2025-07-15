#!/bin/bash

# Test Docker deployment script
set -e

echo "🐳 Testing ICO MCP Docker deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if CSV file exists
if [ ! -f "register-of-data-controllers.csv" ]; then
    log_error "CSV file 'register-of-data-controllers.csv' not found. Please ensure it exists."
    exit 1
fi

# Build the Docker image
log_info "Building Docker image..."
docker build -t ico-mcp-server .

# Test 1: Database setup
log_info "Testing database setup..."
docker-compose --profile setup up ico-setup
if [ $? -eq 0 ]; then
    log_success "Database setup completed"
else
    log_error "Database setup failed"
    exit 1
fi

# Test 2: HTTP MCP Server
log_info "Testing HTTP MCP server..."
docker-compose --profile http up -d ico-mcp-http

# Wait for server to start
sleep 5

# Test the health check
HTTP_PORT=$(docker-compose --profile http port ico-mcp-http 3001 | cut -d: -f2)
if [ -z "$HTTP_PORT" ]; then
    log_error "Failed to get HTTP port"
    docker-compose --profile http down
    exit 1
fi

# Test tools/list endpoint
log_info "Testing /tools/list endpoint..."
RESPONSE=$(curl -s -X POST "http://localhost:$HTTP_PORT/tools/list" -H "Content-Type: application/json" -d '{}')
if echo "$RESPONSE" | grep -q "search_ico_registrations"; then
    log_success "HTTP MCP server is working"
else
    log_error "HTTP MCP server test failed"
    echo "Response: $RESPONSE"
    docker-compose --profile http down
    exit 1
fi

# Test 3: API Server
log_info "Testing REST API server..."
docker-compose --profile api up -d ico-api

# Wait for API server to start
sleep 5

# Test API health
API_PORT=$(docker-compose --profile api port ico-api 3000 | cut -d: -f2)
if [ -z "$API_PORT" ]; then
    log_error "Failed to get API port"
    docker-compose --profile api down
    docker-compose --profile http down
    exit 1
fi

# Test API endpoint
log_info "Testing API health endpoint..."
API_RESPONSE=$(curl -s "http://localhost:$API_PORT/health")
if echo "$API_RESPONSE" | grep -q "ok"; then
    log_success "REST API server is working"
else
    log_error "REST API server test failed"
    echo "Response: $API_RESPONSE"
    docker-compose --profile api down
    docker-compose --profile http down
    exit 1
fi

# Test 4: Bridge mode
log_info "Testing HTTP bridge..."
docker-compose --profile bridge up -d ico-bridge

# Wait for bridge to start
sleep 3

# Check if bridge container is running
if docker ps | grep -q "ico-bridge"; then
    log_success "HTTP bridge is running"
else
    log_error "HTTP bridge failed to start"
    docker-compose --profile bridge down
    docker-compose --profile api down
    docker-compose --profile http down
    exit 1
fi

# Cleanup
log_info "Cleaning up test containers..."
docker-compose --profile bridge down
docker-compose --profile api down
docker-compose --profile http down

log_success "All Docker tests passed! 🎉"
log_info "Available deployment modes:"
echo "  - HTTP MCP Server: docker-compose --profile http up -d ico-mcp-http"
echo "  - REST API Server: docker-compose --profile api up -d ico-api"
echo "  - HTTP Bridge: docker-compose --profile bridge up -d ico-bridge"
echo "  - Stdio MCP Server: docker-compose up -d ico-mcp-stdio"
echo "  - Database setup: docker-compose --profile setup up ico-setup"