# ICO MCP Service

A comprehensive service for querying ICO (Information Commissioner's Office) registration data, providing both traditional REST API and MCP (Model Context Protocol) interfaces for AI integration.

## Features

- 🔍 **Comprehensive Search** - Query ICO registrations by organization name, registration number, postcode, and more
- 🌐 **REST API** - Traditional HTTP endpoints for programmatic access
- 🤖 **MCP Integration** - Native support for AI tools like Claude Code
- 📊 **SQLite Database** - Efficient local storage with full indexing
- 📈 **Data Versioning** - Track and manage data updates
- 🚀 **Multiple Deployment Options** - API server, HTTP MCP, or stdio MCP modes

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

# Setup database from CSV file
npm run setup-db
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

### For Claude Code

Add to your MCP client configuration:

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

### Available MCP Tools

1. **search_ico_registrations** - Search with multiple criteria
2. **get_ico_registration** - Get specific registration by number
3. **get_registrations_by_organisation** - Search by organization name
4. **get_registrations_by_postcode** - Search by postcode
5. **get_data_version** - Get current data statistics
6. **get_all_data_versions** - Get version history

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
│   └── setup-db.ts              # Database setup script
├── data/
│   └── ico.db                   # SQLite database
├── logs/                        # Application logs
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
npm run setup-db       # Import CSV data
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

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000 for API, 3001 for MCP HTTP)
- `DB_PATH` - Database file path (default: ./data/ico.db)
- `LOG_LEVEL` - Logging level (default: info)

### Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development mode

## Data Management

### Updating Data

1. Place new CSV file in project root as `register-of-data-controllers.csv`
2. Run `npm run setup-db` to import new data
3. The system will automatically version the data updates

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
- Batch processing for data imports

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

## Changelog

### v1.0.0
- Initial release
- REST API implementation
- MCP protocol support
- Database management
- CSV data import
- Comprehensive search capabilities