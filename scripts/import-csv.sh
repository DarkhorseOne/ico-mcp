#!/bin/bash

# SQLite CSV Import Script for ICO Registrations
# This script uses the system sqlite3 CLI to import CSV data

set -e  # Exit on error

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSV_FILE="${PROJECT_ROOT}/register-of-data-controllers.csv"
DB_FILE="${PROJECT_ROOT}/data/ico.db"
DATA_DIR="${PROJECT_ROOT}/data"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}ICO Registration Database Import${NC}"
echo "=================================="

# Check if CSV file exists
if [ ! -f "$CSV_FILE" ]; then
    echo -e "${RED}Error: CSV file not found: $CSV_FILE${NC}"
    exit 1
fi

# Check if sqlite3 is installed
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}Error: sqlite3 command not found. Please install SQLite3.${NC}"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

echo -e "${YELLOW}CSV file: $CSV_FILE${NC}"
echo -e "${YELLOW}Database: $DB_FILE${NC}"

# Get file size and SHA256
FILE_SIZE=$(stat -f%z "$CSV_FILE" 2>/dev/null || stat -c%s "$CSV_FILE" 2>/dev/null)
FILE_SHA256=$(shasum -a 256 "$CSV_FILE" | cut -d' ' -f1)

echo "File size: $FILE_SIZE bytes"
echo "File SHA256: $FILE_SHA256"

# Backup existing database if it exists
if [ -f "$DB_FILE" ]; then
    BACKUP_FILE="${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}Backing up existing database to: $BACKUP_FILE${NC}"
    cp "$DB_FILE" "$BACKUP_FILE"
fi

echo -e "${GREEN}Creating database schema...${NC}"

# Create database and tables
sqlite3 "$DB_FILE" <<'EOF'
-- Create ICO registrations table
CREATE TABLE IF NOT EXISTS ico_registrations (
    registration_number TEXT PRIMARY KEY,
    organisation_name TEXT NOT NULL,
    organisation_address_line_1 TEXT,
    organisation_address_line_2 TEXT,
    organisation_address_line_3 TEXT,
    organisation_address_line_4 TEXT,
    organisation_address_line_5 TEXT,
    organisation_postcode TEXT,
    public_authority TEXT,
    start_date_of_registration DATE,
    end_date_of_registration DATE,
    trading_names TEXT,
    payment_tier TEXT,
    dpo_title TEXT,
    dpo_first_name TEXT,
    dpo_last_name TEXT,
    dpo_organisation TEXT,
    dpo_email TEXT,
    dpo_phone TEXT,
    dpo_address_line_1 TEXT,
    dpo_address_line_2 TEXT,
    dpo_address_line_3 TEXT,
    dpo_address_line_4 TEXT,
    dpo_address_line_5 TEXT,
    dpo_postcode TEXT,
    public_register_entry_url TEXT
);

-- Create data versions table
CREATE TABLE IF NOT EXISTS data_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_sha256 TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    record_count INTEGER,
    download_url TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clear existing data
DELETE FROM ico_registrations;
EOF

echo -e "${GREEN}Importing CSV data...${NC}"
echo "This may take several minutes for large files..."

# Import CSV data using sqlite3
# Note: SQLite's .import command expects the CSV to have a header row
sqlite3 "$DB_FILE" <<EOF
.mode csv
.import $CSV_FILE ico_registrations_temp

