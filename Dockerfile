# Multi-stage build for production
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install dcron and su-exec for scheduled tasks and user switching
RUN apk add --no-cache dcron wget su-exec

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy scripts
COPY download-ico-data.sh ./
COPY scripts ./scripts

# Create directories for data and logs
RUN mkdir -p data logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001

# Setup cron job for data updates (daily at 2 AM)
RUN echo "0 2 * * * cd /app && ./download-ico-data.sh && /usr/local/bin/node /app/dist/scripts/setup-db-fast.js >> /app/logs/cron.log 2>&1" > /etc/crontabs/apiuser

# Copy startup script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh download-ico-data.sh

# Change ownership
RUN chown -R apiuser:nodejs /app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Default configuration
ENV PORT=3000
ENV NODE_ENV=production
ENV DB_PATH=/app/data/ico.db
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3000

CMD ["./docker-start.sh"]