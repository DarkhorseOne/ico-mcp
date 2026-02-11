#!/bin/bash

# ICO Data Download Script
# Downloads and extracts the latest ICO register data

set -e  # Exit on any error

# Configuration
ICO_BASE_URL="https://ico.org.uk/media2/cfnc5zdf/register-of-data-controllers-"
TARGET_CSV="register-of-data-controllers.csv"
TEMP_ZIP="temp-ico-register.zip"
MAX_DAYS_BACK=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate date string in YYYY-MM-DD format
get_date_string() {
    local days_back=$1
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        date -v-${days_back}d +%Y-%m-%d
    else
        # Linux
        date -d "${days_back} days ago" +%Y-%m-%d
    fi
}

# Function to test if URL exists
test_url_exists() {
    local url=$1
    if curl --output /dev/null --silent --head --fail "$url"; then
        return 0
    else
        return 1
    fi
}

# Function to find and extract CSV from ZIP
extract_csv_from_zip() {
    local zip_file=$1
    local output_file=$2
    
    log_info "Extracting ZIP file: $zip_file"
    
    # Create temporary extraction directory
    local temp_dir=$(mktemp -d)
    
    # Extract ZIP file
    if ! unzip -q "$zip_file" -d "$temp_dir"; then
        log_error "Failed to extract ZIP file"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Find CSV file in extracted contents
    local csv_file=$(find "$temp_dir" -name "*.csv" -type f | head -1)
    
    if [[ -z "$csv_file" ]]; then
        log_error "No CSV file found in ZIP archive"
        rm -rf "$temp_dir"
        return 1
    fi
    
    log_info "Found CSV file: $(basename "$csv_file")"
    
    # Check if target exists as directory and remove it (fixes Docker volume mount issue)
    if [[ -d "$output_file" ]]; then
        log_warn "Target '$output_file' exists as a directory. Removing it..."
        rm -rf "$output_file"
    fi

    # Move CSV file to target location
    if mv "$csv_file" "$output_file"; then
        log_info "CSV file extracted to: $output_file"
        # Clean up
        rm -rf "$temp_dir"
        return 0
    else
        log_error "Failed to move CSV file"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting ICO data download..."
    
    # Check if file already exists and is recent
    if [[ -f "$TARGET_CSV" ]]; then
        local file_age_days
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            file_age_days=$(( ($(date +%s) - $(stat -f %m "$TARGET_CSV")) / 86400 ))
        else
            # Linux
            file_age_days=$(( ($(date +%s) - $(stat -c %Y "$TARGET_CSV")) / 86400 ))
        fi
        
        log_info "Existing file found (${file_age_days} days old)"
        
        if [[ $file_age_days -lt 7 ]] && [[ "$1" != "--force" ]]; then
            log_info "File is less than 7 days old, skipping download"
            log_info "Use --force to download anyway"
            exit 0
        fi
    fi
    
    # Try to find available file from recent days
    local found_url=""
    log_info "Checking for recent ICO data files..."
    
    for (( i=0; i<MAX_DAYS_BACK; i++ )); do
        local date_str=$(get_date_string $i)
        local url="${ICO_BASE_URL}${date_str}.zip"
        
        log_info "Checking: $url"
        
        if test_url_exists "$url"; then
            found_url="$url"
            log_info "Found available file: $url"
            break
        fi
    done
    
    if [[ -z "$found_url" ]]; then
        log_error "No recent ICO data files found. Please check the ICO website manually."
        exit 1
    fi
    
    # Download the ZIP file
    log_info "Downloading ZIP file..."
    if curl -L --progress-bar "$found_url" -o "$TEMP_ZIP"; then
        log_info "Download completed successfully"
    else
        log_error "Failed to download file"
        exit 1
    fi
    
    # Extract CSV from ZIP
    if extract_csv_from_zip "$TEMP_ZIP" "$TARGET_CSV"; then
        log_info "Extraction completed successfully"
    else
        log_error "Failed to extract CSV file"
        exit 1
    fi
    
    # Clean up temporary ZIP file
    if [[ -f "$TEMP_ZIP" ]]; then
        rm -f "$TEMP_ZIP"
        log_info "Cleaned up temporary files"
    fi
    
    # Verify the extracted file
    if [[ -f "$TARGET_CSV" ]]; then
        local file_size=$(du -h "$TARGET_CSV" | cut -f1)
        local line_count=$(wc -l < "$TARGET_CSV")
        log_info "File downloaded successfully: $file_size, $line_count lines"
        
        # Check if it looks like a valid CSV
        local first_line=$(head -n 1 "$TARGET_CSV")
        if [[ "$first_line" == *"Registration_number"* ]] && [[ "$first_line" == *"Organisation_name"* ]]; then
            log_info "CSV file format verified"
        else
            log_warn "File format may not be correct CSV"
            log_warn "First line: ${first_line:0:100}..."
        fi
    else
        log_error "Target file not found after extraction"
        exit 1
    fi
    
    log_info "ICO data download completed successfully!"
    log_info "Run 'npm run setup-db-fast' to import the data into the database"
}

# Help function
show_help() {
    cat << EOF
ICO Data Download Script

Usage: $0 [OPTIONS]

Options:
  --force    Force download even if file exists and is recent
  --help     Show this help message

Description:
  Downloads the latest ICO Register of Data Controllers CSV file from the ICO website.
  The ICO publishes daily ZIP files containing the CSV data.
  The script will automatically find and download the most recent available file.
  
  By default, the script will skip download if the file exists and is less than 7 days old.
  Use --force to download anyway.

Examples:
  $0                  # Download if file is old or missing
  $0 --force          # Force download
  $0 --help           # Show this help

EOF
}

# Parse command line arguments
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"