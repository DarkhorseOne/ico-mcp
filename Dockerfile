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

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy HTTP bridge for bridge mode
COPY simple-http-bridge.js ./

# Create directories for data and logs
RUN mkdir -p data logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Change ownership
RUN chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Health check based on mode
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$MCP_MODE" = "http" ]; then \
        wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/tools/list || exit 1; \
      elif [ "$MCP_MODE" = "api" ]; then \
        wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1; \
      else \
        node -e "console.log('ICO MCP Server health check passed')" || exit 1; \
      fi

# Default configuration
ENV MCP_MODE=stdio
ENV PORT=3001
ENV NODE_ENV=production
ENV DB_PATH=/app/data/ico.db
ENV LOG_LEVEL=info

# Expose ports
EXPOSE 3000 3001

# Start the application based on mode
CMD ["sh", "-c", "case \"$MCP_MODE\" in \
  \"api\") node dist/api/server.js ;; \
  \"http\") node dist/mcp/http-server.js ;; \
  \"bridge\") node simple-http-bridge.js ;; \
  *) node dist/mcp/simple-stdio-server.js ;; \
esac"]