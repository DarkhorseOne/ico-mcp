# AGENTS.md - ICO MCP Service Development Guide

This guide provides essential information for AI coding agents working on the ICO MCP Service codebase.

## Project Overview

ICO MCP Service is a TypeScript/Node.js application providing ICO registration data through REST API and MCP (Model Context Protocol) interfaces. It uses SQLite for data storage and supports multiple deployment modes.

## Build & Development Commands

### Essential Commands
```bash
npm run build                    # Compile TypeScript to dist/
npm run clean                    # Remove dist/ directory
npm test                         # Run Jest test suite
npm run lint                     # Run ESLint on src/**/*.ts
```

### Development Servers
```bash
npm run dev:api                  # REST API server (port 26002)
npm run dev:mcp-http            # HTTP MCP server (port 3001)
npm run dev:mcp-stdio           # Stdio MCP server
```

### Production Servers
```bash
npm run start:api               # Production REST API
npm run start:mcp-http          # Production HTTP MCP
npm run start:mcp-stdio         # Production stdio MCP
npm run start:http-bridge       # HTTP bridge for MCP clients
```

### Database Management
```bash
npm run setup-db-fast           # Fast CSV import (~2 min for 1.29M records) - RECOMMENDED
npm run setup-db                # Standard CSV import (~20+ min)
npm run download-data           # Download latest ICO data from website
npm run cron-update             # Full update cycle (download + build + import)
```

### Testing Single Files
```bash
# Jest is configured but no test files exist yet
npm test -- path/to/test.spec.ts
```

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2020
- **Module**: CommonJS
- **Strict mode**: Enabled
- **Source maps**: Enabled
- **Output**: `dist/` directory

### Import Style
```typescript
// External dependencies first
import express from 'express';
import cors from 'cors';
import { Database } from 'sqlite';

// Internal imports - absolute paths from src/
import { DatabaseService } from '../services/database';
import { IcoService } from '../services/ico-service';
import { IcoRegistration, SearchQuery } from '../types/ico';
import { logger } from '../utils/logger';
```

### Naming Conventions
- **Classes**: PascalCase (`DatabaseService`, `IcoService`, `ApiServer`)
- **Interfaces**: PascalCase with descriptive names (`IcoRegistration`, `SearchQuery`, `DataVersion`)
- **Functions/Methods**: camelCase (`searchRegistrations`, `getRegistrationByNumber`)
- **Constants**: UPPER_SNAKE_CASE (`MCP_TOOLS`)
- **Files**: kebab-case for scripts, PascalCase for classes (`setup-db.ts`, `database.ts`)

### Type Definitions
- **Always use explicit types** for function parameters and return values
- **Use interfaces** for data structures (defined in `src/types/ico.ts`)
- **Optional properties**: Use `?` suffix (`organisationPostcode?: string`)
- **Never use `any`** - use proper types or `unknown` with type guards
- **Async functions**: Always declare return type as `Promise<T>`

```typescript
// Good
async getRegistrationByNumber(registrationNumber: string): Promise<IcoRegistration | null> {
  const results = await this.db.searchRegistrations({ registrationNumber });
  return results.length > 0 ? results[0] : null;
}

// Bad
async getRegistrationByNumber(registrationNumber) {
  return await this.db.searchRegistrations({ registrationNumber });
}
```

### Error Handling
- **Always use try-catch** for async operations
- **Log errors** using Winston logger
- **Return structured responses** with success/error status
- **Never expose internal errors** to API responses

```typescript
// API error handling pattern
try {
  const results = await icoService.searchRegistrations(query);
  res.json({
    success: true,
    data: results,
    count: results.length
  });
} catch (error) {
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

### Database Patterns
- **Use parameterized queries** to prevent SQL injection
- **Always check if db is initialized** before operations
- **Use transactions** for batch operations
- **Create indexes** for frequently queried columns

```typescript
// Good - parameterized query
const query = 'SELECT * FROM ico_registrations WHERE registration_number = ?';
await this.db.get(query, [registrationNumber]);

// Bad - string concatenation
const query = `SELECT * FROM ico_registrations WHERE registration_number = '${registrationNumber}'`;
```

### Logging
- **Use Winston logger** from `src/utils/logger.ts`
- **Log levels**: error, warn, info, debug
- **Production**: Logs to files only (`logs/combined.log`, `logs/error.log`)
- **Development**: Logs to console + files
- **MCP stdio mode**: NEVER log to stdout/stderr (breaks protocol)

```typescript
import { logger } from '../utils/logger';

logger.info('Server started on port 26002');
logger.error('Database connection failed:', error);
logger.debug('Query executed:', { query, params });
```

### Path Resolution
- **Always use absolute paths** resolved from project root
- **Never rely on process.cwd()** - use `__dirname` relative resolution
- **Ensure directories exist** before writing files

```typescript
// Good
const projectRoot = path.resolve(__dirname, '../..');
const dbPath = path.join(projectRoot, 'data', 'ico.db');

