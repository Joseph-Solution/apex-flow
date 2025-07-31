import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client, checkDatabaseConnection } from './connection';
import path from 'path';
import fs from 'fs';

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  try {
    // Check database connection first
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    console.log('✅ Database connection established');
    
    // Check if migrations folder exists and has files
    const migrationsFolder = path.join(__dirname, '../../migrations');
    const journalPath = path.join(migrationsFolder, 'meta/_journal.json');
    
    if (!fs.existsSync(journalPath)) {
      console.log('⚠️  No migration journal found, skipping migrations');
      return;
    }
    
    // Run migrations
    await migrate(db, { migrationsFolder });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };