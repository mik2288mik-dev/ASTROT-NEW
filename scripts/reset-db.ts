
import { Pool } from 'pg';

// Get DATABASE_URL from process.env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not configured in environment variables.');
  console.error('Please ensure you have set DATABASE_URL in your .env file or Railway variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function clearDatabase() {
  console.log('Starting database cleanup...');
  
  try {
    const client = await pool.connect();
    
    // List of tables to truncate
    // Order matters due to foreign keys! 
    const tables = [
      'regenerations',
      'deep_dive_analyses',
      'daily_horoscope',
      'daily_horoscopes_cache',
      'user_settings',
      'forecasts_cache',
      'synastry_cache',
      'charts',
      'users',
      // 'migrations' - DO NOT TRUNCATE MIGRATIONS! We want to keep schema state.
    ];

    console.log(`Truncating tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
        // Check if table exists first to avoid errors
        const check = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            );
        `, [table]);
        
        if (check.rows[0].exists) {
            console.log(`Clearing table: ${table}...`);
            await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        } else {
            console.log(`Table ${table} does not exist, skipping.`);
        }
    }

    console.log('Database cleanup completed successfully.');
    client.release();
  } catch (err: any) {
    console.error('Error clearing database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearDatabase();
