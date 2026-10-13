import React, { useState, useEffect, useCallback } from 'react';
import { admin2 } from '../../../services/admin2Service';

interface EventsSectionProps {
  onSelectUser?: (userId: string) => void;
}

export const EventsSection: React.FC<EventsSectionProps> = ({ onSelectUser }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [suggestions, setSuggestions] = useState<{ eventTypes: string[]; sections: string[] }>({ eventTypes: [], sections: [] });

  // Selected event for payload inspector
  const [selectedPayload, setSelectedPayload] = useState<{ id: number; type: string; payload: any } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadEvents = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const res = await admin2.events({
        page,
        limit,
        search: search.trim() || undefined,
        userId: userIdFilter.trim() || undefined,
        eventType: eventTypeFilter.trim() || undefined,
        section: sectionFilter.trim() || undefined,
      });
      setEvents(res.events || []);
      setTotal(res.total || 0);
      if (res.filterSuggestions) {
        setSuggestions(res.filterSuggestions);
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки событий');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [page, limit, search, userIdFilter, eventTypeFilter, sectionFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadEvents(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadEvents]);

  const handleCopyPayload = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Журнал событий (Event Log)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Сквозная хронология пользовательских действий, навигации, кликов и триггеров
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Авто (15с)</span>
          </label>
          <button
            onClick={() => loadEvents()}
            disabled={loading}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Обновить
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Поиск</label>
            <input
              type="text"
              placeholder="Текст, ID, payload..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">User ID</label>
            <input
              type="text"
              placeholder="Например: 123456"
              value={userIdFilter}
              onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Тип события</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Все типы</option>
              {suggestions.eventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Раздел</label>
            <select
              value={sectionFilter}
              onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Все разделы</option>
              {suggestions.sections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSearch('');
                setUserIdFilter('');
                setEventTypeFilter('');
                setSectionFilter('');
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Время</th>
                <th className="py-3 px-4">Пользователь</th>
                <th className="py-3 px-4">Событие</th>
                <th className="py-3 px-4">Раздел / Источник</th>
                <th className="py-3 px-4">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Загрузка событий...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Событий не найдено
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const date = new Date(ev.occurred_at);
                  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                  const hasPayload = ev.payload_json && Object.keys(ev.payload_json).length > 0;

                  return (
                    <tr key={ev.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500">
                        <span className="font-semibold text-gray-800">{timeStr}</span>{' '}
                        <span className="text-gray-400">{dateStr}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {ev.user_id ? (
                          <button
                            onClick={() => onSelectUser && onSelectUser(ev.user_id)}
                            className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50/60 px-2 py-0.5 rounded"
                          >
                            {ev.user_id}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 font-mono">
                          {ev.event_type}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                        {ev.section && <span className="font-medium">{ev.section}</span>}
                        {ev.section && ev.source && <span className="text-gray-400 mx-1">•</span>}
                        {ev.source && <span className="text-gray-500">{ev.source}</span>}
                        {!ev.section && !ev.source && <span className="text-gray-400">—</span>}
                      </td>

                      <td className="py-3 px-4 text-xs">
                        {hasPayload ? (
                          <button
                            onClick={() => setSelectedPayload({ id: ev.id, type: ev.event_type, payload: ev.payload_json })}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          >
                            <span>Посмотреть JSON</span>
                            <span className="text-[10px] text-gray-400">({Object.keys(ev.payload_json).length} полей)</span>
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <div>
            Всего: <span className="font-semibold text-gray-900">{total}</span> событий. Страница{' '}
            <span className="font-semibold text-gray-900">{page}</span> из{' '}
            <span className="font-semibold text-gray-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Вперед
            </button>
          </div>
        </div>
      </div>

      {/* Payload Inspector Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Payload события #{selectedPayload.id}</h3>
                <p className="text-xs font-mono text-indigo-600 mt-0.5">{selectedPayload.type}</p>
              </div>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs bg-gray-950 text-gray-100 rounded-b-none m-4 rounded-xl">
              <pre className="whitespace-pre-wrap word-break">
                {JSON.stringify(selectedPayload.payload, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => handleCopyPayload(selectedPayload.payload)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copied ? 'Скопировано!' : 'Копировать JSON'}
              </button>
              <button
                onClick={() => setSelectedPayload(null)}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors"
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
