/**
 * Клиент новой админки (Admin v2). В production запросы идут с подписанными Telegram
 * initData; локально можно включить browser-dev доступ через ADMIN_WEB_DEV_AUTH_ENABLED.
 * Сервер проверяет роль/право (RBAC) и пишет audit. См. lib/admin/*.
 */
import { apiFetch } from './apiClient';

const INIT_DATA_HEADER = 'x-telegram-init-data';
const ADMIN_DEV_USER_HEADER = 'x-admin-dev-user-id';
const ADMIN_DEV_SECRET_HEADER = 'x-admin-dev-secret';
const ADMIN_DEV_USER_KEY = 'lumia_admin_dev_user_id';
const ADMIN_DEV_SECRET_KEY = 'lumia_admin_dev_secret';

export type AdminRole =
  | 'super_admin' | 'admin' | 'content_manager' | 'support'
  | 'analyst' | 'finance' | 'marketing' | 'read_only';

export type AdminMe = {
  userId: string;
  role: AdminRole;
  isOwner: boolean;
  permissions: string[];
};

export type AdminCommerceAttributionStage = 'paywall_view' | 'checkout_start' | 'purchase_success';

export type AdminCommerceAttributionRow = {
  stage: AdminCommerceAttributionStage;
  placement: string | null;
  source: string | null;
  events: number;
  users: number;
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
  retention: { d1: number | null; d7: number | null; d30: number | null };
  events: Array<{ type: string; label: string; count: number }>;
  commerceAttribution: AdminCommerceAttributionRow[];
};

export type AdminChartRow = {
  id: number; userId: string; ownerName: string | null; name: string;
  sunSign: string | null; moonSign: string | null; ascendantSign: string | null;
  version: string | null; timezone: string | null; isPrimary: boolean;
  hasBirthDate: boolean; hasBirthTime: boolean; status: 'ok' | 'error'; createdAt: string | null;
};

export type AdminChartDetail = {
  id: number; userId: string; name: string; isPrimary: boolean; version: string | null;
  input: { birthDate: string | null; birthTime: string | null; birthPlace: string | null; latitude: number | null; longitude: number | null; timezone: string | null };
  result: { sun: any; moon: any; ascendant: any; housesCount: number; aspectsCount: number; element: string | null; rulingPlanet: string | null };
  status: 'ok' | 'error'; createdAt: string | null; updatedAt: string | null;
};

export type AdminChartTestResult = {
  ok: boolean; error?: string; code?: string | null; durationMs?: number;
  coordinates?: { lat: number; lon: number; timezone: string };
  result?: { sun: any; moon: any; ascendant: any; element: string; rulingPlanet: string; houses: number; aspects: number; birthTimeQuality: string };
};

