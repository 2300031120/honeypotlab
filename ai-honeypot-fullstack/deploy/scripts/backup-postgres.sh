#!/bin/bash
# PostgreSQL Backup Script for CyberSentil Honeypot
# Run daily: 0 2 * * * /path/to/backup-postgres.sh

set -e

# Configuration
DB_HOST="${DATABASE_URL%%@*}"
DB_HOST="${DB_HOST##*://}"
DB_USER="${DATABASE_URL%%:*}"
DB_USER="${DB_USER##*://}"
DB_PASSWORD="${DATABASE_URL##*:}"
DB_PASSWORD="${DB_PASSWORD%%@*}"
DB_NAME="${DATABASE_URL##*/}"
BACKUP_DIR="/backups/honeypot"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate filename with timestamp
BACKUP_FILE="$BACKUP_DIR/honeypot_$(date +%Y%m%d_%H%M%S).sql.gz"

# Perform backup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --verbose \
  --no-password | gzip > "$BACKUP_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed: $BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup size: $SIZE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file not created!"
  exit 1
fi

# Clean old backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process completed successfully."

