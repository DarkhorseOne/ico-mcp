#!/bin/bash

# ICO API Service Control Script

set -e

CONTAINER_NAME="ico-api"
IMAGE_NAME="ico-api"

case "$1" in
  start)
    echo "Starting ICO API Service..."
    docker-compose up -d
    echo "Service started. Check status with: $0 status"
    ;;
    
  stop)
    echo "Stopping ICO API Service..."
    docker-compose down
    echo "Service stopped."
    ;;
    
  restart)
    echo "Restarting ICO API Service..."
    docker-compose restart
    echo "Service restarted."
    ;;
    
  status)
    docker-compose ps
    ;;
    
  logs)
    docker-compose logs -f ico-api
    ;;
    
  build)
    echo "Building ICO API Service..."
    docker-compose build
    echo "Build complete."
    ;;
    
  setup)
    echo "Setting up database..."
    docker-compose --profile setup up ico-setup
    echo "Database setup complete."
    ;;
    
  update)
    echo "Updating data..."
    docker exec $CONTAINER_NAME /app/download-ico-data.sh
    docker exec $CONTAINER_NAME node /app/dist/scripts/setup-db-fast.js
    echo "Data update complete."
    ;;
    
  shell)
    docker exec -it $CONTAINER_NAME sh
    ;;
    
  *)
    echo "ICO API Service Control Script"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs|build|setup|update|shell}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the service"
    echo "  stop    - Stop the service"
    echo "  restart - Restart the service"
    echo "  status  - Show service status"
    echo "  logs    - Show and follow logs"
    echo "  build   - Build Docker image"
    echo "  setup   - Initial database setup"
    echo "  update  - Manual data update"
    echo "  shell   - Open shell in container"
    exit 1
    ;;
esac
