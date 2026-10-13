import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CircleDollarSign,
  FileText,
  LifeBuoy,
  LogOut,
  Menu,
  Orbit,
  Route,
  Search,
  Settings2,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getAdminSource, setAdminSource, type AdminMe, type AdminRangeKey, type AdminSource } from '../../services/admin2Service';
import { OverviewSection } from './sections/OverviewSection';
import { PeopleSection } from './sections/PeopleSection';
import { JourneySection } from './sections/JourneySection';
import { QualitySection } from './sections/QualitySection';
import { BillingSection } from './sections/BillingSection';
import { ContentSection } from './sections/ContentSection';
import { StoriesSection } from './sections/StoriesSection';
import { AiSection } from './sections/AiSection';
import { CommsSection } from './sections/CommsSection';
import { ChartsSection } from './sections/ChartsSection';
import { SystemSection } from './sections/SystemSection';

export type AdminSectionKey =
  | 'overview' | 'people' | 'journey' | 'money' | 'quality'
  | 'content' | 'stories' | 'ai' | 'notifications' | 'support' | 'charts' | 'system';

type NavItem = { key: AdminSectionKey; label: string; hint: string; icon: LucideIcon; allowed: (me: AdminMe) => boolean; data?: boolean; range?: boolean };
const has = (perm: string) => (me: AdminMe) => me.permissions.includes(perm);

export const NAV: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Аналитика', items: [
    { key: 'overview', label: 'Обзор', hint: 'Главные цифры и что улучшить', icon: BarChart3, allowed: has('analytics.view'), data: true, range: true },
    { key: 'people', label: 'Люди', hint: 'Каждый человек и вся его история', icon: Users, allowed: has('users.view'), data: true },
    { key: 'journey', label: 'Путь и воронки', hint: 'Где люди теряются, сколько ждут, что читают', icon: Route, allowed: has('analytics.view'), data: true, range: true },
    { key: 'money', label: 'Деньги', hint: 'Оплаты, подписки, тарифы, промокоды', icon: CircleDollarSign, allowed: has('billing.view'), data: true },
    { key: 'quality', label: 'Ошибки и версии', hint: 'Что ломается и у кого старая версия', icon: TriangleAlert, allowed: has('analytics.view'), data: true },
  ] },
  { title: 'Управление', items: [
    { key: 'content', label: 'Контент', hint: 'Карточки главного экрана, тексты, вопросы', icon: FileText, allowed: has('content.view') },
    { key: 'stories', label: 'Рассказы', hint: 'Серии и выпуски рассказов', icon: BookOpen, allowed: has('content.view') },
    { key: 'ai', label: 'ИИ', hint: 'Запросы к ИИ, ошибки и промпты', icon: Bot, allowed: has('ai.view') },
    { key: 'notifications', label: 'Уведомления', hint: 'Пуши в приложении и в Telegram', icon: Bell, allowed: has('push.send') },
    { key: 'support', label: 'Поддержка', hint: 'Обращения людей и ответы', icon: LifeBuoy, allowed: has('support.view'), data: true },
    { key: 'charts', label: 'Натальные карты', hint: 'Проверка расчёта и пересчёт карт', icon: Orbit, allowed: has('charts.view'), data: true },
  ] },
  { title: 'Система', items: [
    { key: 'system', label: 'Доступ и система', hint: 'Роли, журнал действий, настройки, состояние сервера', icon: Settings2,
      allowed: (me) => ['roles.manage', 'settings.manage', 'audit.view'].some((p) => me.permissions.includes(p)) },
  ] },
];
const ALL_ITEMS = NAV.flatMap((group) => group.items);
export const SECTION_KEYS = ALL_ITEMS.map((item) => item.key);

