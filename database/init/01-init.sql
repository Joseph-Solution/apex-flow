-- Initialize Apex Flow Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Create initial database structure will be handled by Drizzle migrations
-- This file ensures the database directory structure exists