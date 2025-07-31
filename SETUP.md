# Apex Flow - Quick Setup Guide

## For New Team Members

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd apex-flow
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   **Optional**: Edit `.env` to match your system:

   ```bash
   # Add your user ID for proper file permissions
   echo "UID=$(id -u)" >> .env
   echo "GID=$(id -g)" >> .env
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

That's it! 🎉

The application will:

- ✅ Build all containers
- ✅ Start PostgreSQL database
- ✅ Run database migrations automatically
- ✅ Seed default data (achievements, templates)
- ✅ Start backend API on http://localhost:8000
- ✅ Start frontend on http://localhost:3444

## For Existing Team Members

When someone updates the database schema:

```bash
git pull
docker-compose up --build
```

The system automatically handles:

- Database schema migrations
- New seed data
- Container rebuilding

## Useful Commands

```bash
# View logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs database

# Stop all services
docker-compose down

# Reset everything (removes all data)
docker-compose down -v
docker-compose up --build

# Access backend container
docker-compose exec backend sh

# Access database directly
docker-compose exec database psql -U apex_user -d apex_flow_db

# Check database health
docker-compose exec backend bun -e "
import { checkDatabaseHealth } from './src/db/utils.ts';
console.log(JSON.stringify(await checkDatabaseHealth(), null, 2));
"

# Manual database reset (if needed)
docker-compose exec backend bun -e "
import { truncateAllTables } from './src/db/utils.ts';
await truncateAllTables();
console.log('Database reset complete');
"
```

## Troubleshooting

**Database connection issues:**

- Wait a few seconds for the database to initialize
- Check logs: `docker-compose logs database`

**Port conflicts:**

- Make sure ports 3444, 8000, and 5432 are available
- Or change them in `.env` file

**Permission issues:**

- Update UID/GID in `.env` to match your system:
  ```bash
  echo "UID=$(id -u)" >> .env
  echo "GID=$(id -g)" >> .env
  docker-compose up --build
  ```

## Development Workflow

1. Make code changes
2. Containers auto-reload (no restart needed)
3. Database schema changes? Just restart: `docker-compose up --build`

The startup script handles all database operations automatically!
