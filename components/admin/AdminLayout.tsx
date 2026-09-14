import React, { useState, useEffect } from 'react';
import { AdminMe, admin2 } from '../../services/admin2Service';
import { DashboardSection } from './sections/DashboardSection';
import { UsersSection } from './sections/UsersSection';
import { EventsSection } from './sections/EventsSection';
import { AiSection } from './sections/AiSection';
import { ErrorsSection } from './sections/ErrorsSection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import { BillingSection } from './sections/BillingSection';
import { ChartsSection } from './sections/ChartsSection';
import { ContentSection } from './sections/ContentSection';
import { CommsSection } from './sections/CommsSection';
import { SystemSection } from './sections/SystemSection';

export type AdminTab =
  | 'dashboard'
  | 'users'
  | 'events'
  | 'ai'
  | 'errors'
  | 'analytics'
  | 'billing'
  | 'charts'
  | 'content'
  | 'comms'
  | 'system';

interface AdminLayoutProps {
  me: AdminMe;
  initialTab?: AdminTab;
  onLogout?: () => void;
  onTabChange?: (tab: AdminTab) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  me,
  initialTab = 'dashboard',
  onLogout,
  onTabChange,
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  const handleSelectTab = (tab: AdminTab) => {
    setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const handleSelectUser = (userId: string) => {
    setTargetUserId(userId);
    handleSelectTab('users');
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    handleSelectUser(globalSearch.trim());
    setGlobalSearch('');
  };

  const navGroups = [
    {
      title: 'Операции',
      items: [
        { key: 'dashboard' as AdminTab, label: 'Пульс & Дашборд', icon: '⚡' },
        { key: 'users' as AdminTab, label: 'Пользователи', icon: '👥' },
        { key: 'events' as AdminTab, label: 'Журнал событий', icon: '📋' },
      ],
    },
    {
      title: 'Наблюдаемость',
      items: [
        { key: 'ai' as AdminTab, label: 'AI & Модели', icon: '🧠' },
        { key: 'errors' as AdminTab, label: 'Центр ошибок', icon: '🚨' },
        { key: 'analytics' as AdminTab, label: 'Воронки & Когорты', icon: '📈' },
      ],
    },
    {
      title: 'Бизнес & Продукт',
      items: [
        { key: 'billing' as AdminTab, label: 'Финансы & Тарифы', icon: '💳' },
        { key: 'charts' as AdminTab, label: 'Натальные карты', icon: '🌌' },
        { key: 'content' as AdminTab, label: 'Контент & Карточки', icon: '📝' },
        { key: 'comms' as AdminTab, label: 'Пуши & Саппорт', icon: '💬' },
      ],
    },
    {
      title: 'Управление',
      items: [
        { key: 'system' as AdminTab, label: 'Система & RBAC', icon: '⚙️' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-lg shadow-indigo-600/30">
              N
            </div>
            <div>
              <div className="font-extrabold text-white text-base tracking-wide flex items-center gap-1.5">
                <span>NEBO</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold">
                  OPS
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Панель управления</div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {navGroups.map((grp) => (
            <div key={grp.title} className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
                {grp.title}
              </div>
              {grp.items.map((item) => {
                const isActive = currentTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleSelectTab(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card in Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 overflow-hidden pr-2">
              <div className="text-xs font-bold text-slate-200 truncate">{me.userId}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/40">
                  {me.role}
                </span>
                {me.isOwner && (
                  <span className="text-[10px] text-amber-400 font-bold">★ Owner</span>
                )}
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Выйти"
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop TopBar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0">
          <form onSubmit={handleGlobalSearchSubmit} className="relative max-w-md w-full">
            <input
              type="text"
              placeholder="Быстрый поиск пользователя по ID (например: 123456)..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Production Live</span>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <div className="text-slate-600 font-medium">
              Права: <span className="font-mono text-indigo-600 font-semibold">{me.permissions.length}</span> правил
            </div>
          </div>
        </header>

        {/* Section Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentTab === 'dashboard' && (
              <DashboardSection onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'users' && (
              <UsersSection me={me} initialUserId={targetUserId || undefined} />
            )}

            {currentTab === 'events' && (
              <EventsSection onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'ai' && (
              <AiSection />
            )}

            {currentTab === 'errors' && (
              <ErrorsSection />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsSection />
            )}

            {currentTab === 'billing' && (
              <BillingSection onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'charts' && (
              <ChartsSection onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'content' && (
              <ContentSection me={me} onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'comms' && (
              <CommsSection onSelectUser={handleSelectUser} />
            )}

            {currentTab === 'system' && (
              <SystemSection me={me} onSelectUser={handleSelectUser} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
