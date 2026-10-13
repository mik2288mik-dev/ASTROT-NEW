/**
 * Тонкий клиент проверки админ-доступа для App.tsx.
 * Сама админка открывается на сайте (services/openAdmin.ts).
 */
import { apiFetch } from './apiClient';

const INIT_DATA_HEADER = 'x-telegram-init-data';

export class AdminApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Является ли текущий пользователь админом. Бьёт в /api/admin/v2/me:
 * 200 → админ (любая роль), 401/403 → нет. Никогда не бросает — App сам решает.
 */
export async function getAdminStatus(): Promise<{ isAdmin: boolean; requesterId: string }> {
  try {
    // The account session proves the user everywhere; Telegram adds its signed launch data.
    const initData = (window as any).Telegram?.WebApp?.initData;
    const headers = typeof initData === 'string' && initData ? { [INIT_DATA_HEADER]: initData } : undefined;
    const res = await apiFetch('/api/admin/v2/me', { headers });
    if (!res.ok) return { isAdmin: false, requesterId: '' };
    const payload = await res.json().catch(() => ({}));
    return { isAdmin: true, requesterId: String(payload.userId || '') };
  } catch {
    return { isAdmin: false, requesterId: '' };
  }
}
