#!/usr/bin/env node
/**
 * Migration script for Railway
 * Run this script during deployment: npm run migrate
 */

import { runMigrations } from '../lib/migrations';

async function main() {
  console.log('🚀 Starting database migrations...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your environment variables');
    process.exit(1);
  }

  // Log DATABASE_URL info (without sensitive data)
  const dbUrl = process.env.DATABASE_URL;
  const urlMatch = dbUrl.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (urlMatch) {
    const [, , user, , host, port, database] = urlMatch;
    console.log(`📊 Database: ${host}:${port}/${database} (user: ${user})`);
    
    if (host.includes('railway.internal')) {
      console.warn('Warning: Using Railway internal hostname');
      console.warn('   This may not be accessible from Docker containers outside Railway network');
      console.warn('   Consider using Railway public database URL instead');
    }
  }
  
  try {
    await runMigrations();
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('');
      console.error('💡 Troubleshooting tips:');
      console.error('   1. Verify DATABASE_URL is correct');
      console.error('   2. If using Railway internal hostname, use public URL instead');
      console.error('   3. Check network connectivity and DNS settings');
      console.error('   4. Ensure database service is running on Railway');
    }
    
    process.exit(1);
  }
}

main();
