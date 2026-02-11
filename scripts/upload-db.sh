#!/bin/bash
set -e

# Usage check
if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <user> <host> <remote_path>"
  echo "Example: $0 user 192.168.1.100 /app/data"
  exit 1
fi

USER="$1"
HOST="$2"
REMOTE_PATH="$3"

DB_FILE="data/ico.db"
GZ_FILE="data/ico.db.gz"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
  echo "Error: Database file $DB_FILE not found!"
  exit 1
fi

echo "Compressing database..."
gzip -c "$DB_FILE" > "$GZ_FILE"

echo "Uploading compressed database to $USER@$HOST:$REMOTE_PATH..."
scp "$GZ_FILE" "$USER@$HOST:$REMOTE_PATH/ico.db.gz"

echo "Decompressing on remote server..."
ssh "$USER@$HOST" "cd $REMOTE_PATH && gunzip -f ico.db.gz && mv ico.db.gz ico.db"

echo "Cleanup local compressed file..."
rm "$GZ_FILE"

echo "Done! Database uploaded successfully."
