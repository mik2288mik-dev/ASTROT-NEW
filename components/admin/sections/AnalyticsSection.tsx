import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminFunnelStep,
  AdminCohortRow,
  AdminVersionRow,
  AdminAcquisitionData,
} from '../../../services/admin2Service';

export const AnalyticsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'funnels' | 'retention' | 'versions' | 'traffic'>('funnels');

  // Funnels
  const [funnelDays, setFunnelDays] = useState(30);
  const [funnelSteps, setFunnelSteps] = useState<AdminFunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Retention
  const [cohorts, setCohorts] = useState<AdminCohortRow[]>([]);
  const [retentionLoading, setRetentionLoading] = useState(false);

  // Versions
  const [versions, setVersions] = useState<AdminVersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Traffic
  const [trafficData, setTrafficData] = useState<AdminAcquisitionData | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);

  const loadFunnels = useCallback(async () => {
    setFunnelLoading(true);
    try {
      const res = await admin2.funnels(funnelDays);
      setFunnelSteps(res.steps || []);
    } catch (e) {
      // ignore
    } finally {
      setFunnelLoading(false);
    }
  }, [funnelDays]);

  const loadRetention = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const res = await admin2.retentionCohorts();
      setCohorts(res.cohorts || []);
    } catch (e) {
      // ignore
    } finally {
      setRetentionLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const res = await admin2.versions();
      setVersions(res.versions || []);
    } catch (e) {
      // ignore
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const loadTraffic = useCallback(async () => {
    setTrafficLoading(true);
    try {
      const res = await admin2.acquisition();
      setTrafficData(res);
    } catch (e) {
      // ignore
    } finally {
      setTrafficLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'funnels') loadFunnels();
    if (activeTab === 'retention') loadRetention();
    if (activeTab === 'versions') loadVersions();
    if (activeTab === 'traffic') loadTraffic();
  }, [activeTab, loadFunnels, loadRetention, loadVersions, loadTraffic]);

  const getHeatmapColor = (val: number | null) => {
    if (val === null || val === undefined) return 'bg-gray-50 text-gray-400';
    if (val >= 40) return 'bg-emerald-600 text-white font-semibold';
    if (val >= 25) return 'bg-emerald-500 text-white font-medium';
    if (val >= 15) return 'bg-emerald-400 text-slate-900';
    if (val >= 8) return 'bg-emerald-200 text-emerald-900';
    if (val > 0) return 'bg-emerald-50 text-emerald-800';
    return 'bg-gray-50 text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Продуктовая и когортная аналитика</h2>
          <p className="text-sm text-gray-500 mt-1">
            Воронки онбординга и монетизации, Retention matrix, версии и источники трафика
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('funnels')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'funnels' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Воронки
          </button>
          <button
            onClick={() => setActiveTab('retention')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'retention' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Когорты Retention
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'versions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Версии ПО
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'traffic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Источники (UA)
          </button>
        </div>
      </div>

      {/* ===================== FUNNELS ===================== */}
      {activeTab === 'funnels' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Период анализа:</span>
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setFunnelDays(d)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium ${
                    funnelDays === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d} дней
                </button>
              ))}
            </div>

            <button
              onClick={() => loadFunnels()}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Пересчитать
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-900 text-base">
              Воронка активации и первой конверсии в NEBO ({funnelDays} дн.)
            </h3>

            {funnelLoading ? (
              <div className="py-16 text-center text-gray-400">Расчет воронки...</div>
            ) : funnelSteps.length === 0 ? (
              <div className="py-16 text-center text-gray-400">Данные отсутствуют за выбранный период</div>
            ) : (
              <div className="space-y-5">
                {funnelSteps.map((step, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div key={step.key} className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-gray-800">{step.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-gray-900 font-bold text-sm">{step.users.toLocaleString('ru-RU')} чел.</span>
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-semibold">
                            {step.pctOfStart}% от старта
                          </span>
                          {!isFirst && (
                            <span className="text-gray-500">
                              {step.pctOfPrev}% от пред.
                            </span>
                          )}
                          {!isFirst && step.dropOffPct > 0 && (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                              ↓ {step.dropOffPct}% отвал
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(2, step.pctOfStart)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== RETENTION ===================== */}
      {activeTab === 'retention' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Когортный Retention (по неделям)</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Процент пользователей, вернувшихся в приложение через N дней после регистрации
              </p>
            </div>
            <button
              onClick={() => loadRetention()}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Обновить матрицу
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-600">
                  <th className="py-3 px-4 text-left">Неделя когорты</th>
                  <th className="py-3 px-4">Пользователей</th>
                  <th className="py-3 px-4">D1</th>
                  <th className="py-3 px-4">D3</th>
                  <th className="py-3 px-4">D7</th>
                  <th className="py-3 px-4">D14</th>
                  <th className="py-3 px-4">D30</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retentionLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Расчет когортного удержания...
                    </td>
                  </tr>
                ) : cohorts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Когортных данных пока нет
                    </td>
                  </tr>
                ) : (
                  cohorts.map((row) => (
                    <tr key={row.week} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4 text-left font-medium text-gray-800">
                        {new Date(row.week).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {row.cohortSize}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-1 rounded-md inline-block min-w-[45px] ${getHeatmapColor(row.d1)}`}>
                          {row.d1 !== null ? `${row.d1}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-1 rounded-md inline-block min-w-[45px] ${getHeatmapColor(row.d3)}`}>
                          {row.d3 !== null ? `${row.d3}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-1 rounded-md inline-block min-w-[45px] ${getHeatmapColor(row.d7)}`}>
                          {row.d7 !== null ? `${row.d7}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-1 rounded-md inline-block min-w-[45px] ${getHeatmapColor(row.d14)}`}>
                          {row.d14 !== null ? `${row.d14}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2.5 py-1 rounded-md inline-block min-w-[45px] ${getHeatmapColor(row.d30)}`}>
                          {row.d30 !== null ? `${row.d30}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== VERSIONS ===================== */}
      {activeTab === 'versions' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Аналитика версий клиента (N vs N-1)</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Распределение аудитории, конверсия в оплату и стабильность (индекс ошибок) по релизам
              </p>
            </div>
            <button
              onClick={() => loadVersions()}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Обновить
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-600">
                  <th className="py-3 px-4">Версия</th>
                  <th className="py-3 px-4">Всего польз.</th>
                  <th className="py-3 px-4">Active 7d</th>
                  <th className="py-3 px-4">Новые (30д)</th>
                  <th className="py-3 px-4">Premium</th>
                  <th className="py-3 px-4">Конверсия</th>
                  <th className="py-3 px-4">Ошибок</th>
                  <th className="py-3 px-4">Crash / Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {versionsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">Загрузка данных по версиям...</td>
                  </tr>
                ) : versions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">Нет данных о версиях</td>
                  </tr>
                ) : (
                  versions.map((ver) => (
                    <tr key={ver.version} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {ver.version}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {ver.totalUsers.toLocaleString('ru-RU')}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {ver.activeUsers7d}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {ver.newUsers30d}
                      </td>
                      <td className="py-3 px-4 text-amber-600 font-semibold">
                        {ver.premiumUsers}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-semibold">
                          {ver.conversionPct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {ver.errorsCount}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-mono font-semibold ${
                          ver.errorRate > 10 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {ver.errorRate}‰
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TRAFFIC / ACQUISITION ===================== */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Источники установок и маркетинговые кампании</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-600">
                    <th className="py-3 px-4">Источник (Source)</th>
                    <th className="py-3 px-4">Кампания (Campaign)</th>
                    <th className="py-3 px-4">Пользователей</th>
                    <th className="py-3 px-4">Active 7d</th>
                    <th className="py-3 px-4">Купили Premium</th>
                    <th className="py-3 px-4">Конверсия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trafficLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">Загрузка источников...</td>
                    </tr>
                  ) : !trafficData || trafficData.sources.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">Данные по кампаниям отсутствуют</td>
                    </tr>
                  ) : (
                    trafficData.sources.map((src, i) => (
                      <tr key={i} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4 font-semibold text-gray-900">{src.source}</td>
                        <td className="py-3 px-4 text-gray-600 font-mono">{src.campaign}</td>
                        <td className="py-3 px-4 font-medium text-gray-800">{src.users}</td>
                        <td className="py-3 px-4 text-gray-600">{src.active7d}</td>
                        <td className="py-3 px-4 text-amber-600 font-semibold">{src.premiumUsers}</td>
                        <td className="py-3 px-4">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                            {src.conversionPct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Провайдеры авторизации и платформы</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-600">
                    <th className="py-3 px-4">Провайдер</th>
                    <th className="py-3 px-4">Пользователей</th>
                    <th className="py-3 px-4">Active 7d</th>
                    <th className="py-3 px-4">Купили Premium</th>
                    <th className="py-3 px-4">Конверсия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trafficData?.providers.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4 font-bold text-gray-900">{p.provider}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">{p.users}</td>
                      <td className="py-3 px-4 text-gray-600">{p.active7d}</td>
                      <td className="py-3 px-4 text-amber-600 font-semibold">{p.premiumUsers}</td>
                      <td className="py-3 px-4">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                          {p.conversionPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
