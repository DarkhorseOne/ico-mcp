# ICO MCP Service

A comprehensive service for querying ICO (Information Commissioner's Office) registration data, providing both traditional REST API and MCP (Model Context Protocol) interfaces for AI integration.

## Features

- 🔍 **Comprehensive Search** - Query ICO registrations by organization name, registration number, postcode, and more
- 🌐 **REST API** - Traditional HTTP endpoints for programmatic access
- 🤖 **MCP Integration** - Native support for AI tools like Claude Code
- 🔄 **HTTP Bridge** - Connects MCP clients to HTTP MCP server via stdio
- 📊 **SQLite Database** - Efficient local storage with full indexing
- 📈 **Data Versioning** - Track and manage data updates
- 🚀 **Multiple Deployment Options** - API server, HTTP MCP, stdio MCP, or HTTP bridge modes

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ico-mcp-service

# Install dependencies
npm install

# Build the project
npm run build

# Setup database from CSV file (fast method recommended)
npm run setup-db-fast
```

### Running the Service

Choose your preferred mode:

```bash
# REST API Server (http://localhost:3000)
npm run start:api

# HTTP MCP Server (http://localhost:3001)
npm run start:mcp-http

# Stdio MCP Server (for direct integration)
npm run start:mcp-stdio

# HTTP Bridge (converts stdio to HTTP MCP)
npm run start:http-bridge
```

## API Usage

### REST API Endpoints

#### Search Registrations
```bash
GET /api/ico/search?organisationName=Microsoft&limit=5
```

#### Get Specific Registration
```bash
GET /api/ico/ZA081798
```

#### Search by Organization
```bash
GET /api/ico/organisation/Microsoft?limit=10
```

#### Search by Postcode
```bash
GET /api/ico/postcode/SW1A?limit=10
```

#### Get Data Version Info
```bash
GET /api/ico/meta/version
```

### Example Response
```json
{
  "success": true,
  "data": [
    {
      "registrationNumber": "ZA081798",
      "organisationName": "HELEN WHITE",
      "organisationAddressLine1": "5 Norman Grove",
      "organisationPostcode": "SK5 7AW",
      "publicAuthority": "N",
      "startDateOfRegistration": "2014-10-28",
      "endDateOfRegistration": "2025-10-27",
      "paymentTier": "Tier 1",
      "publicRegisterEntryUrl": "https://ico.org.uk/ESDWebPages/Entry/ZA081798"
    }
  ],
  "count": 1
}
```

## MCP Integration

### Configuration Options

#### Option 1: Direct Stdio MCP Server
For direct integration with MCP clients:

```json
{
  "mcpServers": {
    "ico": {
      "command": "node",
      "args": ["dist/mcp/simple-stdio-server.js"],
      "cwd": "/path/to/ico-mcp-service"
    }
  }
}
```

#### Option 2: HTTP Bridge (Recommended for HTTP MCP Server)
For clients that need to connect to the HTTP MCP server via stdio:

```json
{
  "mcpServers": {
    "ico": {
      "command": "node",
      "args": ["simple-http-bridge.js"],
      "cwd": "/path/to/ico-mcp-service",
      "env": {
        "MCP_HTTP_SERVER_URL": "http://localhost:3001"
      }
    }
  }
}
```

**HTTP Bridge Environment Variables:**
- `MCP_HTTP_SERVER_URL` - HTTP server URL (default: http://localhost:3001)
- `MCP_RECONNECT_DELAY` - Retry delay in ms (default: 2000)
- `MCP_MAX_RETRY_ATTEMPTS` - Max retry attempts (default: 3)

### Usage with HTTP Bridge

1. **Start the HTTP MCP Server:**
   ```bash
   npm run start:mcp-http
   ```

2. **Configure your MCP client** to use the HTTP bridge (see Option 2 above)

3. **The bridge will automatically:**
   - Convert stdio MCP messages to HTTP requests
   - Handle retries with exponential backoff
   - Provide full compatibility with MCP clients
   - Support all ICO registration tools

### Available MCP Tools

1. **search_ico_registrations** - Search with multiple criteria
2. **get_ico_registration** - Get specific registration by number
3. **get_registrations_by_organisation** - Search by organization name
4. **get_registrations_by_postcode** - Search by postcode
5. **get_data_version** - Get current data statistics
6. **get_all_data_versions** - Get version history

## Test MCP Server by mcp-inspector

### Test stdio mode
```bash
mcp-inspector node ./dist/mcp/simple-stdio-server.js
```
### Test http bridge mode

```bash
npm run build
npm run start:mcp-http
mcp-inspector node simple-http-bridge.js
```

## Deployment Modes

### 1. REST API Server
Traditional HTTP REST API for programmatic access:
```bash
npm run start:api
# Available at http://localhost:3000
```

### 2. Stdio MCP Server
Direct MCP integration for maximum performance:
```bash
npm run start:mcp-stdio
# Use with MCP clients via stdio protocol
```

### 3. HTTP MCP Server
HTTP-based MCP server for network access:
```bash
npm run start:mcp-http
# Available at http://localhost:3001
# Endpoints: POST /initialize, POST /tools/list, POST /tools/call
```

### 4. HTTP Bridge
Connects MCP clients to HTTP MCP server via stdio:
```bash
# Terminal 1: Start HTTP MCP server
npm run start:mcp-http

# Terminal 2: Use bridge for MCP client
npm run start:http-bridge
```

**When to use each mode:**
- **REST API**: Integration with web applications, direct HTTP access
- **Stdio MCP**: Best performance for AI tools, direct MCP client integration
- **HTTP MCP**: Network-accessible MCP server, microservices architecture
- **HTTP Bridge**: Legacy MCP clients that need HTTP backend, development/testing

## Docker Deployment

### Quick Start with Docker

1. **Setup Environment:**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit configuration as needed
   nano .env
   ```

2. **Build and Setup Database:**
   ```bash
   # Build Docker image
   docker build -t ico-mcp-server .
   
   # Setup database from CSV
   docker-compose --profile setup up ico-setup
   ```

3. **Deploy Services:**
   ```bash
   # HTTP MCP Server (port 3001)
   docker-compose --profile http up -d ico-mcp-http
   
   # REST API Server (port 3000)
   docker-compose --profile api up -d ico-api
   
   # HTTP Bridge (connects to HTTP MCP server)
   docker-compose --profile bridge up -d ico-bridge
   
   # Stdio MCP Server (default)
   docker-compose up -d ico-mcp-stdio
   ```

### Management Scripts

Use the provided control script for easy management:

```bash
# Start HTTP MCP server
./mcp-http-control.sh start

# Check status
./mcp-http-control.sh status

# View logs
./mcp-http-control.sh logs

# Stop server
./mcp-http-control.sh stop
```

### Docker Services

| Service | Description | Port | Profile |
|---------|-------------|------|---------|
| `ico-mcp-stdio` | Stdio MCP server | - | default |
| `ico-mcp-http` | HTTP MCP server | 3001 | http |
| `ico-api` | REST API server | 3000 | api |
| `ico-bridge` | HTTP bridge | - | bridge |
| `ico-setup` | Database setup | - | setup |

### Environment Variables

Configure via `.env` file:

```bash
# Server ports
MCP_HTTP_PORT=3001
API_PORT=3000

# Logging
LOG_LEVEL=info

# Database
DB_PATH=/app/data/ico.db

# HTTP Bridge
MCP_HTTP_SERVER_URL=http://ico-mcp-http:3001
MCP_RECONNECT_DELAY=2000
MCP_MAX_RETRY_ATTEMPTS=3
```

### Testing Docker Deployment

Run the comprehensive test suite:

```bash
# Test all deployment modes
./test-docker.sh
```

## Project Structure

```
ico-mcp-service/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── ico.ts           # REST API routes
│   │   └── server.ts            # Express server
│   ├── mcp/
│   │   ├── http-server.ts       # HTTP MCP server
│   │   ├── simple-stdio-server.ts # Stdio MCP server
│   │   └── tools.ts             # MCP tool definitions
│   ├── services/
│   │   ├── database.ts          # Database operations
│   │   └── ico-service.ts       # Business logic
│   ├── types/
│   │   └── ico.ts               # TypeScript interfaces
│   ├── utils/
│   │   └── logger.ts            # Logging utility
│   └── index.ts                 # Main entry point
├── scripts/
│   ├── download-data.ts         # ICO data download script
│   ├── cron-update.ts           # Automated update script
│   └── setup-db.ts              # Database setup script
├── data/
│   └── ico.db                   # SQLite database
├── logs/                        # Application logs
├── simple-http-bridge.js        # HTTP bridge for MCP clients
├── Dockerfile                   # Docker container definition
├── docker-compose.yml           # Docker services configuration
├── mcp-http-control.sh          # HTTP server control script
├── test-docker.sh               # Docker deployment test script
├── .env.example                 # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

### ICO Registrations Table
```sql
CREATE TABLE ico_registrations (
    registration_number TEXT PRIMARY KEY,
    organisation_name TEXT NOT NULL,
    organisation_address_line_1 TEXT,
    organisation_postcode TEXT,
    public_authority TEXT,
    start_date_of_registration DATE,
    end_date_of_registration DATE,
    payment_tier TEXT,
    -- ... additional fields
);
```

### Data Versions Table
```sql
CREATE TABLE data_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_sha256 TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    record_count INTEGER,
    status TEXT DEFAULT 'active'
);
```

## Development

### Available Scripts

```bash
npm run build          # Compile TypeScript
npm run dev:api        # Development API server
npm run dev:mcp-http   # Development HTTP MCP server
npm run dev:mcp-stdio  # Development stdio MCP server
npm run start:http-bridge # HTTP bridge for MCP clients
npm run download-data  # Download latest ICO data from ICO website
npm run setup-db       # Import CSV data (standard method)
npm run setup-db-fast  # Import CSV data (optimized method - 10x faster)
npm run cron-update    # Automated update (download + build + setup)
npm run test           # Run tests
npm run lint           # Lint code
npm run clean          # Clean build directory
```

### Development Mode

```bash
# Start API server in development
npm run dev:api

