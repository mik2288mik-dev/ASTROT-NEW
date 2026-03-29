import React, { useEffect, useMemo, useState } from 'react';
import { type AdminUserSegment, type AdminUsersOverview, type UserProfile } from '../types';
import { fetchAdminUsers } from '../services/adminService';
import { AdminAiSettingsTab } from './admin/AdminAiSettingsTab';
import { AdminAssetsTab } from './admin/AdminAssetsTab';
import { AdminAutomationTab } from './admin/AdminAutomationTab';
import { AdminChartsTab } from './admin/AdminChartsTab';
import { AdminEconomyTab } from './admin/AdminEconomyTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminButton, AdminStateBanner } from './admin/AdminPrimitives';
import { getAdminText } from './admin/adminText';
import {
  ADMIN_PRIMARY_SECTIONS,
  ADMIN_SECONDARY_SECTIONS,
  type AdminBackofficeSection,
} from './admin/adminSections';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;

interface AdminPanelProps {
  profile: UserProfile;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onClose: () => void;
}

const EMPTY_OVERVIEW: AdminUsersOverview = {
  totalUsers: 0,
  activePremiumUsers: 0,
  totalLumiBalance: 0,
  activeUsers7d: 0,
  needAttentionUsers: 0,
};

const sectionIcon = (section: AdminBackofficeSection) => {
  switch (section) {
    case 'overview':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19h16" strokeLinecap="round" />
          <path d="M7 16V9" strokeLinecap="round" />
          <path d="M12 16V5" strokeLinecap="round" />
          <path d="M17 16v-3" strokeLinecap="round" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M16 19a4 4 0 0 0-8 0" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3.5" />
          <path d="M6 19H4.5a2.5 2.5 0 0 1 0-5H7" strokeLinecap="round" />
          <path d="M18 14h1.5a2.5 2.5 0 0 1 0 5H18" strokeLinecap="round" />
        </svg>
      );
    case 'economy':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path
            d="M12 7v10M9 9.5c0-1.1 1.34-2 3-2s3 .9 3 2-1.34 2-3 2-3 .9-3 2 1.34 2 3 2 3-.9 3-2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'charts':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17M3.5 12h17M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
      );
    case 'send':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 2L11 13" strokeLinecap="round" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinejoin="round" />
        </svg>
      );
    case 'templates':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4h10l3 3v13H4V4h3Z" strokeLinejoin="round" />
          <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
        </svg>
      );
    case 'history':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12a8 8 0 1 1-2.35-5.65" />
          <path d="M20 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'automation':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 12h12" strokeLinecap="round" />
          <path d="M12 6v12" strokeLinecap="round" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="2.25" />
          <path
            d="M12 3v3M12 18v3M4.22 7.22l2.12 2.12M17.66 14.66l2.12 2.12M3 12h3M18 12h3M4.22 16.78l2.12-2.12M17.66 9.34l2.12-2.12"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'assets':
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M8.5 10.5l2 2 2.5-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="9" r="1" />
        </svg>
      );
  }
};

const sectionLabel = (lang: 'ru' | 'en', section: AdminBackofficeSection) => {
  const keyMap: Record<AdminBackofficeSection, Parameters<typeof getAdminText>[1]> = {
    overview: 'section_overview',
    users: 'section_users',
    economy: 'section_economy',
    charts: 'section_charts',
    send: 'section_send',
    templates: 'section_templates',
    history: 'section_history',
    automation: 'section_automation',
    ai: 'section_ai',
    assets: 'section_assets',
  };
  return getAdminText(lang, keyMap[section]);
};

