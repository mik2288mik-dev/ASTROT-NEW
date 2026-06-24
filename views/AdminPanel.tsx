import React, { useEffect, useMemo, useState } from 'react';
import { type AdminUserSegment, type AdminUsersOverview, type UserProfile } from '../types';
import { fetchAdminUsers } from '../services/adminService';
import { AdminAnalyticsTab } from './admin/AdminAnalyticsTab';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminSendTab } from './admin/AdminSendTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminButton, AdminStateBanner } from './admin/AdminPrimitives';
import { getAdminText } from './admin/adminText';
import {
  ADMIN_NAV_GROUPS,
  ADMIN_PRIMARY_SECTIONS,
  type AdminBackofficeSection,
  getAdminNavGroup,
  getAdminNavHub,
} from './admin/adminSections';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'chartSlots' | 'loginStreak'>>;

interface AdminPanelProps {
  profile: UserProfile;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onClose: () => void;
}

const EMPTY_OVERVIEW: AdminUsersOverview = {
  totalUsers: 0,
  activePremiumUsers: 0,
  activeUsers7d: 0,
  needAttentionUsers: 0,
  usersWithoutBirthData: 0,
};

const sectionIcon = (section: AdminBackofficeSection) => {
  switch (section) {
    case 'overview':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="4" rx="1.5" />
          <rect x="13" y="11" width="7" height="9" rx="1.5" />
          <rect x="4" y="14" width="7" height="6" rx="1.5" />
        </svg>
      );
    case 'analytics':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20V10M9 20V4M14 20v-6M19 20v-9" strokeLinecap="round" />
          <path d="M3 20h18" strokeLinecap="round" />
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
    case 'send':
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 2L11 13" strokeLinecap="round" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinejoin="round" />
        </svg>
      );
  }
};

const sectionLabel = (lang: 'ru' | 'en', section: AdminBackofficeSection) => {
  const keyMap: Record<AdminBackofficeSection, Parameters<typeof getAdminText>[1]> = {
    overview: 'section_overview',
    analytics: 'section_analytics',
    users: 'section_users',
    send: 'section_send',
  };
  return getAdminText(lang, keyMap[section]);
};

