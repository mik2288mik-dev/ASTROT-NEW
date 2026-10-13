import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminSystemHealth,
  AdminFlag,
  AdminEntry,
  AdminRole,
  AdminAuditRow,
  AdminMe,
} from '../../../services/admin2Service';
import { StatusBadge } from '../common/StatusBadge';
import {
  APP_ENTRY_ANNOUNCEMENT_FLAG,
  APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH,
  APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH,
} from '../../../lib/appEntryAnnouncement';

interface SystemSectionProps {
  me: AdminMe;
  onSelectUser?: (userId: string) => void;
}

const ROLES: AdminRole[] = [
  'super_admin',
  'admin',
  'content_manager',
  'support',
  'analyst',
  'finance',
  'marketing',
  'read_only',
];

export const SystemSection: React.FC<SystemSectionProps> = ({ me, onSelectUser }) => {
  const [activeTab, setActiveTab] = useState<'health' | 'announcement' | 'flags' | 'rbac' | 'audit'>('health');

  // ===================== HEALTH =====================
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // ===================== FLAGS =====================
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [editingFlagKey, setEditingFlagKey] = useState<string | null>(null);
  const [flagValText, setFlagValText] = useState('');
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagVal, setNewFlagVal] = useState('true');
  const [newFlagDesc, setNewFlagDesc] = useState('');

  // ===================== APP ENTRY ANNOUNCEMENT =====================
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementId, setAnnouncementId] = useState('');
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [announcementNotice, setAnnouncementNotice] = useState<string | null>(null);

  // ===================== RBAC =====================
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('support');

  // ===================== AUDIT =====================
  const [auditEntries, setAuditEntries] = useState<AdminAuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AdminAuditRow | null>(null);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await admin2.systemHealth();
      setHealth(res);
    } catch (e) {
      // ignore
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const res = await admin2.listFlags();
      setFlags(res.flags || []);
    } catch (e) {
      // ignore
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  const loadRbac = useCallback(async () => {
    setRbacLoading(true);
    try {
      const res = await admin2.listAdmins();
      setAdmins(res.admins || []);
    } catch (e) {
      // ignore
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await admin2.audit({ page: auditPage });
      setAuditEntries(res.entries || []);
      setAuditTotal(res.pagination?.total || 0);
    } catch (e) {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage]);

  useEffect(() => {
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'flags' || activeTab === 'announcement') loadFlags();
    if (activeTab === 'rbac') loadRbac();
    if (activeTab === 'audit') loadAudit();
  }, [activeTab, loadHealth, loadFlags, loadRbac, loadAudit]);

  useEffect(() => {
    if (activeTab !== 'announcement') return;
    const setting = flags.find((flag) => flag.key === APP_ENTRY_ANNOUNCEMENT_FLAG)?.value;
    if (!setting || typeof setting !== 'object' || Array.isArray(setting)) return;
    const value = setting as Record<string, unknown>;
    setAnnouncementTitle(typeof value.title === 'string' ? value.title : '');
    setAnnouncementMessage(typeof value.message === 'string' ? value.message : '');
    setAnnouncementId(typeof value.id === 'string' ? value.id : '');
  }, [activeTab, flags]);

  // Flag handlers
  const handleSaveFlag = async (key: string, rawVal: string, desc?: string) => {
    try {
      let parsed: any = rawVal;
      try {
        parsed = JSON.parse(rawVal);
      } catch {
        // string
      }
      await admin2.setFlag(key, parsed, desc);
      setEditingFlagKey(null);
      loadFlags();
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения флага');
    }
  };

  const handleDeleteFlag = async (key: string) => {
    if (!confirm(`Удалить флаг ${key}?`)) return;
    try {
      await admin2.deleteFlag(key);
      loadFlags();
    } catch (e: any) {
      alert(e.message || 'Ошибка удаления флага');
    }
  };

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlagKey.trim()) return;
    await handleSaveFlag(newFlagKey.trim(), newFlagVal, newFlagDesc.trim());
    setNewFlagKey('');
    setNewFlagDesc('');
  };

  const saveAnnouncement = async (enabled: boolean) => {
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();
    if (enabled && (!title || !message)) {
      setAnnouncementNotice('Заполни заголовок и текст сообщения.');
      return;
    }
    setAnnouncementBusy(true);
    setAnnouncementNotice(null);
    try {
      const id = enabled ? `entry-${Date.now().toString(36)}` : announcementId || `entry-${Date.now().toString(36)}`;
      await admin2.setFlag(APP_ENTRY_ANNOUNCEMENT_FLAG, {
        enabled,
        id,
        title: title || 'Сообщение',
        message: message || 'Сообщение скрыто.',
      }, 'Входное сообщение для всех пользователей приложения');
      setAnnouncementId(id);
      setAnnouncementNotice(enabled
        ? 'Сообщение опубликовано. Каждый пользователь увидит эту новую версию один раз при входе.'
        : 'Входное сообщение скрыто.');
      await loadFlags();
    } catch (error) {
      setAnnouncementNotice(error instanceof Error ? error.message : 'Не удалось сохранить сообщение.');
    } finally {
      setAnnouncementBusy(false);
    }
  };

  // RBAC handlers
  const handleSetRole = async (userId: string, role: AdminRole) => {
    try {
      await admin2.setRole(userId, role);
      loadRbac();
    } catch (e: any) {
      alert(e.message || 'Ошибка назначения роли');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!confirm(`Отозвать права администратора у ${userId}?`)) return;
    try {
      await admin2.removeAdmin(userId);
      loadRbac();
    } catch (e: any) {
      alert(e.message || 'Ошибка отзыва прав');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUserId.trim()) return;
    await handleSetRole(newAdminUserId.trim(), newAdminRole);
    setNewAdminUserId('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Системный центр & Безопасность</h2>
          <p className="text-sm text-gray-500 mt-1">
            Диагностика инфраструктуры, Feature Flags, разграничение прав (RBAC) и журнал аудита
          </p>
        </div>

        <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'health' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Здоровье системы
          </button>
          {me.isOwner && (
            <button
              onClick={() => setActiveTab('announcement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'announcement' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Сообщение в приложении
            </button>
          )}
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'flags' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Feature Flags
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rbac' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Роли (RBAC)
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'audit' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Аудит действий
          </button>
        </div>
      </div>

      {/* ===================== HEALTH ===================== */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">База данных & Очереди</h3>
            {healthLoading ? (
              <div className="py-12 text-center text-gray-400">Проверка компонентов...</div>
            ) : health ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">PostgreSQL статус:</span>
                  <StatusBadge status={health.database.status} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Ping latency:</span>
                  <span className="font-mono font-semibold">{health.database.latencyMs} мс</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Пул соединений:</span>
                  <span className="font-mono">
                    Всего: {health.database.pool.total} | Свободно: {health.database.pool.idle} | В очереди: {health.database.pool.waiting}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Очередь уведомлений:</span>
                  <span className="font-mono">
                    Ожидают: {health.queues.notifications.pending} | Сбоев: {health.queues.notifications.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Очередь Outbox (Nebo Ops):</span>
                  <span className="font-mono">
                    Ожидают: {health.queues.opsOutbox.pending} | Сбоев: {health.queues.opsOutbox.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Ошибок за последний 1 час:</span>
                  <span className={`font-bold ${health.errorsLast1h > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {health.errorsLast1h} инцидентов
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">Данные недоступны</div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Node.js Runtime & Память</h3>
            {health ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Окружение (ENV):</span>
                  <span className="font-mono font-semibold bg-gray-100 px-2 py-0.5 rounded">{health.system.env}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Node.js Version:</span>
                  <span className="font-mono">{health.system.nodeVersion}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Uptime сервера:</span>
                  <span className="font-mono">{Math.floor(health.system.uptimeSeconds / 3600)} ч. {Math.floor((health.system.uptimeSeconds % 3600) / 60)} мин.</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Память RSS:</span>
                  <span className="font-mono font-semibold">{health.system.rssMb} MB</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Heap Used / Total:</span>
                  <span className="font-mono">{health.system.heapUsedMb} MB / {health.system.heapTotalMb} MB</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">Данные недоступны</div>
            )}

            <div className="pt-2">
              <button
                onClick={() => loadHealth()}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Обновить диагностику
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== APP ENTRY ANNOUNCEMENT ===================== */}
      {activeTab === 'announcement' && me.isOwner && (
        <section className="max-w-2xl bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Сообщение при входе</h3>
            <p className="text-sm text-gray-500 mt-1">
              Это не push-уведомление: сообщение появится поверх главного экрана один раз для каждого пользователя после публикации.
            </p>
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-1 text-sm" htmlFor="app-entry-announcement-title">Заголовок</label>
            <input
              id="app-entry-announcement-title"
              type="text"
              value={announcementTitle}
              maxLength={APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              placeholder="Например: Важное сообщение"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              disabled={announcementBusy}
            />
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-1 text-sm" htmlFor="app-entry-announcement-message">Текст</label>
            <textarea
              id="app-entry-announcement-message"
              value={announcementMessage}
              maxLength={APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH}
              onChange={(event) => setAnnouncementMessage(event.target.value)}
              placeholder="Что нужно сообщить пользователям"
              className="w-full min-h-32 px-3 py-2 border border-gray-200 rounded-xl resize-y"
              disabled={announcementBusy}
            />
            <p className="mt-1 text-xs text-gray-400">{announcementMessage.length} / {APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH}</p>
          </div>
          {announcementNotice && <p className="text-sm text-gray-600" role="status">{announcementNotice}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveAnnouncement(true)}
              disabled={announcementBusy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl"
            >
              {announcementBusy ? 'Сохраняю…' : 'Опубликовать для всех'}
            </button>
            <button
              type="button"
              onClick={() => void saveAnnouncement(false)}
              disabled={announcementBusy || !announcementId}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-xl"
            >
              Скрыть сообщение
            </button>
          </div>
        </section>
      )}

      {/* ===================== FLAGS ===================== */}
      {activeTab === 'flags' && (
        <div className="space-y-6">
          {/* Create flag form */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Добавить или обновить Feature Flag</h3>
            <form onSubmit={handleCreateFlag} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Ключ флага:</label>
                <input
                  type="text"
                  placeholder="enable_matrix_calc"
                  value={newFlagKey}
                  onChange={(e) => setNewFlagKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 font-semibold mb-1">Значение (JSON / Bool):</label>
                <input
                  type="text"
                  placeholder="true / false / {...}"
                  value={newFlagVal}
                  onChange={(e) => setNewFlagVal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 font-semibold mb-1">Описание:</label>
                <input
                  type="text"
                  placeholder="Включает блок матрицы судьбы"
                  value={newFlagDesc}
                  onChange={(e) => setNewFlagDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  Сохранить флаг
                </button>
              </div>
            </form>
          </div>

          {/* Flags table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Ключ</th>
                    <th className="py-3 px-4">Значение</th>
                    <th className="py-3 px-4">Описание</th>
                    <th className="py-3 px-4">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {flagsLoading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-400">Загрузка флагов...</td>
                    </tr>
                  ) : flags.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-400">Флагов не создано</td>
                    </tr>
                  ) : (
                    flags.map((f) => (
                      <tr key={f.key} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">{f.key}</td>

                        <td className="py-3 px-4 font-mono">
                          {editingFlagKey === f.key ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={flagValText}
                                onChange={(e) => setFlagValText(e.target.value)}
                                className="px-2 py-1 border rounded text-xs"
                              />
                              <button
                                onClick={() => handleSaveFlag(f.key, flagValText, f.description || undefined)}
                                className="text-emerald-600 font-bold"
                              >
                                Сохранить
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded ${
                              f.value === true || f.value === 'true'
                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                : f.value === false || f.value === 'false'
                                ? 'bg-rose-50 text-rose-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {JSON.stringify(f.value)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-gray-600">{f.description || '—'}</td>

                        <td className="py-3 px-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setEditingFlagKey(f.key); setFlagValText(JSON.stringify(f.value)); }}
                              className="text-indigo-600 hover:underline font-semibold"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => handleDeleteFlag(f.key)}
                              className="text-rose-600 hover:underline font-semibold"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== RBAC ===================== */}
      {activeTab === 'rbac' && (
        <div className="space-y-6">
          {me.isOwner && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">Добавить администратора / назначить роль</h3>
              <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">User ID:</label>
                  <input
                    type="text"
                    placeholder="ID пользователя"
                    value={newAdminUserId}
                    onChange={(e) => setNewAdminUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Роль:</label>
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                  >
                    Назначить роль
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Пользователь</th>
                    <th className="py-3 px-4">Текущая роль</th>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rbacLoading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-400">Загрузка команды...</td>
                    </tr>
                  ) : (
                    admins.map((adm) => (
                      <tr key={adm.userId} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onSelectUser && onSelectUser(adm.userId)}
                            className="font-mono font-bold text-indigo-600 hover:underline"
                          >
                            {adm.userId}
                          </button>
                          {adm.name && <span className="text-gray-500 ml-2">({adm.name})</span>}
                          {adm.isOwner && (
                            <span className="ml-2 bg-amber-50 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Владелец (Owner)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {me.isOwner && !adm.isOwner ? (
                            <select
                              value={adm.role}
                              onChange={(e) => handleSetRole(adm.userId, e.target.value as AdminRole)}
                              className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white font-mono"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-800 font-semibold">
                              {adm.role}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <StatusBadge status={adm.status} />
                        </td>

                        <td className="py-3 px-4">
                          {me.isOwner && !adm.isOwner && (
                            <button
                              onClick={() => handleRemoveAdmin(adm.userId)}
                              className="text-rose-600 hover:underline font-semibold"
                            >
                              Отозвать права
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== AUDIT LOG ===================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Неизменяемый журнал аудита действий</h3>
              <span className="text-xs text-gray-500">Всего: {auditTotal} записей</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Время</th>
                    <th className="py-3 px-4">Администратор</th>
                    <th className="py-3 px-4">Действие</th>
                    <th className="py-3 px-4">Сущность</th>
                    <th className="py-3 px-4">IP / Клиент</th>
                    <th className="py-3 px-4">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">Загрузка журнала...</td>
                    </tr>
                  ) : auditEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">Записей аудита нет</td>
                    </tr>
                  ) : (
                    auditEntries.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                          {a.createdAt ? new Date(a.createdAt).toLocaleString('ru-RU') : '—'}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-gray-900">{a.actorUserId || 'system'}</span>
                          {a.actorRole && <div className="text-[10px] text-gray-400 font-mono">{a.actorRole}</div>}
                        </td>

                        <td className="py-3 px-4 font-semibold text-indigo-700">
                          {a.action}
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          {a.entityType && <span>{a.entityType}</span>}
                          {a.entityId && <span className="font-mono text-gray-500 ml-1">#{a.entityId}</span>}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                          {a.ip || '—'}
                        </td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedAudit(a)}
                            className="text-indigo-600 hover:underline font-semibold"
                          >
                            Diff
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div>Страница {auditPage}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  Назад
                </button>
                <button
                  onClick={() => setAuditPage((p) => p + 1)}
                  disabled={auditEntries.length < 50}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  Вперед
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Diff Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">
                Аудит #{selectedAudit.id}: {selectedAudit.action}
              </h3>
              <button onClick={() => setSelectedAudit(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 text-xs">
              <div>
                <div className="font-semibold text-gray-500 mb-1">До изменения (Before):</div>
                <pre className="p-3 bg-gray-50 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedAudit.before, null, 2) || 'null'}
                </pre>
              </div>

              <div>
                <div className="font-semibold text-gray-500 mb-1">После изменения (After):</div>
                <pre className="p-3 bg-gray-50 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedAudit.after, null, 2) || 'null'}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedAudit(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