const sectionDescription = (lang: 'ru' | 'en', section: AdminBackofficeSection) => {
  switch (section) {
    case 'overview':
      return lang === 'ru' ? 'Сводка по продукту и быстрые переходы.' : 'Product summary and quick actions.';
    case 'users':
      return lang === 'ru' ? 'Поиск, сегменты, Premium, Lumi и активность.' : 'Search, segments, Premium, Lumi, and activity.';
    case 'economy':
      return lang === 'ru' ? 'Баланс Lumi, Stars и денежные действия.' : 'Lumi balance, Stars, and economy actions.';
    case 'charts':
      return lang === 'ru' ? 'Слоты, сохранённые карты и primary chart.' : 'Slots, saved charts, and primary chart.';
    case 'send':
      return lang === 'ru' ? 'Личные и массовые отправки с картинкой.' : 'Personal and broadcast sends with images.';
    case 'templates':
      return lang === 'ru' ? 'Готовые шаблоны и reusable тексты.' : 'Ready-made templates and reusable text.';
    case 'history':
      return lang === 'ru' ? 'История кампаний и ошибки доставки.' : 'Campaign history and delivery failures.';
    case 'automation':
      return lang === 'ru' ? 'Простой мастер плюс advanced automation.' : 'Simple wizard plus advanced automation.';
    case 'ai':
      return lang === 'ru' ? 'Активная модель интерпретаций Lumia.' : 'Current Lumia interpretation model.';
    case 'assets':
    default:
      return lang === 'ru' ? 'Картинки для уведомлений и медиатека.' : 'Notification images and media library.';
  }
};