const RANGES: Array<{ value: AdminRangeKey; label: string }> = [
  { value: 'today', label: 'Сегодня' }, { value: 'yesterday', label: 'Вчера' }, { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' }, { value: 'month', label: 'Этот месяц' }, { value: '90d', label: '90 дней' },
];

export function AdminShell({ me, section, range, onNavigate, onRange, onLogout }: {
  me: AdminMe; section: AdminSectionKey; range: AdminRangeKey;
  onNavigate: (section: AdminSectionKey) => void; onRange: (range: AdminRangeKey) => void; onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [source, setSource] = useState<AdminSource>('main');
  const [search, setSearch] = useState('');
  const [personQuery, setPersonQuery] = useState<string | null>(null);
  useEffect(() => { setSource(me.sources.telegram ? getAdminSource() : 'main'); }, [me.sources.telegram]);

  const items = ALL_ITEMS.filter((item) => item.allowed(me));
  const current = items.find((item) => item.key === section) || items[0];
  const go = useCallback((key: AdminSectionKey) => { onNavigate(key); setMenuOpen(false); }, [onNavigate]);
  const openPerson = useCallback((id: string) => { setPersonQuery(id); go('people'); }, [go]);
  const consumeQuery = useCallback(() => setPersonQuery(null), []);
  const changeSource = (next: AdminSource) => { setAdminSource(next); setSource(next); };
  // Only data sections read the Telegram version; tools always work on this server.
  const effectiveSource = current?.data ? source : 'main';
  const sourceKey = `${effectiveSource}`;
  const mainLabel = me.server === 'Timeweb' ? 'RuStore · Timeweb' : me.server;

  if (!current) {
    return <div className="adm-root adm-center"><p>У твоей роли нет доступа ни к одному разделу.</p><button type="button" className="adm-btn" onClick={onLogout}>Выйти</button></div>;
  }

  return (
    <div className="adm-root" data-source={effectiveSource}>
      <button type="button" className={`adm-scrim ${menuOpen ? 'is-open' : ''}`} aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />
      <aside className={`adm-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Разделы админки">
        <div className="adm-brand">
          <span className="adm-logo">NEBO</span><span className="adm-brand-sub">админка</span>
          <button type="button" className="adm-icon adm-nav-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X aria-hidden="true" /></button>
        </div>
        <nav>
          {NAV.map((group) => {
            const visible = group.items.filter((item) => item.allowed(me));
            if (!visible.length) return null;
            return (
              <div key={group.title} className="adm-nav-group">
                <p>{group.title}</p>
                {visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" aria-current={item.key === current.key ? 'page' : undefined} onClick={() => go(item.key)} title={item.hint}>
                      <Icon aria-hidden="true" /><span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="adm-account">
          <div><strong>{me.name || `ID ${me.userId}`}</strong><span>{me.isOwner ? 'владелец' : me.role}</span></div>
          <button type="button" className="adm-icon" title="Выйти" aria-label="Выйти" onClick={onLogout}><LogOut aria-hidden="true" /></button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="adm-icon adm-menu-btn" aria-label="Меню" onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" /></button>
          <div className="adm-title">
            <h1>{current.label}</h1>
            <p>{current.hint}</p>
          </div>
          <form className="adm-top-search" role="search" onSubmit={(e) => { e.preventDefault(); if (search.trim()) { openPerson(search.trim()); setSearch(''); } }}>
            <Search aria-hidden="true" />
            <label htmlFor="adm-top-search" className="sr-only">Найти человека по ID или имени</label>
            <input id="adm-top-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти человека: ID или имя" />
          </form>
        </header>

        {(current.data && me.sources.telegram) || current.range ? (
          <div className="adm-toolbar">
            {current.data && me.sources.telegram ? (
              <div className="adm-source" role="group" aria-label="Чьи данные показать">
                <button type="button" aria-pressed={source === 'main'} onClick={() => changeSource('main')}>{mainLabel}</button>
                <button type="button" aria-pressed={source === 'telegram'} onClick={() => changeSource('telegram')}>Telegram · Railway</button>
              </div>
            ) : null}
            {current.range ? (
              <div className="adm-chips adm-chips--scroll" role="group" aria-label="Период">
                {RANGES.map((r) => <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => onRange(r.value)}>{r.label}</button>)}
              </div>
            ) : null}
          </div>
        ) : null}
        {effectiveSource === 'telegram' ? (
          <p className="adm-source-note"><Activity aria-hidden="true" />Сейчас показаны данные Telegram-версии (сервер Railway). Только просмотр.</p>
        ) : null}

        <main className="adm-content" key={`${current.key}:${sourceKey}`}>
          {current.key === 'overview' && <OverviewSection range={range} source={sourceKey} onNavigate={go} />}
          {current.key === 'people' && <PeopleSection me={me} source={sourceKey} query={personQuery} onQueryConsumed={consumeQuery} />}
          {current.key === 'journey' && <JourneySection range={range} source={sourceKey} onOpenPerson={openPerson} />}
          {current.key === 'money' && <BillingSection onSelectUser={openPerson} />}
          {current.key === 'quality' && <QualitySection source={sourceKey} />}
          {current.key === 'content' && <ContentSection me={me} onSelectUser={openPerson} />}
          {current.key === 'stories' && <StoriesSection canEdit={me.permissions.includes('content.edit')} canPublish={me.permissions.includes('content.publish')} />}
          {current.key === 'ai' && <AiSection />}
          {current.key === 'notifications' && <CommsSection mode="notifications" onSelectUser={openPerson} />}
          {current.key === 'support' && <CommsSection mode="support" onSelectUser={openPerson} />}
          {current.key === 'charts' && <ChartsSection onSelectUser={openPerson} />}
          {current.key === 'system' && <SystemSection me={me} onSelectUser={openPerson} />}
        </main>
      </div>
    </div>
  );
}