const sectionDescription = (lang: 'ru' | 'en', section: AdminBackofficeSection) => {
  switch (section) {
    case 'overview':
      return lang === 'ru' ? 'Главные цифры и что происходит прямо сейчас.' : 'Key numbers and what is happening right now.';
    case 'analytics':
      return lang === 'ru' ? 'Воронка, активность и где пользователи отваливаются.' : 'Funnel, activity, and where users drop off.';
    case 'users':
      return lang === 'ru' ? 'Поиск, сегменты, Premium, карты и путь по приложению.' : 'Search, segments, Premium, charts, and app journey.';
    case 'send':
    default:
      return lang === 'ru' ? 'Ручная отправка уведомлений и история.' : 'Manual notification sending and history.';
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

  const goSection = (section: AdminBackofficeSection) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const goUsersSegment = (segment: AdminUserSegment) => {
    setUserSegment(segment);
    goSection('users');
  };

  const openSendForUser = (userId: string) => {
    setNotificationTargetUserId(userId);
    setActiveSection('send');
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
        if (!cancelled) setSummaryError(error?.message || null);
      }
    };
    void loadSummary();
    return () => { cancelled = true; };
  }, []);

  const activeGroup = useMemo(() => getAdminNavGroup(activeSection), [activeSection]);
  const activeHub = useMemo(() => getAdminNavHub(activeSection), [activeSection]);
  const hubLabel = lang === 'ru'
    ? (ADMIN_NAV_GROUPS.find((g) => g.id === activeHub)?.labelRu ?? '')
    : (ADMIN_NAV_GROUPS.find((g) => g.id === activeHub)?.labelEn ?? '');

  const premiumShare = overview.totalUsers > 0
    ? Math.round((overview.activePremiumUsers / overview.totalUsers) * 100)
    : 0;

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverviewTab profile={profile} onOpenSection={goSection} onOpenUsersSegment={goUsersSegment} />;
      case 'analytics':
        return <AdminAnalyticsTab profile={profile} onOpenUsers={() => setActiveSection('users')} />;
      case 'users':
        return (
          <AdminUsersTab
            profile={profile}
            segment={userSegment}
            onSegmentChange={setUserSegment}
            onOverviewChange={setOverview}
            onPatchOwnProfile={onPatchOwnProfile}
            onSendNotification={openSendForUser}
          />
        );
      case 'send':
      default:
        return (
          <AdminSendTab
            profile={profile}
            initialTargetUserId={notificationTargetUserId}
            onClearInitialTarget={() => setNotificationTargetUserId('')}
          />
        );
    }
  };

  const breadcrumbHome = lang === 'ru' ? 'Админ' : 'Admin';

  return (
    <div className="admin-app-bg fixed inset-0 z-[60] flex max-h-[100dvh] min-h-0 flex-col overflow-hidden">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
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
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div className="admin-dash-root">
          <aside className="admin-dash-sidebar flex flex-col" data-open={sidebarOpen}>
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
                  onClick={() => setSidebarOpen(false)}
                  aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="admin-dash-sidebar-stats mt-3">
                <div>
                  <span>{getAdminText(lang, 'metric_users')}</span>
                  <strong>{overview.totalUsers}</strong>
                </div>
                <div>
                  <span>{getAdminText(lang, 'metric_premium')}</span>
                  <strong>{premiumShare}%</strong>
                </div>
                <div>
                  <span>{getAdminText(lang, 'metric_active')}</span>
                  <strong>{overview.activeUsers7d}</strong>
                </div>
                <div>
                  <span>{getAdminText(lang, 'metric_no_birth_data')}</span>
                  <strong>{overview.usersWithoutBirthData}</strong>
                </div>
              </div>
            </div>

            {summaryError ? (
              <div className="px-3 py-3">
                <AdminStateBanner tone="info">{summaryError}</AdminStateBanner>
              </div>
            ) : null}

            <nav className="admin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-2 pb-4">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="admin-dash-nav-group">{lang === 'ru' ? group.labelRu : group.labelEn}</p>
                  {group.sections.map((section) => (
                    <NavButton
                      key={section}
                      section={section}
                      active={activeSection === section}
                      lang={lang}
                      onSelect={() => goSection(section)}
                    />
                  ))}
                </div>
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
                  <span className="text-slate-400">{hubLabel}</span>
                </p>
                <h2 className="admin-heading mt-0.5 truncate text-lg text-white sm:text-xl">
                  {sectionLabel(lang, activeSection)}
                </h2>
              </div>

              <AdminButton tone="primary" className="min-h-[2.5rem] text-sm" onClick={onClose}>
                {lang === 'ru' ? 'В приложение' : 'Back to app'}
              </AdminButton>
            </header>

            {activeGroup.sections.length > 1 ? (
              <div className="admin-section-subnav" role="tablist">
                {activeGroup.sections.map((section) => (
                  <button
                    key={section}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === section}
                    data-active={activeSection === section}
                    className="admin-section-subnav-item"
                    onClick={() => goSection(section)}
                  >
                    {sectionLabel(lang, section)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="admin-dash-content admin-scroll">
              <div className="admin-dash-workspace admin-dash-workspace--tool px-3 pb-4 pt-3 sm:px-4 sm:pt-4">
                <p className="admin-section-lead mb-4 text-sm leading-relaxed text-slate-400">
                  {sectionDescription(lang, activeSection)}
                </p>
                <div className="min-w-0 pb-2">{renderSection()}</div>
              </div>
            </div>

            <nav className="admin-dash-bottomnav lg:hidden" aria-label={lang === 'ru' ? 'Разделы админки' : 'Admin sections'}>
              {ADMIN_PRIMARY_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  data-active={activeSection === section}
                  className="admin-dash-bottomnav-item"
                  onClick={() => goSection(section)}
                >
                  <span className="admin-dash-bottomnav-label">{sectionLabel(lang, section)}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};
