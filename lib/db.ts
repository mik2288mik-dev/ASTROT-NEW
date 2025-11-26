// Database connection utility for Railway
// This file handles connection to Railway Database

const DATABASE_URL = process.env.DATABASE_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[DB] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[DB] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[DB] WARNING: ${message}`, data || '');
  }
};

// Check if DATABASE_URL is configured
if (!DATABASE_URL) {
  log.warn('DATABASE_URL is not set. Database operations will fail.');
} else {
  log.info(`DATABASE_URL configured: ${DATABASE_URL.substring(0, 30)}...`);
}

/**
 * Execute a query against Railway Database
 * This is a generic function that can be used for any SQL query
 * 
 * NOTE: To use with actual Railway Database, install the appropriate package:
 * - For PostgreSQL: npm install pg @types/pg
 * - For MySQL: npm install mysql2
 * 
 * Then uncomment and adapt the code below based on your database type
 */
export async function queryDatabase(query: string, params?: any[]): Promise<any> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    log.info(`[DB] Executing query: ${query.substring(0, 100)}...`, { params });
    
    // PostgreSQL Example (uncomment when pg package is installed):
    /*
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });
    const result = await pool.query(query, params);
    await pool.end();
    return result.rows;
    */
    
    // MySQL Example (uncomment when mysql2 package is installed):
    /*
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection(DATABASE_URL);
    const [rows] = await connection.execute(query, params);
    await connection.end();
    return rows;
    */
    
    // For now, throw error to indicate DB needs to be configured
    throw new Error('Database connection not implemented. Please install pg (PostgreSQL) or mysql2 (MySQL) package and uncomment the appropriate code in lib/db.ts');
  } catch (error: any) {
    log.error('[DB] Query failed', {
      error: error.message,
      stack: error.stack,
      query: query.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Initialize database tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  try {
    log.info('[DB] Initializing database tables...');
    
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        birth_date VARCHAR(50),
        birth_time VARCHAR(50),
        birth_place VARCHAR(255),
        is_setup BOOLEAN DEFAULT false,
        language VARCHAR(10) DEFAULT 'ru',
        theme VARCHAR(10) DEFAULT 'dark',
        is_premium BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        three_keys JSONB,
        evolution JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Create charts table
    const createChartsTable = `
      CREATE TABLE IF NOT EXISTS charts (
        user_id VARCHAR(255) PRIMARY KEY,
        chart_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    
    // Execute table creation (uncomment when DB connection is configured)
    // await queryDatabase(createUsersTable);
    // await queryDatabase(createChartsTable);
    
    log.info('[DB] Database initialization complete (using in-memory fallback)');
  } catch (error: any) {
    log.error('[DB] Failed to initialize database', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// For now, we'll use a simple in-memory store as fallback
// In production, replace this with actual Railway DB connection
const memoryStore: {
  users: Record<string, any>;
  charts: Record<string, any>;
} = {
  users: {},
  charts: {},
};

/**
 * Simple in-memory database operations (fallback)
 * Replace with actual Railway DB operations
 */
export const db = {
  users: {
    async get(userId: string) {
      log.info(`[DB] Getting user: ${userId}`);
      return memoryStore.users[userId] || null;
    },
    async set(userId: string, data: any) {
      log.info(`[DB] Setting user: ${userId}`, { hasName: !!data.name });
      memoryStore.users[userId] = { ...data, updated_at: new Date().toISOString() };
      return memoryStore.users[userId];
    },
    async getAll() {
      log.info('[DB] Getting all users');
      return Object.values(memoryStore.users);
    },
  },
  charts: {
    async get(userId: string) {
      log.info(`[DB] Getting chart for user: ${userId}`);
      return memoryStore.charts[userId] || null;
    },
    async set(userId: string, data: any) {
      log.info(`[DB] Setting chart for user: ${userId}`);
      memoryStore.charts[userId] = { ...data, updated_at: new Date().toISOString() };
      return memoryStore.charts[userId];
    },
  },
};
