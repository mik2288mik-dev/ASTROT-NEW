#!/usr/bin/env node
/**
 * Migration script for Railway
 * Run this script during deployment: npm run migrate
 */

import { runMigrations } from '../lib/migrations';

async function main() {
  console.log('🚀 Starting database migrations...');
  
  try {
    await runMigrations();
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
