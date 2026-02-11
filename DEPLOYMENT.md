# ICO API Service - Deployment Guide

## Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Build the image
docker-compose build

# 2. Download ICO data (if not already present)
./download-ico-data.sh

# 3. Setup database
docker-compose --profile setup up ico-setup

# 4. Start the service
docker-compose up -d

# 5. Check status
docker-compose ps
```

### Using Control Script

```bash
# Build
./api-control.sh build

# Setup database
./api-control.sh setup

# Start service
./api-control.sh start

# View logs
./api-control.sh logs

# Manual data update
./api-control.sh update

# Stop service
./api-control.sh stop
```

## Service Configuration

### Environment Variables

Create `.env` file from template:
```bash
cp .env.example .env
```

Edit as needed:
```bash
PORT=3000
LOG_LEVEL=info
DB_PATH=/app/data/ico.db
NODE_ENV=production
```

### Automated Updates

The container runs a cron job daily at 2 AM that:
1. Downloads latest ICO data
2. Imports into database (full replacement)
3. Logs to `/app/logs/cron.log`

To change schedule, edit `Dockerfile` line 49:
```dockerfile
RUN echo "0 2 * * * cd /app && ./download-ico-data.sh && /usr/local/bin/node /app/dist/scripts/setup-db-fast.js >> /app/logs/cron.log 2>&1" > /etc/crontabs/apiuser
```

Cron format: `minute hour day month weekday`

Examples:
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 1 * * 0` - Weekly on Sunday at 1 AM

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

```bash
# Container logs
docker-compose logs -f ico-api

# Cron logs
docker exec ico-api cat /app/logs/cron.log

# Application logs
docker exec ico-api cat /app/logs/combined.log
docker exec ico-api cat /app/logs/error.log
```

### Database Stats

```bash
curl http://localhost:3000/api/ico/meta/version
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs ico-api

# Verify build
docker-compose build --no-cache

# Check port availability
lsof -i :3000
```

### Database not found

```bash
# Run setup
docker-compose --profile setup up ico-setup

# Or manually
docker exec ico-api node /app/dist/scripts/setup-db-fast.js
```

### Cron not running

```bash
# Check cron status
docker exec ico-api ps aux | grep crond

# Check cron logs
docker exec ico-api cat /app/logs/cron.log

# Manually trigger update
./api-control.sh update
```

### Data not updating

```bash
# Check download script
docker exec ico-api ./download-ico-data.sh

# Check disk space
docker exec ico-api df -h

# Verify cron schedule
docker exec ico-api cat /etc/crontabs/apiuser
```

## Production Deployment

### Resource Requirements

- CPU: 1 core minimum, 2 cores recommended
- RAM: 512MB minimum, 1GB recommended
- Disk: 2GB minimum (500MB CSV + 400MB DB + logs)

### Security Considerations

1. Run behind reverse proxy (nginx/traefik)
2. Enable HTTPS
3. Set up firewall rules
4. Regular backups of `/data` volume
5. Monitor logs for errors

### Backup Strategy

```bash
# Backup database
docker exec ico-api tar czf /app/data/backup-$(date +%Y%m%d).tar.gz /app/data/ico.db

# Copy to host
docker cp ico-api:/app/data/backup-$(date +%Y%m%d).tar.gz ./backups/

# Restore
docker cp ./backups/backup-20250211.tar.gz ico-api:/app/data/
docker exec ico-api tar xzf /app/data/backup-20250211.tar.gz -C /app/data/
```

### Scaling

For high traffic:
1. Deploy multiple instances behind load balancer
2. Use read-only database replicas
3. Add Redis cache layer
4. Consider PostgreSQL for better concurrency

## Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild
docker-compose build

# Restart
docker-compose restart
```

### Update Data Manually

```bash
./api-control.sh update
```

### Clean Old Logs

```bash
docker exec ico-api find /app/logs -name "*.log" -mtime +30 -delete
```

## API Usage Examples

### Search by Organization
```bash
curl "http://localhost:3000/api/ico/search?organisationName=NHS&limit=5"
```

### Get Specific Registration
```bash
curl "http://localhost:3000/api/ico/ZA081798"
```

### Search by Postcode
```bash
curl "http://localhost:3000/api/ico/postcode/SW1A?limit=10"
```

### Get Version Info
```bash
curl "http://localhost:3000/api/ico/meta/version"
```
