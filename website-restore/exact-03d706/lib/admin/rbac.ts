/**
 * RBAC для админ-панели приложения.
 *
 * Идентичность берётся из подписанных Telegram initData (lib/adminAuth), роль —
 * из таблицы admin_users. OWNER_ID всегда super_admin. Любой мутирующий админ-эндпоинт
 * обязан вызвать requireAdminPermission(req, '<key>'). Матрица прав — единственный
 * источник правды о том, что роль может делать. См. docs/ADMIN_PANEL_SPEC.md §7.
 */
import type { NextApiRequest } from 'next';
import { AdminAuthError, getVerifiedTelegramUser, getConfiguredOwnerId } from '../adminAuth';
import { getPool } from '../db';

export const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'content_manager',
  'support',
  'analyst',
  'finance',
  'marketing',
  'read_only',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'users.view', 'users.edit', 'users.block', 'user.pii.view', 'users.delete', 'users.export',
  'charts.view', 'charts.recalc',
  'content.view', 'content.edit', 'content.publish',
  'ai.view', 'ai.edit', 'ai.publish',
  'billing.view', 'billing.refund', 'promo.manage', 'paywall.manage',
  'analytics.view',
  'push.send', 'push.manage',
  'support.view', 'support.act',
  'roles.manage', 'audit.view', 'settings.manage',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Матрица: роль → набор прав. super_admin = всё (обрабатывается отдельно). */
const ROLE_PERMISSIONS: Record<Exclude<AdminRole, 'super_admin'>, AdminPermission[]> = {
  admin: [
    'users.view', 'users.edit', 'users.block', 'user.pii.view', 'users.export',
    'charts.view', 'charts.recalc',
    'content.view', 'content.edit', 'content.publish',
    'ai.view', 'ai.edit',
    'billing.view', 'billing.refund', 'promo.manage', 'paywall.manage',
    'analytics.view',
    'push.send', 'push.manage',
    'support.view', 'support.act',
    'audit.view',
  ],
  content_manager: ['content.view', 'content.edit', 'content.publish', 'ai.view', 'analytics.view'],
  support: [
    'users.view', 'users.edit', 'users.block', 'user.pii.view', 'users.export',
    'charts.view', 'charts.recalc', 'billing.view', 'analytics.view', 'support.view', 'support.act',
  ],
  analyst: ['users.view', 'charts.view', 'content.view', 'ai.view', 'billing.view', 'analytics.view'],
  finance: ['billing.view', 'billing.refund', 'promo.manage', 'analytics.view'],
  marketing: ['users.view', 'content.view', 'content.edit', 'promo.manage', 'paywall.manage', 'analytics.view', 'push.send', 'push.manage'],
  read_only: ['users.view', 'charts.view', 'content.view', 'billing.view', 'analytics.view', 'support.view'],
};

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  if (role === 'super_admin') return [...ADMIN_PERMISSIONS];
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  if (role === 'super_admin') return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export type AdminContext = {
  userId: string;
  role: AdminRole;
  isOwner: boolean;
  permissions: AdminPermission[];
};

function normalizeRole(raw: unknown): AdminRole {
  const value = String(raw || '').trim();
  return (ADMIN_ROLES as readonly string[]).includes(value) ? (value as AdminRole) : 'read_only';
}

/**
 * Резолвит админ-контекст из запроса: проверяет Telegram-подпись, читает роль из
 * admin_users (status='active'); OWNER_ID всегда super_admin. Бросает AdminAuthError,
 * если пользователь не админ.
 */
export async function getAdminContext(req: NextApiRequest): Promise<AdminContext> {
  const telegramUser = getVerifiedTelegramUser(req);
  const telegramUserId = telegramUser.id;
  const ownerId = getConfiguredOwnerId();

  // Telegram is the authenticated principal, while account_identities owns the
  // stable internal users.id used by admin_users after account migrations.
  const identity = await getPool().query(
    `SELECT user_id FROM account_identities
     WHERE provider = 'telegram' AND provider_subject = $1
     LIMIT 1`,
    [telegramUserId],
  );
  const userId = String(identity.rows[0]?.user_id || telegramUserId);
  const isOwner = !!ownerId
    && (telegramUserId === String(ownerId) || userId === String(ownerId));

  if (isOwner) {
    return { userId, role: 'super_admin', isOwner: true, permissions: permissionsForRole('super_admin') };
  }

  const result = await getPool().query(
    `SELECT a.role, a.status, u.is_admin
       FROM users u
       LEFT JOIN admin_users a ON a.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (row?.role) {
    if (row.status !== 'active') {
      throw new AdminAuthError(403, 'ADMIN_REQUIRED', 'Admin access is required');
    }
    const role = normalizeRole(row.role);
    return { userId, role, isOwner: false, permissions: permissionsForRole(role) };
  }

  // Backward-compatible bridge for accounts created before admin_users.
  // An explicit RBAC row always wins, so a revoked row cannot be bypassed by
  // the legacy users.is_admin flag.
  if (row?.is_admin === true) {
    return { userId, role: 'admin', isOwner: false, permissions: permissionsForRole('admin') };
  }

  throw new AdminAuthError(403, 'ADMIN_REQUIRED', 'Admin access is required');
}

/** Гард: требует у вызывающего конкретное право. Возвращает контекст при успехе. */
export async function requireAdminPermission(
  req: NextApiRequest,
  permission: AdminPermission
): Promise<AdminContext> {
  const ctx = await getAdminContext(req);
  if (!roleHasPermission(ctx.role, permission)) {
    throw new AdminAuthError(403, 'PERMISSION_DENIED', `Missing permission: ${permission}`);
  }
  return ctx;
}

/** Гард: только наличие доступа к админке (без конкретного права). */
export async function requireAdmin(req: NextApiRequest): Promise<AdminContext> {
  return getAdminContext(req);
}
