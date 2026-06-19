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
import { AdminBadge, AdminButton, AdminStateBanner, AdminSurface } from './admin/AdminPrimitives';
import { getAdminText } from './admin/adminText';
import {
  ADMIN_NAV_GROUPS,
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

const AdminSubNav: React.FC<{
  lang: 'ru' | 'en';
  sections: AdminBackofficeSection[];
  activeSection: AdminBackofficeSection;
  onSelect: (section: AdminBackofficeSection) => void;
}> = ({ lang, sections, activeSection, onSelect }) => (
  <div className="admin-section-subnav" role="tablist">
    {sections.map((section) => (
      <button
        key={section}
        type="button"
        role="tab"
        aria-selected={activeSection === section}
        data-active={activeSection === section}
        className="admin-section-subnav-item"
        onClick={() => onSelect(section)}
      >
        {sectionLabel(lang, section)}
      </button>
    ))}
  </div>
);

const MissionActionCard: React.FC<{
  title: string;
  body: string;
  meta: string;
  onClick: () => void;
}> = ({ title, body, meta, onClick }) => (
  <button type="button" onClick={onClick} className="admin-mission-action-card">
    <div>
      <p className="admin-mission-action-title">{title}</p>
      <p className="admin-mission-action-body">{body}</p>
    </div>
    <div className="admin-mission-action-footer">
      <span>{meta}</span>
      <span aria-hidden="true">→</span>
    </div>
  </button>
);

const MissionRailButton: React.FC<{
  label: string;
  hint: string;
  onClick: () => void;
}> = ({ label, hint, onClick }) => (
  <button type="button" onClick={onClick} className="admin-mission-link-item">
    <span className="admin-mission-link-title">{label}</span>
    <span className="admin-mission-link-hint">{hint}</span>
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

  const goUsersSegment = (segment: AdminUserSegment) => {
    setUserSegment(segment);
    goSection('users');
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
      {
        id: 'no_birth',
        label: getAdminText(lang, 'metric_no_birth_data'),
        value: overview.usersWithoutBirthData,
        section: 'users' as AdminBackofficeSection,
        segment: 'new_user_no_birth_data' as AdminUserSegment,
      },
    ],
    [
      lang,
      overview.activePremiumUsers,
      overview.activeUsers7d,
      overview.needAttentionUsers,
      overview.usersWithoutBirthData,
      overview.totalUsers,
    ]
  );

  const activeGroup = useMemo(() => getAdminNavGroup(activeSection), [activeSection]);
  const activeHub = useMemo(() => getAdminNavHub(activeSection), [activeSection]);

  const goHub = (hub: typeof activeHub) => {
    const group = ADMIN_NAV_GROUPS.find((entry) => entry.id === hub);
    if (!group) return;
    if (getAdminNavHub(activeSection) === hub) {
      if (group.sections.length > 1) {
        setSidebarOpen(true);
        return;
      }
      goSection(group.sections[0]);
      return;
    }
    goSection(group.sections[0]);
  };

  const hubLabel = (hub: typeof activeHub) => {
    const group = ADMIN_NAV_GROUPS.find((entry) => entry.id === hub);
    if (!group) return '';
    return lang === 'ru' ? group.labelRu : group.labelEn;
  };

  const openSection = (section: AdminBackofficeSection) => {
    setActiveSection(section);
  };

  const premiumShare = overview.totalUsers > 0 ? Math.round((overview.activePremiumUsers / overview.totalUsers) * 100) : 0;

  const missionActions = [
    {
      id: 'users',
      title: lang === 'ru' ? 'Пользователи и сегменты' : 'Users and segments',
      body:
        lang === 'ru'
          ? 'Быстро открыть аудитории, Premium, неактивных и тех, кому нужен фокус.'
          : 'Open audiences, Premium, inactive users, and attention segments fast.',
      meta:
        lang === 'ru'
          ? `${overview.needAttentionUsers} требуют внимания`
          : `${overview.needAttentionUsers} need attention`,
      onClick: () => goUsersSegment('need_attention'),
    },
    {
      id: 'send',
      title: lang === 'ru' ? 'Рассылки и кампании' : 'Sends and campaigns',
      body:
        lang === 'ru'
          ? 'Перейти к ручным пушам, шаблонам и истории отправок без лишних шагов.'
          : 'Jump into manual pushes, templates, and delivery history.',
      meta: lang === 'ru' ? 'Центр коммуникаций' : 'Comms hub',
      onClick: () => goSection('send'),
    },
    {
      id: 'automation',
      title: lang === 'ru' ? 'Авто-сценарии' : 'Automation',
      body:
        lang === 'ru'
          ? 'Утро, день, вечер и промо управляются из одного контура.'
          : 'Morning, day, evening, and promo flows in one place.',
      meta: lang === 'ru' ? 'Daily control' : 'Daily control',
      onClick: () => goSection('automation'),
    },
    {
      id: 'economy',
      title: lang === 'ru' ? 'Экономика и Premium' : 'Economy and Premium',
      body:
        lang === 'ru'
          ? 'Проверить Premium, Stars-платежи и монетизацию без переходов по кругу.'
          : 'Review Premium, Stars payments, and monetization without extra hops.',
      meta: lang === 'ru' ? `${overview.activePremiumUsers} Premium` : `${overview.activePremiumUsers} Premium`,
      onClick: () => goSection('economy'),
    },
  ];

  const railActions = [
    {
      id: 'focus',
      label: lang === 'ru' ? 'Нужно внимание' : 'Need attention',
      hint: lang === 'ru' ? 'Users · проблемные сегменты' : 'Users · problem segments',
      onClick: () => goUsersSegment('need_attention'),
    },
    {
      id: 'premium',
      label: lang === 'ru' ? 'Premium-аудитория' : 'Premium audience',
      hint: lang === 'ru' ? 'Users · платящие' : 'Users · paying',
      onClick: () => goUsersSegment('premium'),
    },
    {
      id: 'send',
      label: lang === 'ru' ? 'Запустить рассылку' : 'Launch send',
      hint: lang === 'ru' ? 'Comms · ручной запуск' : 'Comms · manual launch',
      onClick: () => goSection('send'),
    },
    {
      id: 'templates',
      label: lang === 'ru' ? 'Шаблоны и креативы' : 'Templates and creative',
      hint: lang === 'ru' ? 'Notifications · library' : 'Notifications · library',
      onClick: () => goSection('templates'),
    },
    {
      id: 'automation',
      label: lang === 'ru' ? 'Сценарии дня' : 'Day scenarios',
      hint: lang === 'ru' ? 'Automation · morning/day/evening' : 'Automation · morning/day/evening',
      onClick: () => goSection('automation'),
    },
    {
      id: 'assets',
      label: lang === 'ru' ? 'Визуалы и ассеты' : 'Visuals and assets',
      hint: lang === 'ru' ? 'Media · карточки и изображения' : 'Media · cards and uploads',
      onClick: () => goSection('assets'),
    },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverviewTab profile={profile} onOpenSection={openSection} onOpenUsersSegment={goUsersSegment} />;
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
          onClick={closeSidebar}
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
                onClick={closeSidebar}
                aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{getAdminText(lang, 'panel_subtitle')}</p>
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
                <span>{getAdminText(lang, 'metric_attention')}</span>
                <strong>{overview.needAttentionUsers}</strong>
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
                <span className="text-slate-400">{hubLabel(activeHub)}</span>
                {activeSection !== 'overview' ? (
                  <>
                    <span className="mx-1.5 text-slate-600">/</span>
                    <span className="font-medium text-cyan-200/90">{sectionLabel(lang, activeSection)}</span>
                  </>
                ) : null}
              </p>
              <h2 className="admin-heading mt-0.5 truncate text-lg text-white sm:text-xl">
                {sectionLabel(lang, activeSection)}
              </h2>
              <p className="mt-1 hidden text-xs leading-relaxed text-slate-500 sm:block lg:hidden">
                {sectionDescription(lang, activeSection)}
              </p>
            </div>

            <div className="hidden items-center gap-2 xl:flex">
              <AdminBadge tone="neutral">{sectionDescription(lang, activeSection)}</AdminBadge>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {activeSection !== 'send' ? (
                <AdminButton tone="ghost" className="hidden min-h-[2.5rem] text-xs sm:inline-flex" onClick={() => goSection('send')}>
                  {getAdminText(lang, 'section_send')}
                </AdminButton>
              ) : null}
              <AdminButton tone="primary" className="min-h-[2.5rem] text-sm" onClick={onClose}>
                {lang === 'ru' ? 'В приложение' : 'Back to app'}
              </AdminButton>
            </div>
          </header>

          {activeGroup.sections.length > 1 ? (
            <AdminSubNav
              lang={lang}
              sections={activeGroup.sections}
              activeSection={activeSection}
              onSelect={goSection}
            />
          ) : null}

          <div className="admin-dash-content admin-scroll">
            {activeSection === 'overview' ? (
              <div className="admin-dash-workspace">
                <AdminSurface className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="admin-mission-hero-grid">
                    <div className="min-w-0">
                      <p className="admin-label">{lang === 'ru' ? 'Сводка' : 'Summary'}</p>
                      <h2 className="admin-heading mt-2 text-2xl leading-tight text-white sm:text-3xl">
                        {lang === 'ru' ? 'Панель управления Lumia' : 'Lumia control panel'}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                        {getAdminText(lang, 'overview_subtitle')}
                      </p>
                    </div>

                    <div className="admin-mission-summary-grid">
                      <div className="admin-mission-summary-card">
                        <span>{lang === 'ru' ? 'Premium share' : 'Premium share'}</span>
                        <strong>{premiumShare}%</strong>
                        <small>
                          {overview.activePremiumUsers}/{Math.max(overview.totalUsers, 1)} {lang === 'ru' ? 'пользователей' : 'users'}
                        </small>
                      </div>
                      <div className="admin-mission-summary-card">
                        <span>{lang === 'ru' ? 'Active 7d' : 'Active 7d'}</span>
                        <strong>{overview.activeUsers7d}</strong>
                        <small>{lang === 'ru' ? 'активных за неделю' : 'active this week'}</small>
                      </div>
                      <div className="admin-mission-summary-card">
                        <span>{lang === 'ru' ? 'Attention' : 'Attention'}</span>
                        <strong>{overview.needAttentionUsers}</strong>
                        <small>{lang === 'ru' ? 'требуют фокуса' : 'need focus'}</small>
                      </div>
                    </div>
                  </div>

                  <div className="admin-mission-actions mt-4">
                    {missionActions.map((action) => (
                      <MissionActionCard
                        key={action.id}
                        title={action.title}
                        body={action.body}
                        meta={action.meta}
                        onClick={action.onClick}
                      />
                    ))}
                  </div>
                </AdminSurface>

                <div className="admin-mission-layout">
                  <div className="min-w-0">
                    <div className="admin-dash-kpi-row mb-5 mt-5">
                      {summaryChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          className="admin-dash-kpi-card text-left"
                          onClick={() => {
                            setUserSegment(chip.segment);
                            goSection('users');
                          }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{chip.label}</p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{chip.value}</p>
                        </button>
                      ))}
                    </div>

                    <div className="min-w-0 pb-2">{renderSection()}</div>
                  </div>

                  <aside className="admin-mission-rail hidden xl:block">
                    <div className="admin-mission-rail-sticky">
                      <AdminSurface className="px-4 py-4">
                        <p className="admin-label">{lang === 'ru' ? 'Быстрые маршруты' : 'Fast lanes'}</p>
                        <div className="admin-mission-link-list mt-4">
                          {railActions.map((action) => (
                            <MissionRailButton
                              key={action.id}
                              label={action.label}
                              hint={action.hint}
                              onClick={action.onClick}
                            />
                          ))}
                        </div>
                      </AdminSurface>
                    </div>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="admin-dash-workspace admin-dash-workspace--tool px-3 pb-4 pt-3 sm:px-4 sm:pt-4">
                <p className="admin-section-lead mb-4 text-sm leading-relaxed text-slate-400">
                  {sectionDescription(lang, activeSection)}
                </p>
                <div className="min-w-0 pb-2">{renderSection()}</div>
              </div>
            )}
          </div>

          <nav className="admin-dash-bottomnav lg:hidden" aria-label={lang === 'ru' ? 'Разделы админки' : 'Admin sections'}>
            {ADMIN_NAV_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                data-active={activeHub === group.id}
                className="admin-dash-bottomnav-item"
                onClick={() => goHub(group.id)}
              >
                <span className="admin-dash-bottomnav-label">{lang === 'ru' ? group.labelRu : group.labelEn}</span>
                <span className="admin-dash-bottomnav-hint">
                  {group.sections.length === 1
                    ? sectionLabel(lang, group.sections[0])
                    : activeHub === group.id
                    ? sectionLabel(lang, activeSection)
                    : `${group.sections.length} ${lang === 'ru' ? 'раздела' : 'sections'}`}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      </div>
    </div>
  );
};
