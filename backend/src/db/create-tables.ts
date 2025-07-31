import { sql } from 'drizzle-orm';
import { db, checkDatabaseConnection, closeDatabaseConnection } from './connection';

async function createTables() {
  console.log('📊 Creating database tables...');
  
  try {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        timezone VARCHAR(50) DEFAULT 'UTC',
        level INTEGER DEFAULT 1 NOT NULL,
        total_xp INTEGER DEFAULT 0 NOT NULL,
        current_level_xp INTEGER DEFAULT 0 NOT NULL,
        next_level_xp INTEGER DEFAULT 100 NOT NULL,
        avatar_config JSONB DEFAULT '{"baseAvatar":"default","accessories":[],"colors":{}}',
        unlocked_items JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{"notifications":{"taskReminders":true,"habitReminders":true,"achievements":true,"weeklyReports":true},"theme":"auto","language":"en","workingHours":{"start":"09:00","end":"17:00"}}',
        is_active BOOLEAN DEFAULT true NOT NULL,
        email_verified BOOLEAN DEFAULT false NOT NULL,
        email_verification_token VARCHAR(255),
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_login_at TIMESTAMP
      );
    `);

    console.log('✅ Users table created');

    // Create basic tables for now - we can expand later
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(50) DEFAULT '🏆',
        category VARCHAR(20) NOT NULL,
        rarity VARCHAR(10) DEFAULT 'common',
        xp_reward INTEGER DEFAULT 50 NOT NULL,
        criteria JSONB NOT NULL,
        unlocked_items JSONB DEFAULT '[]',
        badge_color VARCHAR(7) DEFAULT '#FFD700',
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_secret BOOLEAN DEFAULT false NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ Achievements table created');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(30) NOT NULL,
        title_template VARCHAR(255) NOT NULL,
        message_template TEXT NOT NULL,
        default_priority VARCHAR(10) DEFAULT 'medium' NOT NULL,
        default_channels JSONB DEFAULT '{"inApp":true,"email":false,"push":false}',
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true NOT NULL,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ Notification templates table created');
    console.log('✅ All tables created successfully');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  } finally {
    await closeDatabaseConnection();
  }
}

// Run if called directly
if (require.main === module) {
  createTables();
}

export { createTables };