-- Create temp table to match CSV structure
CREATE TABLE IF NOT EXISTS ico_registrations_temp (
    Registration_number TEXT,
    Organisation_name TEXT,
    Organisation_address_line_1 TEXT,
    Organisation_address_line_2 TEXT,
    Organisation_address_line_3 TEXT,
    Organisation_address_line_4 TEXT,
    Organisation_address_line_5 TEXT,
    Organisation_postcode TEXT,
    Public_authority TEXT,
    Start_date_of_registration TEXT,
    End_date_of_registration TEXT,
    Trading_names TEXT,
    Payment_tier TEXT,
    DPO_or_Person_responsible_for_DP_Title TEXT,
    DPO_or_Person_responsible_for_DP_First_name TEXT,
    DPO_or_Person_responsible_for_DP_Last_name TEXT,
    DPO_or_Person_responsible_for_DP_Organisation TEXT,
    DPO_or_Person_responsible_for_DP_Email TEXT,
    DPO_or_Person_responsible_for_DP_Phone TEXT,
    DPO_or_Person_responsible_for_DP_Address_line_1 TEXT,
    DPO_or_Person_responsible_for_DP_Address_line_2 TEXT,
    DPO_or_Person_responsible_for_DP_Address_line_3 TEXT,
    DPO_or_Person_responsible_for_DP_Address_line_4 TEXT,
    DPO_or_Person_responsible_for_DP_Address_line_5 TEXT,
    DPO_or_Person_responsible_for_DP_Postcode TEXT,
    Public_register_entry_URL TEXT
);

-- Import CSV
.import $CSV_FILE ico_registrations_temp

-- Copy data from temp table to main table with column mapping
INSERT INTO ico_registrations
SELECT
    Registration_number,
    Organisation_name,
    Organisation_address_line_1,
    Organisation_address_line_2,
    Organisation_address_line_3,
    Organisation_address_line_4,
    Organisation_address_line_5,
    Organisation_postcode,
    Public_authority,
    Start_date_of_registration,
    End_date_of_registration,
    Trading_names,
    Payment_tier,
    DPO_or_Person_responsible_for_DP_Title,
    DPO_or_Person_responsible_for_DP_First_name,
    DPO_or_Person_responsible_for_DP_Last_name,
    DPO_or_Person_responsible_for_DP_Organisation,
    DPO_or_Person_responsible_for_DP_Email,
    DPO_or_Person_responsible_for_DP_Phone,
    DPO_or_Person_responsible_for_DP_Address_line_1,
    DPO_or_Person_responsible_for_DP_Address_line_2,
    DPO_or_Person_responsible_for_DP_Address_line_3,
    DPO_or_Person_responsible_for_DP_Address_line_4,
    DPO_or_Person_responsible_for_DP_Address_line_5,
    DPO_or_Person_responsible_for_DP_Postcode,
    Public_register_entry_URL
FROM ico_registrations_temp
WHERE Registration_number != '' AND Organisation_name != '';

-- Drop temp table
DROP TABLE ico_registrations_temp;
EOF

echo -e "${GREEN}Creating indexes for performance...${NC}"

# Create indexes
sqlite3 "$DB_FILE" <<'EOF'
CREATE INDEX IF NOT EXISTS idx_organisation_name ON ico_registrations(organisation_name);
CREATE INDEX IF NOT EXISTS idx_registration_number ON ico_registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_postcode ON ico_registrations(organisation_postcode);
CREATE INDEX IF NOT EXISTS idx_end_date ON ico_registrations(end_date_of_registration);
CREATE INDEX IF NOT EXISTS idx_download_date ON data_versions(download_date);
CREATE INDEX IF NOT EXISTS idx_sha256 ON data_versions(file_sha256);
CREATE INDEX IF NOT EXISTS idx_status ON data_versions(status);
EOF

# Get record count
RECORD_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM ico_registrations;")

echo -e "${GREEN}Saving data version information...${NC}"

# Insert version record
sqlite3 "$DB_FILE" <<EOF
INSERT INTO data_versions (download_date, file_sha256, file_size, record_count, download_url, status)
VALUES (datetime('now'), '$FILE_SHA256', $FILE_SIZE, $RECORD_COUNT, 'local-csv-file', 'active');
EOF

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Import completed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo "Total records imported: $RECORD_COUNT"
echo "Database location: $DB_FILE"
echo ""

# Display some sample data
echo -e "${YELLOW}Sample records:${NC}"
sqlite3 -header -column "$DB_FILE" "SELECT registration_number, organisation_name, organisation_postcode FROM ico_registrations LIMIT 5;"