const NavButton: React.FC<{
  section: AdminBackofficeSection;
  active: boolean;
  lang: 'ru' | 'en';
  onSelect: () => void;
}> = ({ section, active, lang, onSelect }) => (
  <button type="button" data-active={active} onClick={onSelect} className="admin-dash-nav-item">
    <span className="admin-dash-nav-icon">{sectionIcon(section)}</span>
    <span className="min-w-0 truncate">{sectionLabel(lang, section)}</span>
  </button>
);

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onPatchOwnProfile, onClose }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [activeSection, setActiveSection] = useState<AdminBackofficeSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationTargetUserId, setNotificationTargetUserId] = useState<string>('');
  const [userSegment, setUserSegment] = useState<AdminUserSegment>('all');
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const closeSidebar = () => setSidebarOpen(false);

  const goSection = (section: AdminBackofficeSection) => {
    setActiveSection(section);
    closeSidebar();
  };

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const payload = await fetchAdminUsers({ page: 1, pageSize: 1 });
        if (!cancelled) {
          setOverview(payload.overview);
          setSummaryError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setSummaryError(error?.message || null);
        }
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryChips = useMemo(
    () => [
      {
        id: 'users',
        label: getAdminText(lang, 'metric_users'),
        value: overview.totalUsers,
        section: 'users' as AdminBackofficeSection,
        segment: 'all' as AdminUserSegment,
      },
      {
        id: 'premium',
        label: getAdminText(lang, 'metric_premium'),
        value: overview.activePremiumUsers,
        section: 'users' as AdminBackofficeSection,
        segment: 'premium' as AdminUserSegment,
      },
      {
        id: 'active',
        label: getAdminText(lang, 'metric_active'),
        value: overview.activeUsers7d,
        section: 'users' as AdminBackofficeSection,
        segment: 'active_7d' as AdminUserSegment,
      },
      {
        id: 'attention',
        label: getAdminText(lang, 'metric_attention'),
        value: overview.needAttentionUsers,
        section: 'users' as AdminBackofficeSection,
        segment: 'need_attention' as AdminUserSegment,
      },
    ],
    [
      lang,
      overview.activePremiumUsers,
      overview.activeUsers7d,
      overview.needAttentionUsers,
      overview.totalUsers,
    ]
  );

  const openSection = (section: AdminBackofficeSection) => {
    setActiveSection(section);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverviewTab profile={profile} onOpenSection={openSection} />;
      case 'users':
        return (
          <AdminUsersTab
            profile={profile}
            segment={userSegment}
            onSegmentChange={setUserSegment}
            onOverviewChange={setOverview}
            onPatchOwnProfile={onPatchOwnProfile}
            onSendNotification={(userId) => {
              setNotificationTargetUserId(userId);
              setActiveSection('send');
            }}
          />
        );
      case 'economy':
        return (
          <AdminEconomyTab
            profile={profile}
            onPatchOwnProfile={onPatchOwnProfile}
            onSendNotification={(userId) => {
              setNotificationTargetUserId(userId);
              setActiveSection('send');
            }}
          />
        );
      case 'charts':
        return <AdminChartsTab profile={profile} onOpenUsers={() => setActiveSection('users')} />;
      case 'send':
      case 'templates':
      case 'history':
        return (
          <AdminNotificationsTab
            profile={profile}
            section={activeSection}
            initialTargetUserId={notificationTargetUserId}
            onClearInitialTarget={() => setNotificationTargetUserId('')}
            onChangeSection={(section) => setActiveSection(section)}
          />
        );
      case 'automation':
        return <AdminAutomationTab profile={profile} />;
      case 'ai':
        return <AdminAiSettingsTab profile={profile} />;
      case 'assets':
        return <AdminAssetsTab profile={profile} />;
      default:
        return null;
    }
  };

  const breadcrumbHome = lang === 'ru' ? 'Админ' : 'Admin';

  return (
    <div
      className="admin-app-bg fixed inset-0 z-[60] admin-scroll"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {sidebarOpen ? (
        <button
          type="button"
          className="admin-dash-backdrop lg:hidden"
          aria-label={lang === 'ru' ? 'Закрыть меню' : 'Close menu'}
          onClick={closeSidebar}
        />
      ) : null}

      <div className="admin-dash-root">
        <aside className="admin-dash-sidebar admin-scroll" data-open={sidebarOpen}>
          <div className="flex flex-col border-b border-white/[0.06] px-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Lumia</p>
                <h1 className="admin-heading mt-0.5 truncate text-lg text-white">
                  {getAdminText(lang, 'panel_title')}
                </h1>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 lg:hidden"
                onClick={closeSidebar}
                aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{getAdminText(lang, 'panel_subtitle')}</p>
          </div>

          {summaryError ? (
            <div className="px-3 py-3">
              <AdminStateBanner tone="info">{summaryError}</AdminStateBanner>
            </div>
          ) : null}

          <nav className="flex-1 overflow-y-auto py-2 pb-6">
            <p className="admin-dash-nav-group">{lang === 'ru' ? 'Разделы' : 'Sections'}</p>
            {ADMIN_PRIMARY_SECTIONS.map((section) => (
              <NavButton
                key={section}
                section={section}
                active={activeSection === section}
                lang={lang}
                onSelect={() => goSection(section)}
              />
            ))}
            <p className="admin-dash-nav-group">{lang === 'ru' ? 'Инструменты' : 'Tools'}</p>
            {ADMIN_SECONDARY_SECTIONS.map((section) => (
              <NavButton
                key={section}
                section={section}
                active={activeSection === section}
                lang={lang}
                onSelect={() => goSection(section)}
              />
            ))}
          </nav>

          <div className="mt-auto border-t border-white/[0.06] p-3">
            <AdminButton tone="secondary" className="w-full justify-center" onClick={onClose}>
              {getAdminText(lang, 'close')}
            </AdminButton>
          </div>
        </aside>

        <div className="admin-dash-main">
          <header className="admin-dash-topbar">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label={lang === 'ru' ? 'Меню' : 'Menu'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-500">
                <span className="text-slate-400">{breadcrumbHome}</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span className="font-medium text-cyan-200/90">{sectionLabel(lang, activeSection)}</span>
              </p>
              <h2 className="admin-heading mt-0.5 truncate text-xl text-white sm:text-2xl">
                {sectionLabel(lang, activeSection)}
              </h2>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {activeSection !== 'send' ? (
                <AdminButton tone="ghost" className="min-h-[2.5rem] text-xs" onClick={() => setActiveSection('send')}>
                  {getAdminText(lang, 'section_send')}
                </AdminButton>
              ) : null}
              <AdminButton tone="primary" className="min-h-[2.5rem]" onClick={onClose}>
                {lang === 'ru' ? 'В приложение' : 'Back to app'}
              </AdminButton>
            </div>
          </header>

          <div className="admin-dash-content">
            <p className="mb-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              {sectionDescription(lang, activeSection)}
            </p>

            <div className="admin-dash-kpi-row">
              {summaryChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  data-active={activeSection === 'users' && userSegment === chip.segment}
                  className="admin-dash-kpi-card"
                  onClick={() => {
                    setUserSegment(chip.segment);
                    setActiveSection('users');
                    closeSidebar();
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{chip.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{chip.value}</p>
                </button>
              ))}
            </div>

            <div className="min-w-0">{renderSection()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
