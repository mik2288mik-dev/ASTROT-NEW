import {
  type AdminPremiumFilter,
  type AdminUserDetail,
  type AdminUserSummary,
} from '../types';

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';

type AdminRequestOptions = RequestInit & {
  bodyJson?: Record<string, any>;
};

class AdminApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getTelegramInitData(): string {
  const initData = (window as any).Telegram?.WebApp?.initData;
  if (!initData || typeof initData !== 'string') {
    throw new AdminApiError('Telegram initData is required for admin access', 401, 'INIT_DATA_REQUIRED');
  }
  return initData;
}

async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const initData = getTelegramInitData();
  const headers: Record<string, string> = {
    [INIT_DATA_HEADER]: initData,
    ...(options.bodyJson ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.bodyJson ? JSON.stringify(options.bodyJson) : options.body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(
      payload.message || payload.error || `Admin request failed: ${response.status}`,
      response.status,
      payload.error
    );
  }

  return payload as T;
}

export async function fetchAdminUsers(params?: {
  q?: string;
  premium?: AdminPremiumFilter;
  limit?: number;
}): Promise<AdminUserSummary[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.premium) search.set('premium', params.premium);
  if (params?.limit) search.set('limit', String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await adminRequest<{ users: AdminUserSummary[] }>(`/api/admin/users${suffix}`);
  return data.users || [];
}

export async function getAdminStatus(): Promise<{ isAdmin: boolean; requesterId: string }> {
  return adminRequest<{ isAdmin: boolean; requesterId: string }>('/api/admin/me');
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const data = await adminRequest<{ user: AdminUserDetail }>(`/api/admin/users/${encodeURIComponent(userId)}`);
  return data.user;
}

export async function updateAdminPremium(userId: string, action: 'grant' | 'revoke'): Promise<AdminUserDetail> {
  const data = await adminRequest<{ user: AdminUserDetail }>(
    `/api/admin/users/${encodeURIComponent(userId)}/premium`,
    {
      method: 'POST',
      bodyJson: { action },
    }
  );
  return data.user;
}

export async function updateAdminLumi(
  userId: string,
  action: 'add' | 'subtract',
  amount: number,
  note?: string
): Promise<AdminUserDetail> {
  const data = await adminRequest<{ user: AdminUserDetail }>(
    `/api/admin/users/${encodeURIComponent(userId)}/lumi`,
    {
      method: 'POST',
      bodyJson: { action, amount, note },
    }
  );
  return data.user;
}

export { AdminApiError };
