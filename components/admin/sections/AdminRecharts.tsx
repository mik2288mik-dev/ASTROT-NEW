import React, { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { admin2, type AdminTimeseriesPoint } from '../../../services/admin2Service';

type Metric = 'users' | 'revenue' | 'errors';
type ChartKind = 'line' | 'bar';

const LABELS: Record<Metric, { title: string; key: keyof AdminTimeseriesPoint; color: string }> = {
  users: { title: 'Активная аудитория', key: 'activeUsers', color: '#2563eb' },
  revenue: { title: 'Оборот Telegram Stars', key: 'stars', color: '#059669' },
  errors: { title: 'Технические ошибки', key: 'errors', color: '#dc2626' },
};

export const AdminRecharts: React.FC<{
  chartMetric: Metric;
  setChartMetric: (val: Metric) => void;
  chartDays: number;
  setChartDays: (val: number) => void;
}> = ({ chartMetric, setChartMetric, chartDays, setChartDays }) => {
  const [points, setPoints] = useState<AdminTimeseriesPoint[]>([]);
  const [chartKind, setChartKind] = useState<ChartKind>('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    admin2.timeseries(chartDays)
      .then((result) => { if (active) setPoints(result.points || []); })
      .catch(() => { if (active) setError('Не удалось загрузить реальные данные'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chartDays]);

  const data = useMemo(() => points.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' }),
  })), [points]);
  const metric = LABELS[chartMetric];
  const totalRustore = points.reduce((sum, point) => sum + point.rustorePurchases, 0);
  const totalStarsPurchases = points.reduce((sum, point) => sum + point.starPurchases, 0);
  const shared = { data, margin: { top: 8, right: 12, left: 0, bottom: 8 } };
  const axes = <>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={24} />
    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={42} />
    <Tooltip labelFormatter={(label) => `${label} · МСК`}
      formatter={(value) => [Number(value).toLocaleString('ru-RU'), metric.title]}
      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)' }} />
    <Brush dataKey="label" height={24} travellerWidth={8} stroke="#94a3b8" fill="#f8fafc" />
  </>;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{metric.title}</h3>
          <p className="text-xs text-gray-500 mt-1">Реальные данные · Europe/Moscow · Stars-покупок {totalStarsPurchases}, RuStore {totalRustore}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['users', 'revenue', 'errors'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setChartMetric(value)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${chartMetric === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600'}`}>
                {value === 'users' ? 'Аудитория' : value === 'revenue' ? 'Stars' : 'Ошибки'}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['line', 'bar'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setChartKind(value)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${chartKind === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600'}`}>
                {value === 'line' ? 'Линия' : 'Столбцы'}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {[7, 14, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => setChartDays(days)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${chartDays === days ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600'}`}>{days}д</button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-80 w-full" aria-live="polite">
        {loading ? <div className="h-full grid place-items-center text-sm text-gray-500">Загрузка данных…</div>
          : error ? <div className="h-full grid place-items-center text-sm text-rose-600">{error}</div>
            : data.length === 0 ? <div className="h-full grid place-items-center text-sm text-gray-500">За период нет данных</div>
              : <ResponsiveContainer width="100%" height="100%">
                {chartKind === 'bar' ? <BarChart {...shared}>{axes}<Bar dataKey={metric.key} name={metric.title} fill={metric.color} radius={[5, 5, 0, 0]} maxBarSize={36} /></BarChart>
                  : chartMetric === 'users' ? <AreaChart {...shared}><defs><linearGradient id="adminMetricFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={metric.color} stopOpacity={0.24}/><stop offset="100%" stopColor={metric.color} stopOpacity={0}/></linearGradient></defs>{axes}<Area type="monotone" dataKey={metric.key} name={metric.title} stroke={metric.color} strokeWidth={2.5} fill="url(#adminMetricFill)" /></AreaChart>
                    : <LineChart {...shared}>{axes}<Line type="monotone" dataKey={metric.key} name={metric.title} stroke={metric.color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart>}
              </ResponsiveContainer>}
      </div>
    </div>
  );
};
