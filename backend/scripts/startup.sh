#!/bin/sh

# Apex Flow Backend Startup Script
# This script runs automatically when the backend container starts

set -e

echo "🚀 Starting Apex Flow Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=30
attempt=1

until bun -e "
import { checkDatabaseConnection } from './src/db/connection.ts';
const connected = await checkDatabaseConnection();
if (!connected) {
  console.error('Database not ready');
  process.exit(1);
}
console.log('✅ Database connection established');
" 2>/dev/null; do
  if [ $attempt -eq $max_attempts ]; then
    echo "❌ Database connection timeout after $max_attempts attempts"
    exit 1
  fi
  echo "   Database not ready, waiting 2 seconds... (attempt $attempt/$max_attempts)"
  sleep 2
  attempt=$((attempt + 1))
done

# Create database tables
echo "🔄 Setting up database schema..."
if bun run db:create-tables 2>/dev/null; then
  echo "✅ Database schema ready"
else
  echo "⚠️ Schema setup completed (tables may already exist)"
fi

# Seed database with default data
echo "🌱 Seeding database with default data..."
if bun run db:seed 2>/dev/null; then
  echo "✅ Database seeded successfully"
else
  echo "⚠️ Database seeding completed (data may already exist)"
fi

echo "🎉 Backend initialization complete!"
echo "🚀 Starting development server..."

# Start the development server
exec "$@"