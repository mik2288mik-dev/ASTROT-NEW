/**
 * Тонкий клиент проверки админ-доступа для App.tsx.
 * Полноценный клиент админки — в services/admin2Service.ts (Admin v2).
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
    const initData = (window as any).Telegram?.WebApp?.initData;
    if (!initData || typeof initData !== 'string') return { isAdmin: false, requesterId: '' };
    const res = await apiFetch('/api/admin/v2/me', { headers: { [INIT_DATA_HEADER]: initData } });
    if (!res.ok) return { isAdmin: false, requesterId: '' };
    const payload = await res.json().catch(() => ({}));
    return { isAdmin: true, requesterId: String(payload.userId || '') };
  } catch {
    return { isAdmin: false, requesterId: '' };
  }
}
