import { sql } from "drizzle-orm";
import { db } from "./connection";

/**
 * Database utility functions for common operations
 */

/**
 * Check if a table exists in the database
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      );
    `);

    return result[0]?.exists === true;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Get database version and connection info
 */
export async function getDatabaseInfo() {
  try {
    const versionResult = await db.execute(sql`SELECT version();`);
    const dbSizeResult = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);

    return {
      version: versionResult[0]?.version,
      size: dbSizeResult[0]?.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting database info:", error);
    throw error;
  }
}

/**
 * Reset database sequences (useful for testing)
 */
export async function resetSequences() {
  try {
    // Get all sequences in the public schema
    const sequences = await db.execute(sql`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);

    // Reset each sequence
    for (const seq of sequences) {
      await db.execute(
        sql.raw(`ALTER SEQUENCE ${seq.sequence_name} RESTART WITH 1;`)
      );
    }

    console.log(`Reset ${sequences.length} sequences`);
  } catch (error) {
    console.error("Error resetting sequences:", error);
    throw error;
  }
}

/**
 * Truncate all tables (useful for testing)
 * WARNING: This will delete all data!
 */
export async function truncateAllTables() {
  try {
    // Get all table names in the public schema
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'drizzle_%';
    `);

    if (tables.length === 0) {
      console.log("No tables found to truncate");
      return;
    }

    // Disable foreign key checks temporarily
    await db.execute(sql`SET session_replication_role = replica;`);

    // Truncate each table
    for (const table of tables) {
      await db.execute(
        sql.raw(`TRUNCATE TABLE ${table.tablename} RESTART IDENTITY CASCADE;`)
      );
    }

    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = DEFAULT;`);

    console.log(`Truncated ${tables.length} tables`);
  } catch (error) {
    console.error("Error truncating tables:", error);
    throw error;
  }
}

/**
 * Get table row counts for all tables
 */
export async function getTableCounts() {
  try {
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'drizzle_%';
    `);

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const result = await db.execute(
        sql.raw(`SELECT COUNT(*) as count FROM ${table.tablename};`)
      );
      counts[table.tablename] = parseInt(result[0]?.count || "0");
    }

    return counts;
  } catch (error) {
    console.error("Error getting table counts:", error);
    throw error;
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth() {
  try {
    const info = await getDatabaseInfo();
    const counts = await getTableCounts();

    return {
      status: "healthy",
      info,
      tableCounts: counts,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Execute a raw SQL query (use with caution)
 */
export async function executeRawQuery(query: string) {
  try {
    const result = await db.execute(sql.raw(query));
    return result;
  } catch (error) {
    console.error("Error executing raw query:", error);
    throw error;
  }
}
