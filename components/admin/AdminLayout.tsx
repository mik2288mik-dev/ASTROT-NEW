import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Orbit,
  Search,
  Settings2,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AdminMe } from '../../services/admin2Service';
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

type NavItem = { key: AdminTab; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { key: 'dashboard', label: 'Обзор', icon: LayoutDashboard },
      { key: 'users', label: 'Пользователи', icon: Users },
      { key: 'events', label: 'События', icon: Activity },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { key: 'analytics', label: 'Воронки и когорты', icon: ChartNoAxesCombined },
      { key: 'billing', label: 'Оплаты и Premium', icon: CircleDollarSign },
      { key: 'ai', label: 'AI и модели', icon: Bot },
      { key: 'errors', label: 'Ошибки', icon: TriangleAlert },
    ],
  },
  {
    title: 'Продукт',
    items: [
      { key: 'charts', label: 'Натальные карты', icon: Orbit },
      { key: 'content', label: 'Контент', icon: FileText },
      { key: 'comms', label: 'Уведомления и поддержка', icon: Bell },
      { key: 'system', label: 'Система и доступы', icon: Settings2 },
    ],
  },
];

const TITLES: Record<AdminTab, string> = {
  dashboard: 'Обзор',
  users: 'Пользователи',
  events: 'Журнал событий',
  ai: 'AI и модели',
  errors: 'Центр ошибок',
  analytics: 'Воронки и когорты',
  billing: 'Оплаты и Premium',
  charts: 'Натальные карты',
  content: 'Контент',
  comms: 'Уведомления и поддержка',
  system: 'Система и доступы',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  me,
  initialTab = 'dashboard',
  onLogout,
  onTabChange,
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => setCurrentTab(initialTab), [initialTab]);
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpen(false);
  }, []);

  const handleSelectTab = (tab: AdminTab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpen(false);
  };

  const handleSelectUser = (userId: string) => {
    setTargetUserId(userId);
    handleSelectTab('users');
  };

  const handleGlobalSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!globalSearch.trim()) return;
    handleSelectUser(globalSearch.trim());
    setGlobalSearch('');
  };

  const toggleFullscreen = () => {
    setFullWidth((value) => !value);
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => undefined);
    else document.exitFullscreen().catch(() => undefined);
  };

  return (
    <div className="admin2-app admin-shell">
      <button type="button" className={`admin-sidebar-scrim ${sidebarOpen ? 'is-visible' : ''}`} aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />

      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : 'is-collapsed'}`} aria-label="Разделы админки">
        <div className="admin-sidebar-brand">
          <div className="admin-wordmark" aria-label="NEBO Ops"><strong>NEBO</strong><span>OPS</span></div>
          <button type="button" className="admin-icon-button admin-sidebar-close" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)}><X aria-hidden="true" /></button>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <section key={group.title} className="admin-nav-group" aria-label={group.title}>
              <p>{group.title}</p>
              {group.items.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" className="admin-nav-item" aria-current={currentTab === key ? 'page' : undefined} onClick={() => handleSelectTab(key)}>
                  <Icon aria-hidden="true" /><span>{label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="admin-account">
          <div className="admin-account-copy"><strong title={me.userId}>{me.userId}</strong><p>{me.role}{me.isOwner ? ' · владелец' : ''}</p></div>
          {onLogout ? <button type="button" className="admin-icon-button" title="Выйти" aria-label="Выйти" onClick={onLogout}><LogOut aria-hidden="true" /></button> : null}
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <button type="button" className="admin-icon-button" aria-label={sidebarOpen ? 'Скрыть меню' : 'Показать меню'} onClick={() => setSidebarOpen((value) => !value)}><Menu aria-hidden="true" /></button>
            <div><p>NEBO Ops</p><h1>{TITLES[currentTab]}</h1></div>
          </div>

          <form className="admin-global-search" onSubmit={handleGlobalSearchSubmit} role="search">
            <Search aria-hidden="true" />
            <label htmlFor="admin-global-search" className="sr-only">Найти пользователя по ID</label>
            <input id="admin-global-search" name="userId" type="search" placeholder="ID пользователя" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} />
            <span>Enter</span>
          </form>

          <div className="admin-topbar-actions">
            <div className="admin-environment"><span />Production</div>
            <button type="button" className="admin-icon-button" title="На весь экран" aria-label="На весь экран" onClick={toggleFullscreen}>{fullWidth ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>
          </div>
        </header>

        <main className="admin-main" tabIndex={-1}>
          <div className={fullWidth ? 'admin-content is-fluid' : 'admin-content'}>
            {currentTab === 'dashboard' && <DashboardSection onSelectUser={handleSelectUser} onNavigate={(tab) => handleSelectTab(tab as AdminTab)} />}
            {currentTab === 'users' && <UsersSection me={me} initialUserId={targetUserId || undefined} />}
            {currentTab === 'events' && <EventsSection onSelectUser={handleSelectUser} />}
            {currentTab === 'ai' && <AiSection />}
            {currentTab === 'errors' && <ErrorsSection />}
            {currentTab === 'analytics' && <AnalyticsSection />}
            {currentTab === 'billing' && <BillingSection onSelectUser={handleSelectUser} />}
            {currentTab === 'charts' && <ChartsSection onSelectUser={handleSelectUser} />}
            {currentTab === 'content' && <ContentSection me={me} onSelectUser={handleSelectUser} />}
            {currentTab === 'comms' && <CommsSection onSelectUser={handleSelectUser} />}
            {currentTab === 'system' && <SystemSection me={me} onSelectUser={handleSelectUser} />}
          </div>
        </main>
      </div>
    </div>
  );
};