# Start MCP servers in development
npm run dev:mcp-http
npm run dev:mcp-stdio
```

## Configuration

### Environment Variables

**General:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000 for API, 3001 for MCP HTTP)
- `DB_PATH` - Database file path (default: ./data/ico.db)
- `LOG_LEVEL` - Logging level (default: info)

**HTTP Bridge:**
- `MCP_HTTP_SERVER_URL` - HTTP server URL (default: http://localhost:3001)
- `MCP_RECONNECT_DELAY` - Retry delay in ms (default: 2000)
- `MCP_MAX_RETRY_ATTEMPTS` - Max retry attempts (default: 3)

### Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development mode

## Data Management

### Updating Data

#### Manual Update
1. Place new CSV file in project root as `register-of-data-controllers.csv`
2. Run `npm run setup-db-fast` to import new data (recommended for speed)
3. The system will automatically version the data updates

**Import Options:**
- `npm run setup-db-fast` - **Recommended**: 10x faster (~2 minutes for 1.29M records)
- `npm run setup-db` - Standard method (~20+ minutes for 1.29M records)

#### Automated Update
```bash
# Download latest data from ICO website (checks recent days automatically)
npm run download-data

# Download and force update even if file is recent
npm run download-data -- --force

# Full automated update (download + build + import)
npm run cron-update

