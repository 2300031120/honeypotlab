-- PostgreSQL Replication Setup
-- This script configures the master database for replication

-- Create replication user
DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'replicator') THEN
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'RepL1c4t0rS3cr3t2026!';
  END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE cybersentinel TO replicator;
GRANT USAGE ON SCHEMA public TO replicator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replicator;

-- Ensure future tables also have SELECT permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO replicator;

-- Create publication for logical replication (optional, for future use)
CREATE PUBLICATION IF NOT EXISTS cybersentinel_pub FOR ALL TABLES;

-- Verify replication configuration
SELECT * FROM pg_replication_slots;
SELECT * FROM pg_stat_replication;
