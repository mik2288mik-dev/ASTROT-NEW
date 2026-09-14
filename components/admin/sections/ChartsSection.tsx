import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminChartRow,
  AdminChartDetail,
  AdminChartTestResult,
} from '../../../services/admin2Service';
import { StatusBadge } from '../common/StatusBadge';

interface ChartsSectionProps {
  onSelectUser?: (userId: string) => void;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ onSelectUser }) => {
  const [charts, setCharts] = useState<AdminChartRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Selected chart details
  const [selectedChart, setSelectedChart] = useState<AdminChartDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Test Calculator Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testDate, setTestDate] = useState('1990-05-15');
  const [testTime, setTestTime] = useState('14:30');
  const [testPlace, setTestPlace] = useState('Москва');
  const [testResult, setTestResult] = useState<AdminChartTestResult | null>(null);
  const [testCalculating, setTestCalculating] = useState(false);

  const loadCharts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin2.listCharts({ q: search || undefined, page });
      setCharts(res.charts || []);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const handleOpenDetail = async (id: number, pii = false) => {
    setDetailLoading(true);
    try {
      const detail = await admin2.getChart(id, pii);
      setSelectedChart(detail);
      setPiiRevealed(pii);
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки деталей карты');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRecalc = async (id: number) => {
    if (!confirm('Выполнить пересчет натальной карты по актуальным эфемеридам?')) return;
    setRecalculating(true);
    try {
      await admin2.recalcChart(id);
      alert('Карта успешно пересчитана');
      handleOpenDetail(id, piiRevealed);
      loadCharts();
    } catch (e: any) {
      alert(e.message || 'Ошибка пересчета карты');
    } finally {
      setRecalculating(false);
    }
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestCalculating(true);
    try {
      const res = await admin2.testChart({
        birthDate: testDate,
        birthTime: testTime,
        birthPlace: testPlace,
      });
      setTestResult(res);
    } catch (e: any) {
      alert(e.message || 'Ошибка тестового расчета');
    } finally {
      setTestCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Натальные карты & Астро-движок</h2>
          <p className="text-sm text-gray-500 mt-1">
            База натальных профилей, расчет аспектов, асцендента и диагностика эфемерид
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <span>✨</span>
            <span>Тестовый калькулятор</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <input
          type="text"
          placeholder="Поиск по имени владельца, названию карты или User ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      {/* Charts Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                <th className="py-3 px-4">ID / Название</th>
                <th className="py-3 px-4">Владелец</th>
                <th className="py-3 px-4">Солнце / Луна / ASC</th>
                <th className="py-3 px-4">Версия расчета</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && charts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">Загрузка карт...</td>
                </tr>
              ) : charts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">Натальных карт не найдено</td>
                </tr>
              ) : (
                charts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{c.name || 'Основная карта'}</div>
                      <div className="text-[11px] text-gray-400">#{c.id} {c.isPrimary && '• Главная'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectUser && onSelectUser(c.userId)}
                        className="font-mono text-indigo-600 hover:underline font-medium"
                      >
                        {c.userId}
                      </button>
                      {c.ownerName && <div className="text-gray-500 text-[11px]">{c.ownerName}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <span>☀️ {c.sunSign || '—'}</span>
                        <span className="text-gray-300">•</span>
                        <span>🌙 {c.moonSign || '—'}</span>
                        <span className="text-gray-300">•</span>
                        <span>ASC: {c.ascendantSign || '—'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-gray-500">
                      {c.version || 'v1'}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={c.status} />
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleOpenDetail(c.id, false)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>Всего: {total} карт</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
            >
              Назад
            </button>
            <span className="py-1 px-2 font-medium text-gray-700">Стр. {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={charts.length < 50}
              className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
            >
              Вперед
            </button>
          </div>
        </div>
      </div>

      {/* Chart Detail Modal */}
      {selectedChart && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedChart.name} (Карта #{selectedChart.id})</h3>
                <p className="text-xs text-gray-400">User ID: {selectedChart.userId}</p>
              </div>
              <button onClick={() => setSelectedChart(null)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* PII block */}
              <div className="bg-amber-50/60 border border-amber-200/60 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-900">Персональные данные рождения</span>
                  {!piiRevealed ? (
                    <button
                      onClick={() => handleOpenDetail(selectedChart.id, true)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Показать PII (с логированием)
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-800 font-semibold">Раскрыто (запись в Audit)</span>
                  )}
                </div>

                {piiRevealed ? (
                  <div className="grid grid-cols-2 gap-2 text-gray-800 pt-1">
                    <div>Дата: <strong>{selectedChart.input.birthDate || '—'}</strong></div>
                    <div>Время: <strong>{selectedChart.input.birthTime || '—'}</strong></div>
                    <div className="col-span-2">Город: <strong>{selectedChart.input.birthPlace || '—'}</strong></div>
                    <div>Координаты: {selectedChart.input.latitude}, {selectedChart.input.longitude}</div>
                    <div>Часовой пояс: {selectedChart.input.timezone}</div>
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-[11px]">
                    Дата и время рождения скрыты согласно GDPR/152-ФЗ.
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleRecalc(selectedChart.id)}
                  disabled={recalculating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {recalculating ? 'Пересчет...' : 'Принудительно пересчитать'}
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedChart(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Calculator Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Тестовый расчет натальной карты</h3>
              <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleRunTest} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Дата рождения</label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Время</label>
                <input
                  type="time"
                  value={testTime}
                  onChange={(e) => setTestTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Город рождения</label>
                <input
                  type="text"
                  value={testPlace}
                  onChange={(e) => setTestPlace(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={testCalculating}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {testCalculating ? 'Расчет координат...' : 'Рассчитать координаты & дома'}
                </button>
              </div>
            </form>

            {testResult && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-mono max-h-60 overflow-y-auto space-y-2">
                <div className="font-bold text-gray-900">Результат расчета:</div>
                <pre className="whitespace-pre-wrap text-gray-700">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
