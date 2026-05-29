import {
  type AdminNotificationDeliveryLogItem,
  type AdminNotificationEngineStats,
  type AdminNotificationSchedule,
  type AdminNotificationScenario,
  type AdminNotificationScenarioPayload,
  type AdminNotificationTemplatePayload,
  type AdminHistoryResultFilter,
  type AdminNotificationHistoryResponse,
  type AdminNotificationModeFilter,
  type AdminNotificationSendResult,
  type AdminNotificationTargetSegment,
  type AdminNotificationTemplate,
  type AdminNotificationTemplateKind,
  type AdminNotificationCampaignQueueItem,
  type AdminPremiumFilter,
  type AdminScheduledNotificationQueueItem,
  type AdminScheduledNotificationAsset,
  type AdminScheduledNotificationTemplate,
  type AdminSortOrder,
  type AdminUserDetail,
  type AdminUserSortBy,
  type AdminUserSegment,
  type AdminUsersResponse,
} from '../types';

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';

type AdminRequestOptions = RequestInit & {
  bodyJson?: Record<string, any>;
};

export type AdminNotificationAiDraftScenario =
  | 'morning'
  | 'day'
  | 'evening'
  | 'daily_lumi'
  | 'upsell'
  | 'promo'
  | 'reactivation'
  | 'custom';

export interface AdminNotificationAiDraftVariant {
  label: string;
  title: string;
  bodyRu: string;
  bodyEn: string;
}

export interface AdminNotificationAiDraftResponse {
  variants: AdminNotificationAiDraftVariant[];
  model: string | null;
  source: 'openai' | 'fallback';
}

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
  page?: number;
  pageSize?: number;
  sortBy?: AdminUserSortBy;
  sortOrder?: AdminSortOrder;
  limit?: number;
}): Promise<AdminUsersResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.premium) search.set('premium', params.premium);
  if (params?.segment && params.segment !== 'all') search.set('segment', params.segment);
  if (params?.page) search.set('page', String(params.page));
  if (params?.pageSize) search.set('pageSize', String(params.pageSize));
  if (params?.sortBy) search.set('sortBy', params.sortBy);
  if (params?.sortOrder) search.set('sortOrder', params.sortOrder);
  if (params?.limit) search.set('limit', String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await adminRequest<Partial<AdminUsersResponse>>(`/api/admin/users${suffix}`);
  return {
    users: data.users || [],
    overview: data.overview || {
      totalUsers: 0,
      activePremiumUsers: 0,
      activeUsers7d: 0,
      needAttentionUsers: 0,
    },
    pagination: data.pagination || {
      page: params?.page || 1,
      pageSize: params?.pageSize || params?.limit || 25,
      total: data.users?.length || 0,
      totalPages: 1,
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

export async function fetchNotificationTemplates(): Promise<AdminNotificationTemplate[]> {
  const data = await adminRequest<{ templates: AdminNotificationTemplate[] }>('/api/admin/notification-templates');
  return data.templates || [];
}

export async function createNotificationTemplate(payload: {
  title: string;
  bodyRu: string;
  bodyEn: string;
  kind: AdminNotificationTemplateKind;
  assetId?: number | null;
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
    assetId?: number | null;
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

export async function fetchNotificationHistory(params?: {
  page?: number;
  pageSize?: number;
  limit?: number;
  mode?: AdminNotificationModeFilter;
  result?: AdminHistoryResultFilter;
}): Promise<AdminNotificationHistoryResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.pageSize) search.set('pageSize', String(params.pageSize));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.mode && params.mode !== 'all') search.set('mode', params.mode);
  if (params?.result && params.result !== 'all') search.set('result', params.result);

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await adminRequest<Partial<AdminNotificationHistoryResponse>>(
    `/api/admin/notifications${suffix}`
  );
  return {
    history: data.history || [],
    pagination: data.pagination || {
      page: params?.page || 1,
      pageSize: params?.pageSize || params?.limit || 20,
      total: data.history?.length || 0,
      totalPages: 1,
    },
  };
}

export async function sendNotification(payload: {
  mode: 'personal' | 'broadcast';
  targetUserId?: string | null;
  targetSegment?: AdminNotificationTargetSegment | null;
  templateId?: number | null;
  assetId?: number | null;
  title: string;
  bodyRu: string;
  bodyEn: string;
}): Promise<AdminNotificationSendResult> {
  return adminRequest<AdminNotificationSendResult>('/api/admin/notifications/send', {
    method: 'POST',
    bodyJson: payload,
  });
}

export async function generateAdminNotificationDrafts(payload: {
  mode: 'personal' | 'broadcast';
  targetSegment?: AdminNotificationTargetSegment | null;
  scenario: AdminNotificationAiDraftScenario;
  brief?: string;
}): Promise<AdminNotificationAiDraftResponse> {
  return adminRequest<AdminNotificationAiDraftResponse>('/api/admin/notifications/ai-drafts', {
    method: 'POST',
    bodyJson: payload,
  });
}

export async function fetchScheduledNotificationTemplates(): Promise<AdminScheduledNotificationTemplate[]> {
  const data = await adminRequest<{ templates: AdminScheduledNotificationTemplate[] }>(
    '/api/admin/notifications/templates'
  );
  return data.templates || [];
}

export async function fetchNotificationScenarios(): Promise<AdminNotificationScenario[]> {
  const data = await adminRequest<{ scenarios: AdminNotificationScenario[] }>('/api/admin/notifications/scenarios');
  return data.scenarios || [];
}

export async function updateNotificationScenario(
  id: number,
  payload: Partial<AdminNotificationScenarioPayload>
): Promise<AdminNotificationScenario> {
  const data = await adminRequest<{ scenario: AdminNotificationScenario }>(
    `/api/admin/notifications/scenarios/${id}`,
    { method: 'PATCH', bodyJson: payload }
  );
  return data.scenario;
}

export async function fetchEngineNotificationTemplates(
  scenarioId?: number | null
): Promise<AdminScheduledNotificationTemplate[]> {
  const suffix = scenarioId ? `?scenarioId=${encodeURIComponent(String(scenarioId))}` : '';
  const data = await adminRequest<{ templates: AdminScheduledNotificationTemplate[] }>(
    `/api/admin/notifications/templates${suffix}`
  );
  return data.templates || [];
}

export async function createEngineNotificationTemplate(
  payload: AdminNotificationTemplatePayload
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    '/api/admin/notifications/templates',
    { method: 'POST', bodyJson: payload as Record<string, any> }
  );
  return data.template;
}

export async function updateEngineNotificationTemplate(
  id: number,
  payload: AdminNotificationTemplatePayload
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    `/api/admin/notifications/templates/${id}`,
    { method: 'PATCH', bodyJson: payload as Record<string, any> }
  );
  return data.template;
}