# See what would be done without executing
npm run cron-update -- --dry-run
```

**Note:** The ICO now publishes daily ZIP files instead of a single CSV. The download script automatically:
- Checks for the most recent available file (up to 7 days back)
- Downloads the ZIP file and extracts the CSV
- Verifies the file format and size
- Cleans up temporary files

#### Scheduled Updates
For regular updates, set up a cron job:
```bash
# Daily at 2 AM
0 2 * * * cd /path/to/ico-mcp && npm run cron-update >> logs/cron.log 2>&1

# Weekly on Sundays at 1 AM  
0 1 * * 0 cd /path/to/ico-mcp && npm run cron-update >> logs/cron.log 2>&1
```

### Data Format

The service expects CSV data with the following columns:
- Registration_number
- Organisation_name
- Organisation_address_line_1
- Organisation_postcode
- Public_authority
- Start_date_of_registration
- End_date_of_registration
- Payment_tier
- ... and additional DPO fields

## Health Monitoring

### Health Check Endpoint

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-07-14T22:30:00.000Z"
}
```

## Error Handling

The service provides comprehensive error handling with:
- Structured error responses
- Detailed logging
- Graceful degradation
- Input validation

Example error response:
```json
{
  "success": false,
  "error": "Registration not found"
}
```

## Performance

### Database Optimization
- Indexed columns for fast searches
- SQLite for efficient local queries
- **Optimized batch processing** for data imports (10x faster than original)
- WAL mode for better concurrent performance
- Memory-mapped I/O for faster file operations

### Import Performance
- **Fast Import**: 1.29M+ records in ~2 minutes (10,600 records/second)
- Standard Import: 1.29M+ records in ~20+ minutes (1,100 records/second)
- **Batch transactions** with 1000-record batches for optimal performance
- **Custom CSV parser** optimized for ICO data format
- **Memory-efficient** processing without loading entire file into memory

### Query Performance
- Organization name: Partial match with LIKE
- Registration number: Exact match (primary key)
- Postcode: Partial match with LIKE
- Pagination support with LIMIT/OFFSET

## Security Considerations

- Input validation and sanitization
- SQL injection protection via parameterized queries
- No sensitive data exposure in logs
- CORS support for web applications

