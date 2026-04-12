-- Data Retention Policies
-- Automatically clean up old data to prevent database bloat

-- Events table: Keep 90 days
DELETE FROM events WHERE created_at < datetime('now', '-90 days');

-- Request logs: Keep 30 days
DELETE FROM request_logs WHERE created_at < datetime('now', '-30 days');

-- Operator actions: Keep 180 days
DELETE FROM operator_actions WHERE created_at < datetime('now', '-180 days');

-- Analytics events: Keep 30 days
DELETE FROM analytics_events WHERE created_at < datetime('now', '-30 days');
