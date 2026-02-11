# ICO REST API Service

A REST API service for querying ICO (Information Commissioner's Office) registration data with automated daily updates.

## Features

- 🔍 **Comprehensive Search** - Query ICO registrations by organization name, registration number, postcode, and more
- 🌐 **REST API** - Clean HTTP endpoints for programmatic access
- 🔄 **Automated Updates** - Daily scheduled downloads and imports from ICO website
- 📊 **SQLite Database** - Efficient local storage with full indexing (1.3M+ records)
- 📈 **Data Versioning** - Track and manage data updates with SHA256 hashing
- 🐳 **Docker Ready** - Single container deployment with built-in cron scheduling

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Docker (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ico-api-service

# Install dependencies
npm install

# Build the project
npm run build

# Download latest ICO data
npm run download-data

# Setup database (fast method - ~2 minutes for 1.3M records)
npm run setup-db-fast
```

### Running the Service

```bash
# Using the control script (Recommended)
./api-control.sh start

# Or using npm (Development)
npm run dev

# Or using npm (Production)
npm start
```

The API will be available at `http://localhost:26002`

## API Endpoints

### Search Registrations
```bash
GET /api/ico/search?organisationName=Microsoft&limit=5
```

**Query Parameters:**
- `organisationName` - Organization name (partial match)
- `registrationNumber` - Exact registration number
- `postcode` - Postcode (partial match)
- `publicAuthority` - Y/N for public authority
- `paymentTier` - Payment tier (e.g., "Tier 1", "Tier 2")
- `limit` - Maximum results (default: 10)
- `offset` - Pagination offset (default: 0)

### Get Specific Registration
```bash
GET /api/ico/ZA081798
```

### Search by Organization
```bash
GET /api/ico/organisation/Microsoft?limit=10
```

### Search by Postcode
```bash
GET /api/ico/postcode/SW1A?limit=10
```

### Get Data Version Info
```bash
GET /api/ico/meta/version
```

### Get All Data Versions
```bash
GET /api/ico/meta/versions
```

### Health Check
```bash
GET /health
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

## Docker Deployment

### Quick Start with Docker

The project includes a control script `api-control.sh` for easy management:

```bash
# Build Docker image
./api-control.sh build

# Initial database setup
./api-control.sh setup

# Start the service
./api-control.sh start

# Check logs
./api-control.sh logs
```

Alternatively, you can use docker-compose directly:

```bash
# Build image
docker-compose build

# Run with docker-compose
docker-compose up -d

# Initial database setup
docker-compose --profile setup up ico-setup
```

### Docker Configuration

The container includes:
- REST API server on port 26002
- Automated daily data updates (2 AM via cron)
- Health checks every 30 seconds
- Persistent data and logs via volumes

### Environment Variables

```bash
PORT=26002                    # API server port
NODE_ENV=production          # Environment mode
DB_PATH=/app/data/ico.db    # Database path
LOG_LEVEL=info              # Logging level
```

### Docker Compose Services

- `ico-api` - Main API server with automated updates
- `ico-setup` - One-time database setup utility

## Data Management

### Automated Updates

The Docker container includes a cron job that runs daily at 2 AM:
1. Downloads latest ICO data from website
2. Imports data into SQLite database (full replacement)
3. Logs results to `/app/logs/cron.log`

### Manual Updates

You can trigger a manual update using the control script:

```bash
./api-control.sh update
```

Or using npm scripts locally:

```bash
# Download latest data
npm run download-data

# Import into database (fast method)
npm run setup-db-fast
```

### Data Update Strategy

**Full Replacement Approach:**
- Downloads complete dataset daily (~500MB CSV)
- Imports 1.3M+ records in ~2 minutes
- Uses `INSERT OR REPLACE` for data consistency
- Tracks versions with SHA256 hashing
- Simple, reliable, no sync issues

## Project Structure

```
ico-api-service/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── ico.ts           # REST API routes
│   │   └── server.ts            # Express server
│   ├── services/
│   │   ├── database.ts          # Database operations
│   │   └── ico-service.ts       # Business logic
│   ├── types/
│   │   └── ico.ts               # TypeScript interfaces
│   ├── utils/
│   │   └── logger.ts            # Logging utility
│   └── scripts/
│       └── setup-db-fast.ts     # Fast CSV import
├── scripts/
│   └── cron-update.ts           # Automated update script
├── download-ico-data.sh         # Data download script
├── data/
│   └── ico.db                   # SQLite database
├── logs/                        # Application logs
├── Dockerfile                   # Docker container definition
├── docker-compose.yml           # Docker services
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
npm run dev            # Development server
npm start              # Production server
npm run download-data  # Download latest ICO data
npm run setup-db-fast  # Fast database import
npm run cron-update    # Full update cycle
npm test               # Run tests
npm run lint           # Lint code
npm run clean          # Clean build directory
```

### Code Style

- TypeScript with strict mode
- CommonJS modules
- Express.js for REST API
- Winston for logging
- SQLite for data storage
- Parameterized queries for security

## Performance

- **Database**: 396MB SQLite with 1.3M+ records
- **Import Speed**: ~2 minutes for full dataset (10,600 records/second)
- **Query Performance**: Indexed searches on name, postcode, registration number
- **API Response**: Sub-second for most queries with pagination

## Security

- Parameterized SQL queries prevent injection
- Input validation and sanitization
- No sensitive data in logs
- CORS support for web applications
- Non-root user in Docker container

## Monitoring

### Health Check
```bash
curl http://localhost:26002/health
```

### Logs
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/cron.log` - Automated update logs (Docker)

## Troubleshooting

### Database not found
```bash
npm run setup-db-fast
```

### Port already in use
```bash
export PORT=3002
npm start
```

### CSV import fails
- Ensure CSV file is in project root
- Check file format and encoding
- Review logs for specific errors

### Docker container not updating
- Check cron logs: `docker exec ico-api cat /app/logs/cron.log`
- Verify download script permissions
- Check disk space for data directory

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review application logs
- Create an issue in the repository

## Changelog

### v2.0.0
- **Major Simplification**: Removed MCP protocol support
- **REST API Only**: Focused on clean REST endpoints
- **Automated Updates**: Built-in cron scheduling in Docker
- **Full Replacement Strategy**: Simple, reliable data updates
- **Improved Performance**: Optimized for 1.3M+ records
- **Simplified Deployment**: Single Docker container
- **Removed Dependencies**: Cleaned up unused packages