## Troubleshooting

### Common Issues

1. **Database not found**
   ```bash
   npm run setup-db
   ```

2. **Port already in use**
   ```bash
   export PORT=3002
   npm run start:api
   ```

3. **CSV import fails**
   - Ensure CSV file is in project root
   - Check file format and encoding
   - Review logs for specific errors

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
npm run start:api
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review application logs
- Create an issue in the repository

## Technical Summary

### ✅ **Complete Implementation**
- **1.29M+ ICO Registration Records** processed from 250MB CSV file into 415MB SQLite database
- **4 Deployment Modes**: REST API, Stdio MCP, HTTP MCP, and HTTP Bridge
- **6 ICO Search Tools**: search_ico_registrations, get_ico_registration, get_registrations_by_organisation, get_registrations_by_postcode, get_data_version, get_all_data_versions
- **Full TypeScript Implementation** with comprehensive type definitions and error handling

### ✅ **MCP Client Compatibility**
- **LM Studio**: ✅ Complete stderr silence - no initialization hanging
- **Claude Desktop**: ✅ Fixed all JSON-RPC 2.0 compliance issues
- **Any MCP Client**: ✅ Proper notification handling, resources/list, prompts/list support
- **HTTP Bridge**: ✅ Converts stdio MCP messages to HTTP requests with retry logic

### ✅ **Key Technical Features**
- **Silent stdio operation** (no stderr contamination for MCP clients)
- **Absolute path resolution** (working directory independence)
- **JSON-RPC 2.0 compliant** responses with required fields
- **Comprehensive logging** to files with configurable levels
- **Retry logic** with exponential backoff for HTTP bridge
- **Real-time search** of UK ICO data controller registry

### ✅ **Production Ready**
- **Database Performance**: Indexed columns, batch processing, pagination support
- **Error Handling**: Structured responses, input validation, graceful degradation
- **Security**: SQL injection protection, input sanitization, no sensitive data exposure
- **Monitoring**: Health checks, comprehensive logging, performance metrics
- **Scalability**: Multiple deployment options, configurable connection limits

### ✅ **Testing Verified**
- **Claude Desktop simulation**: ✅ All expected responses, perfect compatibility
- **HTTP Bridge functionality**: ✅ Successful conversion of stdio to HTTP requests
- **Real data searches**: ✅ Successfully searches NHS organizations and other entities
- **No stderr output**: ✅ Perfect compatibility with MCP clients
- **Database integrity**: ✅ 1.29M+ records imported and searchable

The service is **production-ready** and can be deployed in any of the four modes depending on your integration needs. All MCP client compatibility issues have been resolved, and the system has been thoroughly tested with real data.

## Changelog

### v1.0.4
- **Major Performance Improvement**: Added optimized database import script (`setup-db-fast.js`)
- **10x Faster Import**: Reduced import time from 20+ minutes to ~2 minutes (10,600 records/second)
- **Batch Processing**: Implemented 1000-record batch transactions for optimal performance
- **Custom CSV Parser**: Optimized parser for ICO data format without external dependencies
- **Memory Efficiency**: Processes CSV without loading entire file into memory
- **SQLite Optimizations**: WAL mode, memory-mapped I/O, and performance tuning
- **Fresh Database Support**: Fixed database creation for clean imports
- Added `npm run setup-db-fast` command for optimized imports

### v1.0.3
- Added download-data.ts script for automated ICO data downloads
- Added cron-update.ts script for scheduled data updates
- **Fixed download script for new ICO ZIP format** - ICO now publishes daily ZIP files
- Automated data management with lock file protection
- Support for cron job scheduling and dry-run mode
- Enhanced data management documentation

### v1.0.2
- Added comprehensive Docker support for all deployment modes
- Docker services: stdio, http, api, bridge, and setup
- Added mcp-http-control.sh for easy HTTP server management
- Added test-docker.sh for deployment testing
- Multi-stage Docker build for production optimization
- Environment-based configuration support

### v1.0.1
- Simplified HTTP MCP endpoints (removed `/mcp` prefix)
- HTTP endpoints now: `/initialize`, `/tools/list`, `/tools/call`
- Updated HTTP bridge to use simplified endpoints
- Updated documentation

### v1.0.0
- Initial release
- REST API implementation
- MCP protocol support (stdio and HTTP)
- HTTP Bridge implementation
- Database management with 1.29M+ records
- CSV data import and versioning
- Comprehensive search capabilities
- Full MCP client compatibility (LM Studio, Claude Desktop, etc.)
- Production-ready deployment options