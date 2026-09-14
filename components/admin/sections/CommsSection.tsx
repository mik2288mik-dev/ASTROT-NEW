import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminNotificationDiagnostics,
  AdminNotificationsOverview,
  AdminNotificationScenario,
  AdminNotificationTemplate,
  AdminTicketRow,
  AdminTicketDetail,
} from '../../../services/admin2Service';
import { StatusBadge } from '../common/StatusBadge';

interface CommsSectionProps {
  onSelectUser?: (userId: string) => void;
}

export const CommsSection: React.FC<CommsSectionProps> = ({ onSelectUser }) => {
  const [activeTab, setActiveTab] = useState<'health' | 'manual' | 'scenarios' | 'templates' | 'support'>('health');

  // ===================== HEALTH =====================
  const [diagnostics, setDiagnostics] = useState<AdminNotificationDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [runningAction, setRunningAction] = useState(false);

  // ===================== MANUAL PUSH =====================
  const [pushMode, setPushMode] = useState<'user' | 'segment'>('user');
  const [pushUserId, setPushUserId] = useState('');
  const [pushSegment, setPushSegment] = useState('all');
  const [pushText, setPushText] = useState('');
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<any | null>(null);

  // ===================== SCENARIOS & TEMPLATES =====================
  const [overview, setOverview] = useState<AdminNotificationsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Template editor modal
  const [editingTemplate, setEditingTemplate] = useState<Partial<AdminNotificationTemplate> | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);

  // ===================== SUPPORT =====================
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [ticketStatus, setTicketStatus] = useState('all');
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<AdminTicketDetail | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [replySending, setReplySending] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await admin2.notificationsDiagnostics();
      setDiagnostics(res);
    } catch (e) {
      // ignore
    } finally {
      setDiagLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await admin2.notifications();
      setOverview(res);
    } catch (e) {
      // ignore
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await admin2.listTickets(ticketStatus);
      setTickets(res.tickets || []);
    } catch (e) {
      // ignore
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketStatus]);

  useEffect(() => {
    if (activeTab === 'health') loadDiagnostics();
    if (activeTab === 'scenarios' || activeTab === 'templates') loadOverview();
    if (activeTab === 'support') loadTickets();
  }, [activeTab, loadDiagnostics, loadOverview, loadTickets]);

  const handleRunAction = async (action: 'selftest' | 'dispatch' | 'plan') => {
    setRunningAction(true);
    try {
      const res = await admin2.runNotifications({ action });
      alert(`Действие выполнено: ${JSON.stringify(res.result)}`);
      loadDiagnostics();
    } catch (e: any) {
      alert(e.message || 'Ошибка выполнения действия');
    } finally {
      setRunningAction(false);
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushText.trim()) return;
    setPushSending(true);
    setPushResult(null);
    try {
      const res = await admin2.sendPush({
        mode: pushMode,
        userId: pushMode === 'user' ? pushUserId.trim() : undefined,
        segment: pushMode === 'segment' ? pushSegment : undefined,
        text: pushText.trim(),
      });
      setPushResult(res);
      setPushText('');
    } catch (e: any) {
      alert(e.message || 'Ошибка отправки пуша');
    } finally {
      setPushSending(false);
    }
  };

  const handleToggleScenario = async (sc: AdminNotificationScenario) => {
    try {
      await admin2.updateNotificationScenario(sc.id, { enabled: !sc.enabled });
      loadOverview();
    } catch (e: any) {
      alert(e.message || 'Ошибка изменения сценария');
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.text) return;
    setTemplateSaving(true);
    try {
      await admin2.saveNotificationTemplate(editingTemplate);
      setEditingTemplate(null);
      loadOverview();
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения шаблона');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Удалить этот шаблон пуша?')) return;
    try {
      await admin2.deleteNotificationTemplate(id);
      loadOverview();
    } catch (e: any) {
      alert(e.message || 'Ошибка удаления шаблона');
    }
  };

  const handleOpenTicket = async (id: number) => {
    try {
      const detail = await admin2.getTicket(id);
      setSelectedTicket(detail);
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки тикета');
    }
  };

  const handleReplyTicket = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setReplySending(true);
    try {
      await admin2.replyTicket(selectedTicket.ticket.id, replyText.trim(), replyInternal);
      setReplyText('');
      handleOpenTicket(selectedTicket.ticket.id);
      loadTickets();
    } catch (e: any) {
      alert(e.message || 'Ошибка отправки ответа');
    } finally {
      setReplySending(false);
    }
  };

  const handleChangeTicketStatus = async (id: number, status: string) => {
    try {
      await admin2.setTicketStatus(id, status);
      handleOpenTicket(id);
      loadTickets();
    } catch (e: any) {
      alert(e.message || 'Ошибка изменения статуса');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Коммуникации, Пуши & Поддержка</h2>
          <p className="text-sm text-gray-500 mt-1">
            Здоровье планировщика, ручные рассылки, сценарии триггеров и тикеты пользователей
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'health' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Здоровье воркера
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'manual' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Ручной Push
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'scenarios' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Сценарии
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Шаблоны
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'support' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Тикеты саппорта
          </button>
        </div>
      </div>

      {/* ===================== HEALTH ===================== */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Состояние подсистемы уведомлений</h3>

            {diagLoading ? (
              <div className="py-12 text-center text-gray-400">Проверка состояния...</div>
            ) : diagnostics ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Общее здоровье:</span>
                  <StatusBadge status={diagnostics.healthy ? 'active' : 'error'} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Telegram Bot Token:</span>
                  <span className={`font-semibold ${diagnostics.env.botTokenPresent ? 'text-emerald-600' : 'text-red-600'}`}>
                    {diagnostics.env.botTokenPresent ? 'Подключен (@' + (diagnostics.env.botUsername || 'bot') + ')' : 'Не найден'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Режим Dry Run:</span>
                  <span className="font-mono">{diagnostics.env.dryRun ? 'ВКЛЮЧЕН (без реальной отправки)' : 'ВЫКЛЮЧЕН (боевой)'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Планировщик запущен:</span>
                  <span className="font-semibold">{diagnostics.scheduler.started ? 'Да' : 'Нет'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Очередь (в ожидании):</span>
                  <span className="font-bold text-indigo-600">{diagnostics.health.queue.scheduled} сообщений</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Отправлено за 24ч:</span>
                  <span className="font-bold text-emerald-600">{diagnostics.health.queue.sentLast24h} шт.</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Ошибок за 24ч:</span>
                  <span className="font-bold text-rose-600">{diagnostics.health.queue.failedLast24h} шт.</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">Данные недоступны</div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleRunAction('selftest')}
                disabled={runningAction}
                className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Запустить Self-Test
              </button>
              <button
                onClick={() => handleRunAction('dispatch')}
                disabled={runningAction}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Принудительный Dispatch
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-base">Тестовый зонд администратора (Owner Probe)</h3>
            {diagnostics?.ownerProbe ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <div className="text-gray-500">Текущий кандидат на отправку:</div>
                  <div className="font-bold text-gray-900">
                    {diagnostics.ownerProbe.candidateNow
                      ? `${diagnostics.ownerProbe.candidateNow.job} (${diagnostics.ownerProbe.candidateNow.type})`
                      : 'Нет готовых пушей на текущую минуту'}
                  </div>
                </div>

                {diagnostics.ownerProbe.gates && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl">
                    <div>Тихие часы (ночь): {diagnostics.ownerProbe.gates.quietHoursNow ? 'Да (пауза)' : 'Нет'}</div>
                    <div>Отправлено сегодня: {diagnostics.ownerProbe.gates.sentToday} / {diagnostics.ownerProbe.gates.dailyLimit}</div>
                    <div>Время пользователя: {diagnostics.ownerProbe.gates.localTime}</div>
                    <div>Дней неактивен: {diagnostics.ownerProbe.gates.daysInactive}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                Зонд доступен для учетной записи владельца бота
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MANUAL PUSH ===================== */}
      {activeTab === 'manual' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-2xl space-y-6">
          <h3 className="font-bold text-gray-900 text-base">Отправка мгновенного push-уведомления</h3>

          <form onSubmit={handleSendPush} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-600 mb-1">Режим отправки:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pushMode"
                    checked={pushMode === 'user'}
                    onChange={() => setPushMode('user')}
                    className="text-indigo-600"
                  />
                  <span>Одному пользователю</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pushMode"
                    checked={pushMode === 'segment'}
                    onChange={() => setPushMode('segment')}
                    className="text-indigo-600"
                  />
                  <span>Сегменту аудитории</span>
                </label>
              </div>
            </div>

            {pushMode === 'user' ? (
              <div>
                <label className="block font-semibold text-gray-600 mb-1">User ID:</label>
                <input
                  type="text"
                  placeholder="ID пользователя Telegram"
                  value={pushUserId}
                  onChange={(e) => setPushUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Сегмент аудитории:</label>
                <select
                  value={pushSegment}
                  onChange={(e) => setPushSegment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white"
                >
                  <option value="all">Все пользователи (all)</option>
                  <option value="premium">Только Premium (premium)</option>
                  <option value="non_premium">Без Premium (non_premium)</option>
                  <option value="inactive_7d">Неактивные 7+ дней (inactive_7d)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-gray-600 mb-1">Текст сообщения:</label>
              <textarea
                rows={4}
                value={pushText}
                onChange={(e) => setPushText(e.target.value)}
                placeholder="Привет! Твой персональный прогноз на сегодня уже готов в NEBO..."
                className="w-full p-3 border border-gray-200 rounded-xl"
                required
              />
            </div>

            <button
              type="submit"
              disabled={pushSending}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {pushSending ? 'Отправка...' : 'Отправить уведомление'}
            </button>
          </form>

          {pushResult && (
            <div className="p-4 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-100 text-xs">
              <div className="font-bold mb-1">Результат отправки:</div>
              <div>Всего: {pushResult.total} | Успешно: {pushResult.sent} | Ошибок: {pushResult.failed}</div>
            </div>
          )}
        </div>
      )}

      {/* ===================== SCENARIOS ===================== */}
      {activeTab === 'scenarios' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Автоматические сценарии уведомлений</h3>
            <button onClick={() => loadOverview()} className="text-xs text-indigo-600 hover:underline">
              Обновить
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Сценарий / Ключ</th>
                  <th className="py-3 px-4">Окно отправки</th>
                  <th className="py-3 px-4">Шаблонов</th>
                  <th className="py-3 px-4">Отправлено</th>
                  <th className="py-3 px-4">Кликов / CTR</th>
                  <th className="py-3 px-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overviewLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">Загрузка сценариев...</td>
                  </tr>
                ) : !overview || overview.scenarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">Сценариев не найдено</td>
                  </tr>
                ) : (
                  overview.scenarios.map((sc) => (
                    <tr key={sc.id} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{sc.name}</div>
                        <div className="text-[11px] font-mono text-gray-400">{sc.key}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-gray-600">
                        {sc.timeWindowStart} — {sc.timeWindowEnd}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-800">{sc.activeTemplatesCount}</span>
                        <span className="text-gray-400"> / {sc.templatesCount}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {sc.sentCount.toLocaleString('ru-RU')}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-indigo-600">{sc.clickedCount}</span>
                        <span className="text-gray-400 ml-1">({sc.ctr}%)</span>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleScenario(sc)}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                            sc.enabled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {sc.enabled ? 'Включен' : 'Отключен'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TEMPLATES ===================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm">Шаблоны текстов пушей</h3>
            <button
              onClick={() => setEditingTemplate({ name: '', text: '', buttonText: 'Открыть NEBO', deepLink: 'today', isActive: true })}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
            >
              + Создать шаблон
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overview?.templates.map((tpl) => (
              <div key={tpl.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{tpl.name}</span>
                  <StatusBadge status={tpl.isActive ? 'active' : 'draft'} />
                </div>

                <p className="text-gray-700 bg-gray-50 p-2.5 rounded-xl whitespace-pre-wrap">{tpl.text}</p>

                <div className="flex items-center justify-between text-gray-400 pt-2 border-t border-gray-100">
                  <span>Ссылка: {tpl.deepLink || 'today'}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTemplate(tpl)}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="text-rose-600 hover:underline font-semibold"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Редактор шаблона пуша</h3>
              <button onClick={() => setEditingTemplate(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Название шаблона:</label>
                <input
                  type="text"
                  value={editingTemplate.name || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Текст пуша:</label>
                <textarea
                  rows={4}
                  value={editingTemplate.text || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, text: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Текст кнопки:</label>
                  <input
                    type="text"
                    value={editingTemplate.buttonText || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, buttonText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Deep Link:</label>
                  <input
                    type="text"
                    value={editingTemplate.deepLink || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, deepLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={templateSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  {templateSaving ? 'Сохранение...' : 'Сохранить шаблон'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== SUPPORT HUB ===================== */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets list */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Тикеты поддержки</h3>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg p-1 bg-white"
              >
                <option value="all">Все тикеты</option>
                <option value="open">Открытые</option>
                <option value="pending">В ожидании</option>
                <option value="closed">Закрытые</option>
              </select>
            </div>

            {ticketsLoading ? (
              <div className="py-8 text-center text-gray-400 text-xs">Загрузка тикетов...</div>
            ) : tickets.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">Тикетов не найдено</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleOpenTicket(t.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      selectedTicket?.ticket.id === t.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">#{t.id}: {t.subject}</div>
                    <div className="flex items-center justify-between text-gray-400 mt-1">
                      <span>{t.userName || t.userId || 'Аноним'}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Messages & Reply */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            {selectedTicket ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">
                      Тикет #{selectedTicket.ticket.id}: {selectedTicket.ticket.subject}
                    </h3>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Пользователь:{' '}
                      <button
                        onClick={() => selectedTicket.ticket.userId && onSelectUser && onSelectUser(selectedTicket.ticket.userId)}
                        className="font-mono text-indigo-600 hover:underline"
                      >
                        {selectedTicket.ticket.userId || '—'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTicket.ticket.status}
                      onChange={(e) => handleChangeTicketStatus(selectedTicket.ticket.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg p-1.5 bg-white"
                    >
                      <option value="open">Открыт</option>
                      <option value="pending">В ожидании</option>
                      <option value="resolved">Решен</option>
                      <option value="closed">Закрыт</option>
                    </select>
                  </div>
                </div>

                {/* Messages timeline */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto p-2">
                  {selectedTicket.messages.map((m, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl text-xs space-y-1 ${
                        m.authorType === 'admin'
                          ? m.internal
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-indigo-50 border border-indigo-100 text-indigo-950 ml-6'
                          : 'bg-gray-50 border border-gray-100 text-gray-900 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                        <span>
                          {m.authorType === 'admin' ? (m.internal ? '🔒 Внутренняя заметка' : '👨‍💼 Агент поддержки') : '👤 Пользователь'}
                        </span>
                        <span>{m.createdAt ? new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Напишите ответ пользователю или внутреннюю заметку..."
                    className="w-full p-2.5 text-xs border border-gray-200 rounded-xl"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replyInternal}
                        onChange={(e) => setReplyInternal(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Внутренняя заметка (скрыто от пользователя)</span>
                    </label>

                    <button
                      onClick={handleReplyTicket}
                      disabled={replySending || !replyText.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                    >
                      {replySending ? 'Отправка...' : 'Отправить'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-gray-400 text-sm">
                Выберите тикет из списка слева
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
