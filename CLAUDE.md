# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Workflow
```bash
npm run build                    # Compile TypeScript to dist/
npm run setup-db                 # Initialize database from CSV (required first step)
npm run dev:api                  # Start REST API server in development (port 3000)
npm run dev:mcp-http            # Start HTTP MCP server in development (port 3001)
npm run dev:mcp-stdio           # Start stdio MCP server in development
```

### Production Deployment
```bash
npm run start:api               # Production REST API server
npm run start:mcp-http          # Production HTTP MCP server
npm run start:mcp-stdio         # Production stdio MCP server for MCP clients
```

### Database Management
The project requires a CSV file named `register-of-data-controllers.csv` in the project root. Run `npm run setup-db` after placing this file to populate the SQLite database. This process imports ~1.3M records and creates performance indexes.

## Architecture Overview

### Multi-Server Design
This codebase implements three distinct server modes sharing the same business logic:

1. **REST API Server** (`src/api/server.ts`) - Traditional HTTP endpoints
2. **HTTP MCP Server** (`src/mcp/http-server.ts`) - MCP protocol over HTTP
3. **Stdio MCP Server** (`src/mcp/simple-stdio-server.ts`) - MCP protocol over stdio for direct AI integration

All servers use the same `IcoService` and `DatabaseService` layers, ensuring consistent behavior across deployment modes.

### Service Architecture
```
Entry Point (src/index.ts)
    ↓
Server Layer (ApiServer/HttpMcpServer/SimpleStdioMcpServer)
    ↓
Business Logic (IcoService)
    ↓
Data Access (DatabaseService)
    ↓
SQLite Database (data/ico.db)
```

### Key Components

**DatabaseService** (`src/services/database.ts`):
- Manages SQLite connection and schema
- Implements search methods with SQL injection protection
- Handles data versioning with SHA256 checksums
- Uses strategic indexing for performance (organisation_name, registration_number, postcode)

**IcoService** (`src/services/ico-service.ts`):
- Business logic layer abstracting database operations
- Provides high-level methods for common queries
- Handles data statistics and version management

**MCP Tools** (`src/mcp/tools.ts`):
- Defines 6 MCP tools for AI integration
- Each tool maps to specific IcoService methods
- Includes comprehensive JSON schemas for input validation

## Database Schema

### Primary Table: `ico_registrations`
- 26 fields including registration_number (primary key), organisation_name, addresses, DPO information
- Indexed on: organisation_name, registration_number, organisation_postcode, end_date_of_registration
- Contains UK ICO registration data with ~1.3M records

### Versioning Table: `data_versions`
- Tracks data imports with SHA256 checksums
- Maintains file size, record count, and import timestamps
- Supports data lineage and change tracking

## Development Patterns

### TypeScript Interfaces
All data structures are defined in `src/types/ico.ts`:
- `IcoRegistration` - Complete record structure
- `SearchQuery` - Flexible search parameters with optional fields
- `DataVersion` - Version tracking metadata

### Error Handling
Consistent error handling pattern across all servers:
- Database errors are caught and logged
- API responses include success/error status
- MCP responses follow JSON-RPC 2.0 error format

### Logging
Winston-based logging configured in `src/utils/logger.ts`:
- Structured JSON logging for production
- Console output for development
- Separate error log file

## MCP Integration Notes

### Tool Definitions
The service exposes 6 MCP tools for AI interaction:
1. `search_ico_registrations` - Multi-criteria search with pagination
2. `get_ico_registration` - Single record by registration number
3. `get_registrations_by_organisation` - Organization-based search
4. `get_registrations_by_postcode` - Location-based search
5. `get_data_version` - Current data statistics
6. `get_all_data_versions` - Version history

### Protocol Implementation
- **HTTP MCP**: Standard HTTP endpoints following MCP 2024-11-05 specification
- **Stdio MCP**: Line-based JSON-RPC 2.0 message processing for direct integration. **Critical**: stdout reserved for MCP JSON only, stderr must be completely silent (logs only to files), as MCP clients like Claude and LM Studio monitor stderr. All responses include required `jsonrpc: "2.0"` field.
- Both implementations share identical tool logic through the service layer

## Data Management

### CSV Import Process
The `scripts/setup-db.ts` script:
- Processes large CSV files (250MB+) efficiently
- Creates SHA256 checksums for version tracking
- Implements batch processing with progress logging
- Handles data validation and error recovery

### Search Performance
- Organization name searches use `LIKE` with wildcards for partial matching
- Registration number lookups use primary key for O(1) performance
- Postcode searches support partial matching for area-based queries
- All searches support LIMIT/OFFSET pagination

## Configuration

### Environment Variables
- `NODE_ENV` - Controls logging behavior and error verbosity
- `PORT` - Overrides default ports (3000 for API, 3001 for HTTP MCP)
- `DB_PATH` - Custom database location (default: absolute path to project/data/ico.db)
- `LOG_LEVEL` - Winston log level (debug, info, warn, error)

### Path Resolution
**Important**: All file paths use absolute paths resolved from the compiled location. This ensures the service works correctly regardless of the current working directory when started by MCP clients like LM Studio.

- Database: `{projectRoot}/data/ico.db`
- Logs: `{projectRoot}/logs/`
- CSV: `{projectRoot}/register-of-data-controllers.csv`

### Required Files
- `register-of-data-controllers.csv` - Must be in project root for database setup
- `data/ico.db` - Created by setup-db script, contains all ICO registration data  
- `logs/` directory - Created automatically for log file output