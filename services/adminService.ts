import {
  type AdminLumiActionResult,
  type AdminNotificationHistoryItem,
  type AdminNotificationSendResult,
  type AdminNotificationTargetSegment,
  type AdminNotificationTemplate,
  type AdminNotificationTemplateKind,
  type AdminPremiumFilter,
  type AdminUserDetail,
  type AdminUserSegment,
  type AdminUserSummary,
  type AdminUsersOverview,
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
  segment?: AdminUserSegment;
  limit?: number;
}): Promise<{ users: AdminUserSummary[]; overview: AdminUsersOverview }> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.premium) search.set('premium', params.premium);
  if (params?.segment && params.segment !== 'all') search.set('segment', params.segment);
  if (params?.limit) search.set('limit', String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await adminRequest<{ users: AdminUserSummary[]; overview?: AdminUsersOverview }>(`/api/admin/users${suffix}`);
  return {
    users: data.users || [],
    overview: data.overview || {
      totalUsers: 0,
      activePremiumUsers: 0,
      totalLumiBalance: 0,
      activeUsers7d: 0,
      needAttentionUsers: 0,
    },
  };
}

export async function getAdminStatus(): Promise<{ isAdmin: boolean; requesterId: string }> {
  return adminRequest<{ isAdmin: boolean; requesterId: string }>('/api/admin/me');
}

export async function fetchAdminAiSettings(): Promise<{
  modelId: string;
  storedModelId: string | null;
  envFallback: string;
  options: Array<{ id: string; label: string }>;
}> {
  return adminRequest('/api/admin/ai-settings');
}

export async function saveAdminAiModel(modelId: string): Promise<{ success: boolean; modelId: string }> {
  return adminRequest('/api/admin/ai-settings', { method: 'POST', bodyJson: { modelId } });
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
): Promise<AdminLumiActionResult> {
  return adminRequest<AdminLumiActionResult>(
    `/api/admin/users/${encodeURIComponent(userId)}/lumi`,
    {
      method: 'POST',
      bodyJson: { action, amount, note },
    }
  );
}

export async function fetchNotificationTemplates(): Promise<AdminNotificationTemplate[]> {
  const data = await adminRequest<{ templates: AdminNotificationTemplate[] }>('/api/admin/notification-templates');
  return data.templates || [];
}

export async function createNotificationTemplate(payload: {
  title: string;
  bodyRu: string;
  bodyEn: string;
  kind: AdminNotificationTemplateKind;
  isActive: boolean;
}): Promise<AdminNotificationTemplate> {
  const data = await adminRequest<{ template: AdminNotificationTemplate }>('/api/admin/notification-templates', {
    method: 'POST',
    bodyJson: payload,
  });
  return data.template;
}

export async function updateNotificationTemplate(
  templateId: number,
  payload: {
    title: string;
    bodyRu: string;
    bodyEn: string;
    kind: AdminNotificationTemplateKind;
    isActive: boolean;
  }
): Promise<AdminNotificationTemplate> {
  const data = await adminRequest<{ template: AdminNotificationTemplate }>(
    `/api/admin/notification-templates/${templateId}`,
    {
      method: 'PATCH',
      bodyJson: payload,
    }
  );
  return data.template;
}

export async function fetchNotificationHistory(limit = 20): Promise<AdminNotificationHistoryItem[]> {
  const data = await adminRequest<{ history: AdminNotificationHistoryItem[] }>(
    `/api/admin/notifications?limit=${encodeURIComponent(String(limit))}`
  );
  return data.history || [];
}

export async function sendNotification(payload: {
  mode: 'personal' | 'broadcast';
  targetUserId?: string | null;
  targetSegment?: AdminNotificationTargetSegment | null;
  templateId?: number | null;
  title: string;
  bodyRu: string;
  bodyEn: string;
}): Promise<AdminNotificationSendResult> {
  return adminRequest<AdminNotificationSendResult>('/api/admin/notifications/send', {
    method: 'POST',
    bodyJson: payload,
  });
}

export { AdminApiError };