export type AdminUserRow = {
  id: string; name: string; isPremium: boolean; premiumUntil: string | null;
  hasBirthData: boolean; savedCharts: number; chartSlots: number; loginStreak: number;
  createdAt: string | null; lastSeenAt: string | null; isAdmin: boolean; isBlocked: boolean;
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

export type AdminPaymentRow = {
  id: number; userId: string; ownerName: string | null; provider: string; status: string;
  amount: number; currency: string; product: string | null; platform: string;
  chargeId: string | null; createdAt: string | null; refundedAt: string | null;
};
export type AdminSubscriptionRow = {
  userId: string; name: string | null; plan: string; status: string; provider: string;
  platform: string; premiumUntil: string | null; trialStartedAt: string | null;
};
export type AdminRevenue = {
  totalStars: number; totalPayments: number; stars30d: number; payments30d: number;
  refunds: number; refundedStars: number; activePremium: number; trials: number;
};
export type AdminPromo = {
  code: string; type: string; value: number; maxUses: number; usedCount: number;
  status: string; startsAt: string | null; expiresAt: string | null; createdAt: string | null;
};

export type AdminPremiumPlan = {
  id: string; days: number; stars: number; priceRub: number; priceUsd: number;
  label: string; isActive: boolean; sortOrder: number; badge: string | null;
};

export type AdminPromptRow = { id: number; key: string; type: string; locale: string; version: number; status: string; updatedAt: string | null };
export type AdminPromptDetail = AdminPromptRow & { body: string; versions: Array<{ version: number; body: string; createdAt: string | null }> };
export type AdminCmsRow = { id: number; type: string; locale: string; status: string; title: string | null; version: number; category: string | null; updatedAt: string | null; publishedAt: string | null };
export type AdminCmsDetail = AdminCmsRow & { body: string; versions: Array<{ version: number; body: string; createdAt: string | null }> };

export type AdminForecastQuestion = {
  id: number;
  userId: string;
  chartId: number | null;
  period: 'day' | 'week' | 'month' | 'year';
  periodKey: string;
  language: 'ru' | 'en';
  source: 'catalog' | 'custom';
  questionText: string;
  status: 'pending' | 'approved' | 'generating' | 'answered' | 'rejected';
  moderationReason: string | null;
  answerText: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTicketRow = { id: number; userId: string | null; userName: string | null; subject: string; status: string; priority: string; messages: number; updatedAt: string | null };
export type AdminTicketDetail = { ticket: { id: number; userId: string | null; userName: string | null; subject: string; status: string; priority: string }; messages: Array<{ authorType: string; body: string; internal: boolean; createdAt: string | null }> };
export type AdminSendResult = { ok: boolean; total: number; sent: number; failed: number; capped: boolean };
export type AdminFlag = { key: string; value: any; description: string | null; updatedAt: string | null };

export type AdminNotificationScenario = {
  id: number; key: string; name: string; description: string; enabled: boolean;
  dayPart: string; timeWindowStart: string; timeWindowEnd: string; priority: number;
  audienceRuleJson: Record<string, any>; triggerRuleJson: Record<string, any>;
  maxPerDay: number; cooldownHours: number; deepLink: string;
  templatesCount: number; activeTemplatesCount: number; sentCount: number; clickedCount: number; ctr: number; errorCount: number;
};

export type AdminNotificationTemplate = {
  id: number; scenarioId: number | null; scenarioKey: string | null; name: string; slot: string;
  targetSegment: string | null; title?: string; body?: string; text: string; buttonText: string;
  deepLink: string; isActive: boolean; weight?: number; notes: string | null; updatedAt: string | null;
};

export type AdminNotificationStats = {
  sent: number; delivered: number; clicked: number; ctr: number; openedApp: number;
  disabledNotifications: number; errors: number;
  byScenario: Array<{ scenarioKey: string; sent: number; clicked: number; ctr: number; errors: number }>;
  bestTemplates: Array<{ templateId: number; title: string; sent: number; clicked: number; ctr: number }>;
};

export type AdminNotificationsOverview = {
  stats: AdminNotificationStats;
  scenarios: AdminNotificationScenario[];
  templates: AdminNotificationTemplate[];
};

export type AdminNotificationDiagnostics = {
  ok: boolean;
  healthy: boolean;
  problems: string[];
  env: {
    botTokenPresent: boolean; botTokenEnvKey?: string | null; dryRun: boolean; webhookSecretPresent: boolean;
    cronSecretPresent: boolean; miniAppUrlPresent: boolean; botUsername: string | null;
    inProcessCronDisabled: boolean;
  };
  scheduler: {
    started: boolean; startedAt: string | null; lastDispatchAt: string | null;
    lastDispatchOk: boolean | null; lastDispatchSent: number; lastDispatchFailed: number;
    lastPlannerJob: string | null; lastPlannerAt: string | null; dispatchIntervalMs: number;
  };
  health: {
    scenarios: { total: number; enabled: number };
    templates: { active: number };
    queue: { scheduled: number; dueNow: number; sending: number; sentLast24h: number; failedLast24h: number };
    lastSentAt: string | null;
    lastError: { at: string | null; message: string | null };
    recipients: { withChart: number; withBirthDate: number };
  };
  ownerProbe: {
    candidateNow: { job: string; type: string } | null;
    jobs: Array<{ job: string; result: string }>;
    gates: {
      notificationsEnabled: boolean;
      timezone: string;
      localTime: string;
      quietHours: string;
      quietHoursNow: boolean;
      sentToday: number;
      dailyLimit: number;
      dailyLimitReached: boolean;
      hasPending: boolean;
      typesUsedToday: string[];
      ignoredLastCount: number;
      daysInactive: number;
      daysSinceLastSent: number;
      ignoreMuted: boolean;
    } | null;
    recentQueue: Array<{ id: number; type: string; status: string; scheduledAt: string | null; sentAt: string | null; error: string | null }>;
  } | null;
  checkedAt: string;
};

export type AdminContentHealth = {
  ok: boolean;
  healthy: boolean;
  openaiKeyPresent: boolean;
  model: string;
  surfaces: Array<{ surface: string; label: string; model: string }>;
  problems: string[];
  checkedAt: string;
};

export type AdminContentPingResult = {
  ok: boolean;
  result: { ok: boolean; model: string; latencyMs: number; sample?: string; error?: string };
};

export type AdminNotificationRunResult = {
  ok: boolean;
  action: string;
  result: {
    ok?: boolean; error?: string; dryRun?: boolean; type?: string; title?: string; body?: string;
    telegramMessageId?: number | null;
    total?: number; successCount?: number; failureCount?: number; enqueued?: number; jobType?: string;
  };
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

export type AdminDevAuth = {
  userId: string;
  secret: string;
};

function telegramInitData(): string {
  if (typeof window === 'undefined') return '';
  const value = (window as any).Telegram?.WebApp?.initData;
  return typeof value === 'string' ? value : '';
}

function storageGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage может быть недоступен в приватном режиме; форма всё равно покажет ошибку API.
  }
}

function storageRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getStoredDevAuth(): AdminDevAuth | null {
  const userId = storageGet(ADMIN_DEV_USER_KEY).trim();
  const secret = storageGet(ADMIN_DEV_SECRET_KEY);
  return userId && secret ? { userId, secret } : null;
}

function authHeaders(): Record<string, string> {
  const initData = telegramInitData();
  if (initData.trim()) return { [INIT_DATA_HEADER]: initData };

  const devAuth = getStoredDevAuth();
  if (devAuth) {
    return {
      [ADMIN_DEV_USER_HEADER]: devAuth.userId,
      [ADMIN_DEV_SECRET_HEADER]: devAuth.secret,
    };
  }

  throw new Admin2Error('Откройте админку внутри Telegram Mini App или подключите browser-dev доступ.', 401, 'ADMIN_AUTH_REQUIRED');
}

async function req<T>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const headers: Record<string, string> = authHeaders();
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await apiFetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Admin2Error(payload.message || payload.error || `Request failed: ${res.status}`, res.status, payload.error);
  return payload as T;
}

