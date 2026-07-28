import { getPool } from './db';

type AccountDeletionResult = { deleted: boolean; alreadyDeleted: boolean };

async function tableExists(client: any, table: string): Promise<boolean> {
  const result = await client.query('SELECT to_regclass($1) AS table_name', [`public.${table}`]);
  return !!result.rows[0]?.table_name;
}

async function executeIfTable(client: any, table: string, query: string, params: unknown[]): Promise<void> {
  if (await tableExists(client, table)) await client.query(query, params);
}

/**
 * Deletes personal data atomically. Foreign-key owned records cascade from
 * users; tables deliberately kept without a user FK are explicitly scrubbed.
 */
export async function deleteAccountData(userId: string): Promise<AccountDeletionResult> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user.rowCount) {
      await client.query('COMMIT');
      return { deleted: false, alreadyDeleted: true };
    }

    // Cancel before the user row is removed; these queued rows then disappear
    // through their FK and cannot be picked up by a scheduler.
    await executeIfTable(
      client,
      'scheduled_notifications',
      `UPDATE scheduled_notifications
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status IN ('scheduled', 'sending')`,
      [userId],
    );
    await executeIfTable(client, 'promo_redemptions', 'DELETE FROM promo_redemptions WHERE user_id = $1', [userId]);
    await executeIfTable(client, 'natal_content_legacy_archive', 'DELETE FROM natal_content_legacy_archive WHERE user_id = $1', [userId]);
    await executeIfTable(client, 'support_tickets', 'UPDATE support_tickets SET user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
    await executeIfTable(client, 'support_messages', 'UPDATE support_messages SET author_id = NULL WHERE author_id = $1', [userId]);
    await executeIfTable(client, 'admin_users', 'UPDATE admin_users SET created_by = NULL WHERE created_by = $1', [userId]);
    await executeIfTable(client, 'admin_audit_log', 'DELETE FROM admin_audit_log WHERE entity_type = \'user\' AND entity_id = $1', [userId]);
    await executeIfTable(client, 'admin_audit_log', 'UPDATE admin_audit_log SET actor_user_id = NULL WHERE actor_user_id = $1', [userId]);
    await executeIfTable(client, 'ai_prompts', 'UPDATE ai_prompts SET author_id = NULL, approved_by = NULL WHERE author_id = $1 OR approved_by = $1', [userId]);
    await executeIfTable(client, 'ai_prompt_versions', 'UPDATE ai_prompt_versions SET editor_id = NULL WHERE editor_id = $1', [userId]);
    await executeIfTable(client, 'cms_content', 'UPDATE cms_content SET author_id = NULL WHERE author_id = $1', [userId]);
    await executeIfTable(client, 'cms_content_versions', 'UPDATE cms_content_versions SET editor_id = NULL WHERE editor_id = $1', [userId]);
    await executeIfTable(client, 'feature_flags', 'UPDATE feature_flags SET updated_by = NULL WHERE updated_by = $1', [userId]);

    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return { deleted: true, alreadyDeleted: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
