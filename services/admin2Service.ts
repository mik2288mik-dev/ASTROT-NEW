/**
 * Клиент новой админки (Admin v2). Все запросы идут с подписанными Telegram initData;
 * сервер проверяет роль/право (RBAC) и пишет audit. См. lib/admin/*.
 */
const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';

export type AdminRole =
  | 'super_admin' | 'admin' | 'content_manager' | 'support'
  | 'analyst' | 'finance' | 'marketing' | 'read_only';

export type AdminMe = {
  userId: string;
  role: AdminRole;
  isOwner: boolean;
  permissions: string[];
};

export type AdminDashboard = {
  generatedAt: string;
  kpis: {
    totalUsers: number; activePremiumUsers: number; usersWithoutBirthData: number;
    newUsers1d: number; newUsers7d: number; newUsers30d: number; totalCharts: number;
    dau: number; wau: number; mau: number;
    totalStars: number; totalPayments: number; stars30d: number; premiumRate: number;
  };
  funnel: Array<{ key: string; label: string; users: number; pctOfStart: number; pctOfPrev: number }>;
};

export type AdminUserRow = {
  id: string; name: string; isPremium: boolean; premiumUntil: string | null;
  hasBirthData: boolean; savedCharts: number; chartSlots: number; loginStreak: number;
  createdAt: string | null; lastSeenAt: string | null; isAdmin: boolean;
};

export type AdminUsersPage = {
  users: AdminUserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  overview: {
    totalUsers: number; activePremiumUsers: number; activeUsers7d: number;
    needAttentionUsers: number; usersWithoutBirthData: number;
  };
};

export type AdminUserDetailV2 = {
  id: string; name: string; isPremium: boolean; premiumUntil: string | null;
  loginStreak: number; chartSlots: number; isBlocked: boolean; isAdmin: boolean;
  savedCharts: number; createdAt: string | null; lastSeenAt: string | null; currentDevice: string | null;
  pii: { revealed: boolean; birthDate: string | null; birthTime: string | null; birthPlace: string | null };
  primaryChart: { id: number; name: string; birthDate: string | null; birthTime: string | null; birthPlace: string | null } | null;
  recentSessions: any[]; latestStarsPayment: any;
};

export type AdminEntry = {
  userId: string; name: string | null; role: AdminRole; status: string; isOwner: boolean; createdAt: string | null;
};

export type AdminAuditRow = {
  id: number; actorUserId: string | null; actorRole: string | null; action: string;
  entityType: string | null; entityId: string | null; before: unknown; after: unknown;
  ip: string | null; userAgent: string | null; result: string; error: string | null; createdAt: string | null;
};

export class Admin2Error extends Error {
  status: number; code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}

function initData(): string {
  const value = (window as any).Telegram?.WebApp?.initData;
  if (!value || typeof value !== 'string') throw new Admin2Error('Telegram initData required', 401, 'INIT_DATA_REQUIRED');
  return value;
}

async function req<T>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const headers: Record<string, string> = { [INIT_DATA_HEADER]: initData() };
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Admin2Error(payload.message || payload.error || `Request failed: ${res.status}`, res.status, payload.error);
  return payload as T;
}

export const admin2 = {
  me: () => req<AdminMe>('/api/admin/v2/me'),
  dashboard: () => req<AdminDashboard>('/api/admin/v2/dashboard'),
  listUsers: (params: { q?: string; premium?: string; page?: number; pageSize?: number } = {}) => {
    const s = new URLSearchParams();
    if (params.q) s.set('q', params.q);
    if (params.premium && params.premium !== 'all') s.set('premium', params.premium);
    if (params.page) s.set('page', String(params.page));
    if (params.pageSize) s.set('pageSize', String(params.pageSize));
    const suffix = s.toString() ? `?${s}` : '';
    return req<AdminUsersPage>(`/api/admin/v2/users${suffix}`);
  },
  getUser: (id: string, pii = false) =>
    req<{ user: AdminUserDetailV2 }>(`/api/admin/v2/users/${encodeURIComponent(id)}${pii ? '?pii=1' : ''}`).then((d) => d.user),
  patchUser: (id: string, patch: { name?: string; language?: 'ru' | 'en'; chartSlots?: number; isBlocked?: boolean }) =>
    req<{ user: AdminUserDetailV2 }>(`/api/admin/v2/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }).then((d) => d.user),
  setPremium: (id: string, action: 'grant' | 'revoke', days?: number) =>
    req<{ user: any }>(`/api/admin/v2/users/${encodeURIComponent(id)}/premium`, { method: 'POST', body: { action, ...(days ? { days } : {}) } }),
  listAdmins: () => req<{ admins: AdminEntry[]; roles: AdminRole[] }>('/api/admin/v2/roles'),
  setRole: (userId: string, role: AdminRole) => req<{ ok: boolean }>('/api/admin/v2/roles', { method: 'POST', body: { userId, role } }),
  removeAdmin: (userId: string) => req<{ ok: boolean }>('/api/admin/v2/roles', { method: 'DELETE', body: { userId } }),
  audit: (params: { page?: number; action?: string } = {}) => {
    const s = new URLSearchParams();
    if (params.page) s.set('page', String(params.page));
    if (params.action) s.set('action', params.action);
    const suffix = s.toString() ? `?${s}` : '';
    return req<{ entries: AdminAuditRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/admin/v2/audit${suffix}`);
  },
};