// Bad
const dbPath = './data/ico.db';
```

### Service Layer Pattern
- **DatabaseService**: Low-level database operations
- **IcoService**: Business logic layer (uses DatabaseService)
- **Server/Routes**: HTTP layer (uses IcoService)
- **Never bypass layers** - always go through the service hierarchy

### MCP Protocol Compliance
- **JSON-RPC 2.0**: All responses must include `jsonrpc: "2.0"`
- **Stdio mode**: stdout reserved for JSON only, stderr must be silent
- **Tool definitions**: Use proper JSON schemas with descriptions
- **Error responses**: Follow JSON-RPC error format

### Express API Patterns
- **Router factory functions**: Export function that takes service as parameter
- **Consistent response format**: `{ success: boolean, data?: any, error?: string }`
- **HTTP status codes**: 200 (success), 404 (not found), 500 (server error)
- **Query parameters**: Parse and validate before use

### Class Structure
```typescript
export class ServiceName {
  private dependency: DependencyType;
  
  constructor(dependency: DependencyType) {
    this.dependency = dependency;
  }
  
  async publicMethod(param: string): Promise<ReturnType> {
    // Implementation
  }
  
  private async privateHelper(): Promise<void> {
    // Helper implementation
  }
}
```

## Architecture Principles

### Multi-Server Design
- Three server modes share the same business logic
- All use `IcoService` and `DatabaseService` layers
- Consistent behavior across deployment modes

### Data Flow
```
Entry Point (index.ts)
    ↓
Server Layer (ApiServer/HttpMcpServer/StdioMcpServer)
    ↓
Business Logic (IcoService)
    ↓
Data Access (DatabaseService)
    ↓
SQLite Database (data/ico.db)
```

### Key Files
- `src/types/ico.ts` - All TypeScript interfaces
- `src/services/database.ts` - Database operations
- `src/services/ico-service.ts` - Business logic
- `src/utils/logger.ts` - Logging configuration
- `src/api/server.ts` - REST API server
- `src/mcp/simple-stdio-server.ts` - Stdio MCP server
- `src/mcp/http-server.ts` - HTTP MCP server
- `src/mcp/tools.ts` - MCP tool definitions

## Common Patterns

### Async/Await
- Always use async/await, never callbacks
- Always handle promise rejections
- Use try-catch for error handling

### Database Initialization
```typescript
const db = new DatabaseService();
await db.initialize(dbPath); // Optional path, defaults to project/data/ico.db
```

### Service Initialization
```typescript
const db = new DatabaseService();
await db.initialize();
const icoService = new IcoService(db);
```

### Search Query Building
```typescript
const query: SearchQuery = {
  organisationName: 'NHS',
  limit: 10,
  offset: 0
};
const results = await icoService.searchRegistrations(query);
```

## Testing Guidelines

- Place tests in `__tests__` directories or use `.test.ts` / `.spec.ts` suffixes
- Tests are excluded from TypeScript compilation
- Use Jest for testing framework
- Mock external dependencies (database, file system)

## Performance Considerations

- Use batch transactions for bulk inserts (1000 records per batch)
- Create indexes on frequently queried columns
- Use LIMIT/OFFSET for pagination
- Enable WAL mode for SQLite concurrent access
- Use memory-mapped I/O for large file operations

## Security Best Practices

- Always use parameterized queries
- Validate and sanitize user input
- Never expose internal error details in API responses
- Use CORS middleware for API server
- No sensitive data in logs

## Common Pitfalls to Avoid

1. **Don't use string concatenation for SQL queries** - always use parameterized queries
2. **Don't log to stdout/stderr in stdio MCP mode** - breaks protocol
3. **Don't use relative paths** - always resolve absolute paths from project root
4. **Don't bypass service layers** - maintain proper architecture
5. **Don't suppress TypeScript errors** - fix the root cause
6. **Don't forget to close database connections** - implement cleanup
7. **Don't mix CommonJS and ES modules** - project uses CommonJS

## Environment Variables

- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 26002 for API, 3001 for MCP HTTP)
- `DB_PATH` - Custom database path (default: project/data/ico.db)
- `LOG_LEVEL` - Winston log level (debug/info/warn/error)
- `MCP_HTTP_SERVER_URL` - HTTP MCP server URL for bridge mode
- `MCP_RECONNECT_DELAY` - Retry delay for HTTP bridge (ms)
- `MCP_MAX_RETRY_ATTEMPTS` - Max retry attempts for HTTP bridge

## Quick Reference

**Add new API endpoint**: Edit `src/api/routes/ico.ts`
**Add new MCP tool**: Edit `src/mcp/tools.ts` and implement in service layer
**Modify database schema**: Edit `src/services/database.ts` createTables method
**Add new search criteria**: Update `SearchQuery` interface in `src/types/ico.ts`
**Change logging behavior**: Edit `src/utils/logger.ts`
