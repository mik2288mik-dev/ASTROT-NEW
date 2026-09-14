import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminAiRequestRow,
  AdminAiDefectRow,
  AdminPromptRow,
  AdminPromptDetail,
  AdminContentHealth,
  AdminContentPingResult,
} from '../../../services/admin2Service';
import { StatusBadge } from '../common/StatusBadge';

export const AiSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'requests' | 'defects' | 'prompts' | 'ping'>('requests');

  // ===================== TAB 1: REQUESTS =====================
  const [requests, setRequests] = useState<AdminAiRequestRow[]>([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Filters for requests
  const [filterScenario, setFilterScenario] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterTraceId, setFilterTraceId] = useState('');

  // Request detail modal
  const [selectedRequest, setSelectedRequest] = useState<AdminAiRequestRow | null>(null);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await admin2.aiRequests({
        page: requestsPage,
        pageSize: 30,
        scenario: filterScenario || undefined,
        status: filterStatus || undefined,
        model: filterModel || undefined,
        userId: filterUserId || undefined,
        traceId: filterTraceId || undefined,
      });
      setRequests(res.requests || []);
      setRequestsTotal(res.pagination?.total || 0);
    } catch (e: any) {
      setRequestsError(e.message || 'Ошибка загрузки запросов');
    } finally {
      setRequestsLoading(false);
    }
  }, [requestsPage, filterScenario, filterStatus, filterModel, filterUserId, filterTraceId]);

  useEffect(() => {
    if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab, loadRequests]);

  // ===================== TAB 2: DEFECTS =====================
  const [defects, setDefects] = useState<AdminAiDefectRow[]>([]);
  const [defectsStatusFilter, setDefectsStatusFilter] = useState('all');
  const [defectsLoading, setDefectsLoading] = useState(false);
  const [defectsError, setDefectsError] = useState<string | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<AdminAiDefectRow | null>(null);
  const [defectEditStatus, setDefectEditStatus] = useState<string>('investigating');
  const [defectNote, setDefectNote] = useState('');
  const [defectSaving, setDefectSaving] = useState(false);

  const loadDefects = useCallback(async () => {
    setDefectsLoading(true);
    setDefectsError(null);
    try {
      const res = await admin2.aiDefects(defectsStatusFilter);
      setDefects(res.defects || []);
    } catch (e: any) {
      setDefectsError(e.message || 'Ошибка загрузки дефектов');
    } finally {
      setDefectsLoading(false);
    }
  }, [defectsStatusFilter]);

  useEffect(() => {
    if (activeTab === 'defects') {
      loadDefects();
    }
  }, [activeTab, loadDefects]);

  const handleSaveDefectStatus = async () => {
    if (!selectedDefect) return;
    setDefectSaving(true);
    try {
      await admin2.patchAiDefect(selectedDefect.id, {
        status: defectEditStatus,
        adminNote: defectNote,
      });
      setSelectedDefect(null);
      loadDefects();
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения статуса');
    } finally {
      setDefectSaving(false);
    }
  };

  // ===================== TAB 3: PROMPTS =====================
  const [prompts, setPrompts] = useState<AdminPromptRow[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<AdminPromptDetail | null>(null);
  const [promptBodyText, setPromptBodyText] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    setPromptsError(null);
    try {
      const res = await admin2.listPrompts();
      setPrompts(res.prompts || []);
    } catch (e: any) {
      setPromptsError(e.message || 'Ошибка загрузки промптов');
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'prompts') {
      loadPrompts();
    }
  }, [activeTab, loadPrompts]);

  const handleSelectPrompt = async (id: number) => {
    try {
      const detail = await admin2.getPrompt(id);
      setEditingPrompt(detail);
      setPromptBodyText(detail.body || '');
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки промпта');
    }
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    setPromptSaving(true);
    try {
      await admin2.updatePrompt(editingPrompt.id, promptBodyText);
      alert('Версия промпта успешно обновлена');
      loadPrompts();
      handleSelectPrompt(editingPrompt.id);
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения');
    } finally {
      setPromptSaving(false);
    }
  };

  const handlePublishPrompt = async (id: number) => {
    if (!confirm('Опубликовать эту версию промпта для пользователей?')) return;
    try {
      await admin2.publishPrompt(id);
      alert('Промпт опубликован');
      loadPrompts();
      if (editingPrompt?.id === id) handleSelectPrompt(id);
    } catch (e: any) {
      alert(e.message || 'Ошибка публикации');
    }
  };

  // ===================== TAB 4: PING & HEALTH =====================
  const [health, setHealth] = useState<AdminContentHealth | null>(null);
  const [pingResult, setPingResult] = useState<AdminContentPingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await admin2.contentDiagnostics();
      setHealth(res);
    } catch (e) {
      // ignore
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ping') {
      loadHealth();
    }
  }, [activeTab, loadHealth]);

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await admin2.pingContentGeneration();
      setPingResult(res);
    } catch (e: any) {
      setPingResult({
        ok: false,
        result: { ok: false, model: 'unknown', latencyMs: 0, error: e.message || 'Ошибка вызова' },
      });
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Центр AI & Моделей (Luna / DeepSeek)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Мониторинг генераций, лог запросов, реестр дефектов и управление промптами
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'requests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Журнал запросов
          </button>
          <button
            onClick={() => setActiveTab('defects')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'defects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Реестр дефектов
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'prompts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Промпты
          </button>
          <button
            onClick={() => setActiveTab('ping')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'ping' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Тест-пинг
          </button>
        </div>
      </div>

      {/* ===================== TAB 1 CONTENT ===================== */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Сценарий</label>
              <select
                value={filterScenario}
                onChange={(e) => { setFilterScenario(e.target.value); setRequestsPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
              >
                <option value="">Все сценарии</option>
                <option value="forecast_personal">Личный прогноз (forecast_personal)</option>
                <option value="forecast_questions">Вопрос к прогнозу (forecast_questions)</option>
                <option value="natal_synthesis">Натальный разбор (natal_synthesis)</option>
                <option value="ai_health_ping">Тест-пинг (ai_health_ping)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Статус</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setRequestsPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
              >
                <option value="">Все статусы</option>
                <option value="success">Успех (success)</option>
                <option value="error">Ошибка (error)</option>
                <option value="rejected">Отклонен (rejected)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">User ID</label>
              <input
                type="text"
                placeholder="ID пользователя"
                value={filterUserId}
                onChange={(e) => { setFilterUserId(e.target.value); setRequestsPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Trace ID</label>
              <input
                type="text"
                placeholder="trace_..."
                value={filterTraceId}
                onChange={(e) => { setFilterTraceId(e.target.value); setRequestsPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setFilterScenario('');
                  setFilterStatus('');
                  setFilterModel('');
                  setFilterUserId('');
                  setFilterTraceId('');
                  setRequestsPage(1);
                }}
                className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium"
              >
                Сбросить
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {requestsError && (
              <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
                {requestsError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Время / Trace</th>
                    <th className="py-3 px-4">Сценарий</th>
                    <th className="py-3 px-4">Модель</th>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Токены</th>
                    <th className="py-3 px-4">Пользователь</th>
                    <th className="py-3 px-4">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requestsLoading && requests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        Загрузка лога запросов...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        Запросов не найдено
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => {
                      const d = new Date(r.createdAt);
                      const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-xs">
                            <span className="font-semibold text-gray-900">{timeStr}</span>
                            <div className="text-[10px] font-mono text-gray-400">{r.traceId}</div>
                          </td>

                          <td className="py-3 px-4 text-xs font-medium text-gray-800">
                            {r.scenario}
                          </td>

                          <td className="py-3 px-4 text-xs font-mono text-gray-600">
                            {r.model}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="py-3 px-4 text-xs font-mono">
                            {r.durationMs ? `${r.durationMs} мс` : '—'}
                          </td>

                          <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                            {r.tokensPrompt || r.tokensCompletion ? (
                              <span>{r.tokensPrompt || 0} / {r.tokensCompletion || 0}</span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs font-mono text-indigo-600">
                            {r.userId || '—'}
                          </td>

                          <td className="py-3 px-4 text-xs">
                            <button
                              onClick={() => setSelectedRequest(r)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                            >
                              Инспектор
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div>Всего: {requestsTotal} записей</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                  disabled={requestsPage <= 1}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  Назад
                </button>
                <span className="py-1 px-2 font-medium text-gray-700">Стр. {requestsPage}</span>
                <button
                  onClick={() => setRequestsPage((p) => p + 1)}
                  disabled={requests.length < 30}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  Вперед
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2 CONTENT ===================== */}
      {activeTab === 'defects' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Фильтр по статусу:</span>
              {['all', 'new', 'investigating', 'fixed', 'ignored'].map((st) => (
                <button
                  key={st}
                  onClick={() => setDefectsStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    defectsStatusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === 'all' ? 'Все' : st}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadDefects()}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Обновить
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {defectsLoading && defects.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">Загрузка дефектов...</div>
            ) : defects.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">
                Дефектов в выбранном статусе не обнаружено 🎉
              </div>
            ) : (
              defects.map((def) => (
                <div
                  key={def.id}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 transition-all flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={def.status} />
                      <span className="text-xs font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded font-semibold">
                        {def.errorCode}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{def.scenario} / {def.model}</span>
                    </div>

                    <h4 className="font-semibold text-gray-900 text-sm">{def.message}</h4>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Инцидентов: <strong className="text-gray-800">{def.occurrencesCount}</strong></span>
                      <span>Затронуто: <strong className="text-gray-800">{def.affectedUsersCount}</strong> чел.</span>
                      <span>Посл. сбой: {new Date(def.lastSeenAt).toLocaleString('ru-RU')}</span>
                    </div>

                    {def.adminNote && (
                      <div className="p-2.5 bg-amber-50 text-amber-800 rounded-xl text-xs">
                        <strong>Заметка админа:</strong> {def.adminNote}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => {
                        setSelectedDefect(def);
                        setDefectEditStatus(def.status);
                        setDefectNote(def.adminNote || '');
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Разбор дефекта
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 3 CONTENT ===================== */}
      {activeTab === 'prompts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prompts list */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm">Шаблоны промптов</h3>
            {promptsLoading ? (
              <div className="py-8 text-center text-gray-400 text-xs">Загрузка промптов...</div>
            ) : prompts.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">Промпты не найдены</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPrompt(p.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      editingPrompt?.id === p.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{p.key}</div>
                    <div className="flex items-center justify-between text-gray-400 mt-1">
                      <span>v{p.currentVersion || 1} • {p.locale || 'ru'}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prompt editor */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            {editingPrompt ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{editingPrompt.key}</h3>
                    <p className="text-xs text-gray-400">
                      Версия {editingPrompt.currentVersion} • Статус: {editingPrompt.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {editingPrompt.status !== 'published' && (
                      <button
                        onClick={() => handlePublishPrompt(editingPrompt.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium"
                      >
                        Опубликовать
                      </button>
                    )}
                    <button
                      onClick={handleSavePrompt}
                      disabled={promptSaving}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium disabled:opacity-50"
                    >
                      {promptSaving ? 'Сохранение...' : 'Сохранить черновик'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Текст промпта (System / User)</label>
                  <textarea
                    rows={16}
                    value={promptBodyText}
                    onChange={(e) => setPromptBodyText(e.target.value)}
                    className="w-full p-3 font-mono text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-gray-400 text-sm">
                Выберите промпт из списка слева для редактирования
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 4 CONTENT ===================== */}
      {activeTab === 'ping' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Диагностика окружения AI</h3>

            {health ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Статус системы:</span>
                  <StatusBadge status={health.healthy ? 'active' : 'error'} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Ключ API:</span>
                  <span className={`font-semibold ${health.openaiKeyPresent ? 'text-emerald-600' : 'text-red-500'}`}>
                    {health.openaiKeyPresent ? 'Установлен' : 'Отсутствует!'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Базовая модель:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{health.model}</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-sm">Загрузка статуса...</div>
            )}

            <div className="pt-4">
              <button
                onClick={handlePing}
                disabled={pinging}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {pinging ? 'Отправка тестового запроса...' : 'Запустить Live Ping (тест генерации)'}
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-base">Результат теста</h3>
            {pingResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={pingResult.result.ok ? 'active' : 'error'} />
                  <span className="text-xs font-mono text-gray-500">
                    Задержка: <strong>{pingResult.result.latencyMs} мс</strong>
                  </span>
                </div>

                {pingResult.result.sample && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs font-mono text-gray-800 whitespace-pre-wrap">
                    {pingResult.result.sample}
                  </div>
                )}

                {pingResult.result.error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-mono">
                    {pingResult.result.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 text-sm">
                Нажмите «Запустить Live Ping» для замера задержки и проверки ответа
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Inspector Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Инспектор вызова AI</h3>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{selectedRequest.traceId}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 p-3 rounded-xl">
                <div>
                  <span className="text-gray-400 block">Сценарий:</span>
                  <strong className="text-gray-800">{selectedRequest.scenario}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block">Модель:</span>
                  <strong className="text-gray-800">{selectedRequest.model}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block">Задержка:</span>
                  <strong className="text-gray-800">{selectedRequest.durationMs} мс</strong>
                </div>
                <div>
                  <span className="text-gray-400 block">Токены:</span>
                  <strong className="text-gray-800">
                    {selectedRequest.tokensPrompt || 0} in / {selectedRequest.tokensCompletion || 0} out
                  </strong>
                </div>
              </div>

              {selectedRequest.inputSafe && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Безопасный вход (Input Safe):</div>
                  <pre className="p-3 bg-gray-950 text-gray-100 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedRequest.inputSafe, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRequest.outputText && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Сгенерированный ответ (Output):</div>
                  <pre className="p-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap">
                    {selectedRequest.outputText}
                  </pre>
                </div>
              )}

              {selectedRequest.errorCode && (
                <div>
                  <div className="font-semibold text-red-700 mb-1">Ошибка: {selectedRequest.errorCode}</div>
                  <div className="p-3 bg-red-50 text-red-800 rounded-xl font-mono">
                    {selectedRequest.rejectionReason || 'Произошла ошибка выполнения запроса'}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defect Edit Modal */}
      {selectedDefect && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900">Управление дефектом #{selectedDefect.id}</h3>
              <button onClick={() => setSelectedDefect(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400">Ошибка:</span>
                <div className="font-semibold text-gray-800">{selectedDefect.message}</div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Статус расследования:</label>
                <select
                  value={defectEditStatus}
                  onChange={(e) => setDefectEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white"
                >
                  <option value="new">Новый (new)</option>
                  <option value="investigating">В расследовании (investigating)</option>
                  <option value="fixed">Исправлен (fixed)</option>
                  <option value="ignored">Игнорировать (ignored)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Заметка админа:</label>
                <textarea
                  rows={4}
                  value={defectNote}
                  onChange={(e) => setDefectNote(e.target.value)}
                  placeholder="Опишите причину ошибки или статус исправления..."
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setSelectedDefect(null)}
                className="px-4 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveDefectStatus}
                disabled={defectSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
              >
                {defectSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
