import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { db } from '../../../../../lib/db';

/** Список пользователей с поиском/фильтрами/пагинацией + сводка. PII в списке не отдаём. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'users.view');

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const premium = (req.query.premium as any) || 'all';
    const segment = (req.query.segment as any) || 'all';
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 25;
    const sortBy = (req.query.sortBy as any) || 'last_seen';
    const sortOrder = (req.query.sortOrder as any) || 'desc';

    const [list, overview] = await Promise.all([
      db.admin.listUsers({ q, premium, segment, page, pageSize, sortBy, sortOrder }),
      db.admin.getUsersOverview(),
    ]);

    return res.status(200).json({
      users: list.users.map((u: any) => ({
        id: u.id,
        name: u.name,
        isPremium: u.is_premium,
        premiumUntil: u.premium_until,
        hasBirthData: !!u.birth_date, // факт наличия, без самой даты (PII)
        savedCharts: u.saved_charts_count,
        chartSlots: u.chart_slots,
        loginStreak: u.login_streak,
        createdAt: u.created_at,
        lastSeenAt: u.last_seen_at,
        isAdmin: u.is_admin,
      })),
      pagination: list.pagination,
      overview: {
        totalUsers: overview.total_users,
        activePremiumUsers: overview.active_premium_users,
        activeUsers7d: overview.active_users_7d,
        needAttentionUsers: overview.need_attention_users,
        usersWithoutBirthData: overview.users_without_birth_data,
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
