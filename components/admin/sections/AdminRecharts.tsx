import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';

export const AdminRecharts: React.FC<{
  chartMetric: 'users' | 'revenue' | 'errors';
  setChartMetric: (val: 'users' | 'revenue' | 'errors') => void;
  chartDays: number;
  setChartDays: (val: number) => void;
}> = ({ chartMetric, setChartMetric, chartDays, setChartDays }) => {
  
  // Dummy data generator that looks realistic
  const generateData = () => {
    const data = [];
    const now = new Date();
    for (let i = chartDays; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        name: `${d.getDate()}.${d.getMonth() + 1}`,
        users: Math.floor(Math.random() * 100) + 50 + (i % 7 === 0 ? 150 : 0),
        revenue: Math.floor(Math.random() * 500) + 1000,
        errors: Math.floor(Math.random() * 10),
      });
    }
    return data;
  };

  const data = generateData();

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Метрики и Графики</h3>
          <p className="text-xs text-gray-500">Визуализация ключевых показателей (демо)</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['users', 'revenue', 'errors'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  chartMetric === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'users' ? 'Аудитория' : m === 'revenue' ? 'Доход' : 'Ошибки'}
              </button>
            ))}
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  chartDays === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d}д
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-80 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          {chartMetric === 'users' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
            </AreaChart>
          ) : chartMetric === 'revenue' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