export async function fetchScheduledNotificationTemplate(
  id: number
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    `/api/admin/notifications/templates/${id}`
  );
  return data.template;
}

export async function createScheduledNotificationTemplate(
  payload: Record<string, unknown>
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    '/api/admin/notifications/templates',
    { method: 'POST', bodyJson: payload }
  );
  return data.template;
}

export async function updateScheduledNotificationTemplate(
  id: number,
  payload: Record<string, unknown>
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    `/api/admin/notifications/templates/${id}`,
    { method: 'PUT', bodyJson: payload }
  );
  return data.template;
}

export async function patchScheduledNotificationTemplateActive(
  id: number,
  isActive: boolean
): Promise<AdminScheduledNotificationTemplate> {
  const data = await adminRequest<{ template: AdminScheduledNotificationTemplate }>(
    `/api/admin/notifications/templates/${id}`,
    { method: 'PATCH', bodyJson: { isActive } }
  );
  return data.template;
}

export async function deleteScheduledNotificationTemplate(id: number): Promise<void> {
  await adminRequest(`/api/admin/notifications/templates/${id}`, { method: 'DELETE' });
}

export async function fetchNotificationAssets(): Promise<AdminScheduledNotificationAsset[]> {
  const data = await adminRequest<{ assets: AdminScheduledNotificationAsset[] }>(
    '/api/admin/notifications/assets'
  );
  return data.assets || [];
}