export const admin2Auth = {
  hasTelegramAuth: () => !!telegramInitData().trim(),
  getStoredDevAuth,
  saveDevAuth: (userId: string, secret: string) => {
    storageSet(ADMIN_DEV_USER_KEY, userId.trim());
    storageSet(ADMIN_DEV_SECRET_KEY, secret);
  },
  clearDevAuth: () => {
    storageRemove(ADMIN_DEV_USER_KEY);
    storageRemove(ADMIN_DEV_SECRET_KEY);
  },
};

export const admin2 = {
  me: () => req<AdminMe>('/api/admin/v2/me'),
  dashboard: () => req<AdminDashboard>('/api/admin/v2/dashboard'),
  listUsers: (params: { q?: string; premium?: string; segment?: string; sortBy?: string; sortOrder?: string; page?: number; pageSize?: number } = {}) => {
    const s = new URLSearchParams();
    if (params.q) s.set('q', params.q);
    if (params.premium && params.premium !== 'all') s.set('premium', params.premium);
    if (params.segment && params.segment !== 'all') s.set('segment', params.segment);
    if (params.sortBy) s.set('sortBy', params.sortBy);
    if (params.sortOrder) s.set('sortOrder', params.sortOrder);
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
  listCharts: (params: { q?: string; page?: number } = {}) => {
    const s = new URLSearchParams();
    if (params.q) s.set('q', params.q);
    if (params.page) s.set('page', String(params.page));
    const suffix = s.toString() ? `?${s}` : '';
    return req<{ charts: AdminChartRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/admin/v2/charts${suffix}`);
  },
  getChart: (id: number, pii = false) =>
    req<{ chart: AdminChartDetail }>(`/api/admin/v2/charts/${id}${pii ? '?pii=1' : ''}`).then((d) => d.chart),
  recalcChart: (id: number) => req<{ ok: boolean; source: string | null; result: any }>(`/api/admin/v2/charts/${id}/recalculate`, { method: 'POST' }),
  testChart: (body: { name?: string; birthDate: string; birthTime?: string; birthPlace: string }) =>
    req<AdminChartTestResult>('/api/admin/v2/charts/verify', { method: 'POST', body }),
  payments: (page = 1) => req<{ payments: AdminPaymentRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/admin/v2/billing/payments?page=${page}`),
  subscriptions: (page = 1) => req<{ subscriptions: AdminSubscriptionRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/admin/v2/billing/subscriptions?page=${page}`),
  revenue: () => req<AdminRevenue>('/api/admin/v2/billing/revenue'),
  refund: (paymentId: number) => req<{ ok: boolean }>('/api/admin/v2/billing/refund', { method: 'POST', body: { paymentId } }),
  premiumPlans: () => req<{ plans: AdminPremiumPlan[] }>('/api/admin/v2/billing/plans'),
  savePremiumPlans: (plans: AdminPremiumPlan[]) => req<{ ok: boolean; plans: AdminPremiumPlan[] }>('/api/admin/v2/billing/plans', { method: 'PUT', body: { plans } }),
  listPromos: () => req<{ promos: AdminPromo[] }>('/api/admin/v2/promo'),
  createPromo: (body: { code: string; type?: string; value?: number; maxUses?: number; expiresAt?: string | null }) => req<{ ok: boolean }>('/api/admin/v2/promo', { method: 'POST', body }),
  disablePromo: (code: string) => req<{ ok: boolean }>('/api/admin/v2/promo', { method: 'DELETE', body: { code } }),
  // Content generation health
  contentDiagnostics: () => req<AdminContentHealth>('/api/admin/v2/content/diagnostics'),
  pingContentGeneration: () =>
    req<AdminContentPingResult>('/api/admin/v2/content/diagnostics', {
      method: 'POST',
      body: {},
    }),
  // AI prompts
  listPrompts: () => req<{ prompts: AdminPromptRow[] }>('/api/admin/v2/ai'),
  getPrompt: (id: number) => req<{ prompt: AdminPromptDetail; versions: any[] }>(`/api/admin/v2/ai/${id}`).then((d) => ({ ...d.prompt, versions: d.versions })),
  createPrompt: (body: { key: string; type?: string; locale?: string; body: string }) => req<{ ok: boolean; id: number }>('/api/admin/v2/ai', { method: 'POST', body }),
  updatePrompt: (id: number, body: string) => req<{ ok: boolean; version: number }>(`/api/admin/v2/ai/${id}`, { method: 'PATCH', body: { body } }),
  publishPrompt: (id: number) => req<{ ok: boolean }>(`/api/admin/v2/ai/${id}`, { method: 'POST', body: { action: 'publish' } }),
  archivePrompt: (id: number) => req<{ ok: boolean }>(`/api/admin/v2/ai/${id}`, { method: 'POST', body: { action: 'archive' } }),
  // CMS
  listCms: (type?: string) => req<{ items: AdminCmsRow[] }>(`/api/admin/v2/cms${type ? `?type=${encodeURIComponent(type)}` : ''}`),
  getCms: (id: number) => req<{ item: AdminCmsDetail; versions: any[] }>(`/api/admin/v2/cms/${id}`).then((d) => ({ ...d.item, versions: d.versions })),
  createCms: (body: { type: string; locale?: string; title?: string; body: string }) => req<{ ok: boolean; id: number }>('/api/admin/v2/cms', { method: 'POST', body }),
  updateCms: (id: number, body: string, title?: string) => req<{ ok: boolean; version: number }>(`/api/admin/v2/cms/${id}`, { method: 'PATCH', body: { body, title } }),
  publishCms: (id: number) => req<{ ok: boolean }>(`/api/admin/v2/cms/${id}`, { method: 'POST', body: { action: 'publish' } }),
  archiveCms: (id: number) => req<{ ok: boolean }>(`/api/admin/v2/cms/${id}`, { method: 'POST', body: { action: 'archive' } }),
  listForecastQuestions: (params: {
    status?: AdminForecastQuestion['status'] | 'all';
    period?: AdminForecastQuestion['period'] | 'all';
    q?: string;
  } = {}) => {
    const search = new URLSearchParams();
    if (params.status && params.status !== 'all') search.set('status', params.status);
    if (params.period && params.period !== 'all') search.set('period', params.period);
    if (params.q) search.set('q', params.q);
    const suffix = search.toString() ? `?${search}` : '';
    return req<{
      questions: AdminForecastQuestion[];
      pagination: { limit: number; offset: number; total: number };
    }>(`/api/admin/v2/forecast-questions${suffix}`);
  },
  moderateForecastQuestion: (
    id: number,
    action: 'approve' | 'reject' | 'retry',
    reason?: string,
  ) => req<{ ok: boolean; question: AdminForecastQuestion }>(
    `/api/admin/v2/forecast-questions/${id}`,
    { method: 'POST', body: { action, ...(reason ? { reason } : {}) } },
  ),
  // Communications
  sendPush: (body: { mode: 'user' | 'segment'; userId?: string; segment?: string; text: string }) => req<AdminSendResult>('/api/admin/v2/comms/send', { method: 'POST', body }),
  notifications: () => req<AdminNotificationsOverview>('/api/admin/v2/notifications'),
  updateNotificationScenario: (id: number, patch: Partial<AdminNotificationScenario>) =>
    req<{ ok: boolean; scenario: AdminNotificationScenario }>(`/api/admin/v2/notifications/scenarios/${id}`, { method: 'PATCH', body: patch }),
  saveNotificationTemplate: (body: Partial<AdminNotificationTemplate>) =>
    req<{ ok: boolean; template: AdminNotificationTemplate }>('/api/admin/v2/notifications/templates', { method: 'POST', body }),
  deleteNotificationTemplate: (id: number) =>
    req<{ ok: boolean }>(`/api/admin/v2/notifications/templates/${id}`, { method: 'DELETE' }),
  notificationsDiagnostics: () => req<AdminNotificationDiagnostics>('/api/admin/v2/notifications/diagnostics'),
  runNotifications: (body: { action: 'selftest' | 'dispatch' | 'plan'; userId?: string; jobType?: string }) =>
    req<AdminNotificationRunResult>('/api/admin/v2/notifications/run', { method: 'POST', body }),
  // Support
  listTickets: (status = 'all') => req<{ tickets: AdminTicketRow[] }>(`/api/admin/v2/support?status=${encodeURIComponent(status)}`),
  getTicket: (id: number) => req<AdminTicketDetail>(`/api/admin/v2/support/${id}`),
  createTicket: (body: { userId?: string; subject?: string; body: string }) => req<{ ok: boolean; id: number }>('/api/admin/v2/support', { method: 'POST', body }),
  replyTicket: (id: number, body: string, internal = false) => req<{ ok: boolean }>(`/api/admin/v2/support/${id}`, { method: 'POST', body: { action: 'reply', body, internal } }),
  setTicketStatus: (id: number, status: string) => req<{ ok: boolean }>(`/api/admin/v2/support/${id}`, { method: 'POST', body: { action: 'status', status } }),
  // Settings / feature flags
  listFlags: () => req<{ flags: AdminFlag[] }>('/api/admin/v2/settings'),
  setFlag: (key: string, value: any, description?: string) => req<{ ok: boolean }>('/api/admin/v2/settings', { method: 'PUT', body: { key, value, description } }),
  deleteFlag: (key: string) => req<{ ok: boolean }>('/api/admin/v2/settings', { method: 'DELETE', body: { key } }),
  audit: (params: { page?: number; action?: string } = {}) => {
    const s = new URLSearchParams();
    if (params.page) s.set('page', String(params.page));
    if (params.action) s.set('action', params.action);
    const suffix = s.toString() ? `?${s}` : '';
    return req<{ entries: AdminAuditRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/admin/v2/audit${suffix}`);
  },
};
