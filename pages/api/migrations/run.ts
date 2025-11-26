import type { NextApiRequest, NextApiResponse } from 'next';
import { runMigrations } from '../../../lib/migrations';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/migrations] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/migrations] ERROR: ${message}`, error || '');
  },
};

/**
 * API endpoint to run migrations manually
 * This can be called on Railway deployment or manually
 * 
 * Security: In production, you might want to add authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add authentication check here
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    log.info('Running migrations via API...');
    await runMigrations();
    
    return res.status(200).json({
      success: true,
      message: 'Migrations completed successfully'
    });
  } catch (error: any) {
    log.error('Migration failed', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message
    });
  }
}