export async function uploadNotificationAsset(file: File): Promise<AdminScheduledNotificationAsset> {
  const initData = getTelegramInitData();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/admin/notifications/assets/upload`, {
    method: 'POST',
    headers: { [INIT_DATA_HEADER]: initData },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(
      payload.message || payload.error || `Upload failed: ${response.status}`,
      response.status,
      payload.error
    );
  }
  return (payload as { asset: AdminScheduledNotificationAsset }).asset;
}

export async function deleteNotificationAsset(id: number): Promise<void> {
  await adminRequest(`/api/admin/notifications/assets/${id}`, { method: 'DELETE' });
}

export async function updateNotificationAsset(
  id: number,
  payload: Partial<AdminScheduledNotificationAsset>
): Promise<AdminScheduledNotificationAsset> {
  const data = await adminRequest<{ asset: AdminScheduledNotificationAsset }>(
    `/api/admin/notifications/assets/${id}`,
    { method: 'PATCH', bodyJson: payload as Record<string, any> }
  );
  return data.asset;
}

export async function createNotificationSchedule(payload: Record<string, unknown>): Promise<AdminNotificationSchedule> {
  const data = await adminRequest<{ schedule: AdminNotificationSchedule }>(
    '/api/admin/notifications/schedules',
    { method: 'POST', bodyJson: payload }
  );
  return data.schedule;
}

export async function updateNotificationSchedule(
  id: number,
  payload: Record<string, unknown>
): Promise<AdminNotificationSchedule> {
  const data = await adminRequest<{ schedule: AdminNotificationSchedule }>(
    `/api/admin/notifications/schedules/${id}`,
    { method: 'PUT', bodyJson: payload }
  );
  return data.schedule;
}

export async function deleteNotificationSchedule(id: number): Promise<void> {
  await adminRequest(`/api/admin/notifications/schedules/${id}`, { method: 'DELETE' });
}

/** Fetches server-rendered PNG; caller must URL.revokeObjectURL when done. */
export async function fetchGeneratedCardPreviewObjectUrl(payload: Record<string, unknown>): Promise<string> {
  const initData = getTelegramInitData();
  const response = await fetch(`${API_BASE}/api/admin/notifications/card-preview`, {
    method: 'POST',
    headers: {
      [INIT_DATA_HEADER]: initData,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new AdminApiError(
      errBody.message || errBody.error || `Card preview failed: ${response.status}`,
      response.status,
      errBody.error
    );
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function previewScheduledNotification(payload: Record<string, unknown>): Promise<{
  preview: {
    visualMode: string;
    messageType: string;
    text: string;
    imageUrl: string | null;
    generatedCardPreviewPath: string | null;
    buttonText: string | null;
    buttonUrl: string | null;
    hasInlineButton: boolean;
  };
}> {
  return adminRequest('/api/admin/notifications/preview', { method: 'POST', bodyJson: payload });
}

export async function previewEngineNotification(payload: {
  scenarioId: number;
  templateId?: number | null;
  userId?: string | null;
  date?: string | null;
  time?: string | null;
}): Promise<{ preview: Record<string, any> }> {
  return adminRequest('/api/admin/notifications/preview', { method: 'POST', bodyJson: payload as Record<string, any> });
}

export async function sendScheduledNotificationTest(templateId: number): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  totalRecipients: number;
  errorSummary: string | null;
}> {
  return adminRequest('/api/admin/notifications/send-test', {
    method: 'POST',
    bodyJson: { templateId },
  });
}

export async function sendEngineNotificationTest(payload: {
  scenarioId: number;
  templateId?: number | null;
  userId?: string | null;
}): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  totalRecipients: number;
  errorSummary: string | null;
  logId?: number;
  dryRun?: boolean;
}> {
  return adminRequest('/api/admin/notifications/send-test', {
    method: 'POST',
    bodyJson: payload as Record<string, any>,
  });
}

export async function runNotificationEngine(payload?: { dryRun?: boolean; limit?: number }): Promise<{
  success: boolean;
  result: Record<string, any>;
}> {
  return adminRequest('/api/admin/notifications/engine-run', {
    method: 'POST',
    bodyJson: payload || { dryRun: true, limit: 25 },
  });
}

export async function fetchNotificationEngineStats(): Promise<AdminNotificationEngineStats> {
  const data = await adminRequest<{ stats: AdminNotificationEngineStats }>('/api/admin/notifications/stats');
  return data.stats;
}

export async function fetchScheduledNotificationQueue(
  limit = 100,
  status?: string | null
): Promise<AdminScheduledNotificationQueueItem[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (status) query.set('status', status);
  const data = await adminRequest<{ queue: AdminScheduledNotificationQueueItem[] }>(
    `/api/admin/notifications/queue?${query.toString()}`
  );
  return data.queue || [];
}

export async function retryQueuedNotification(id: number): Promise<boolean> {
  const data = await adminRequest<{ success: boolean }>('/api/admin/notifications/queue', {
    method: 'POST',
    bodyJson: { id, action: 'retry' },
  });
  return data.success;
}

export async function cancelQueuedNotification(id: number): Promise<boolean> {
  const data = await adminRequest<{ success: boolean }>('/api/admin/notifications/queue', {
    method: 'POST',
    bodyJson: { id, action: 'cancel' },
  });
  return data.success;
}

export async function fetchRetentionCampaigns(limit = 100): Promise<AdminNotificationCampaignQueueItem[]> {
  const data = await adminRequest<{ campaigns: AdminNotificationCampaignQueueItem[] }>(
    `/api/admin/notifications/campaigns?limit=${encodeURIComponent(String(limit))}`
  );
  return data.campaigns || [];
}

export async function runNotificationSlot(slot: string, rotationGroup?: string | null): Promise<{
  success: boolean;
  templateId: number | null;
  successCount: number;
  failureCount: number;
  totalRecipients: number;
  errorSummary: string | null;
}> {
  return adminRequest('/api/admin/notifications/run-slot', {
    method: 'POST',
    bodyJson: { slot, rotationGroup: rotationGroup || null },
  });
}

export async function fetchNotificationDeliveryLog(limit = 50): Promise<AdminNotificationDeliveryLogItem[]> {
  const data = await adminRequest<{ log: AdminNotificationDeliveryLogItem[] }>(
    `/api/admin/notifications/delivery-log?limit=${encodeURIComponent(String(limit))}`
  );
  return data.log || [];
}

export { AdminApiError };
