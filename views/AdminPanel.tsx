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
import {
  AdminBadge,
  AdminButton,
  AdminPanelShell,
  AdminSectionHeader,
  AdminStatChip,
  AdminStateBanner,
  AdminSurface,
} from './admin/AdminPrimitives';
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
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19h16" strokeLinecap="round" />
          <path d="M7 16V9" strokeLinecap="round" />
          <path d="M12 16V5" strokeLinecap="round" />
          <path d="M17 16v-3" strokeLinecap="round" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M16 19a4 4 0 0 0-8 0" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3.5" />
          <path d="M6 19H4.5a2.5 2.5 0 0 1 0-5H7" strokeLinecap="round" />
          <path d="M18 14h1.5a2.5 2.5 0 0 1 0 5H18" strokeLinecap="round" />
        </svg>
      );
    case 'economy':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M9 9.5c0-1.1 1.34-2 3-2s3 .9 3 2-1.34 2-3 2-3 .9-3 2 1.34 2 3 2 3-.9 3-2" strokeLinecap="round" />
        </svg>
      );
    case 'charts':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17M3.5 12h17M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
      );
    case 'send':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 2L11 13" strokeLinecap="round" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinejoin="round" />
        </svg>
      );
    case 'templates':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4h10l3 3v13H4V4h3Z" strokeLinejoin="round" />
          <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
        </svg>
      );
    case 'history':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12a8 8 0 1 1-2.35-5.65" />
          <path d="M20 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'automation':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 12h12" strokeLinecap="round" />
          <path d="M12 6v12" strokeLinecap="round" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="2.25" />
          <path d="M12 3v3M12 18v3M4.22 7.22l2.12 2.12M17.66 14.66l2.12 2.12M3 12h3M18 12h3M4.22 16.78l2.12-2.12M17.66 9.34l2.12-2.12" strokeLinecap="round" />
        </svg>
      );
    case 'assets':
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
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

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onPatchOwnProfile, onClose }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [activeSection, setActiveSection] = useState<AdminBackofficeSection>('overview');
  const [notificationTargetUserId, setNotificationTargetUserId] = useState<string>('');
  const [userSegment, setUserSegment] = useState<AdminUserSegment>('all');
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

  const summaryChips = useMemo(() => ([
    { id: 'users', label: getAdminText(lang, 'metric_users'), value: overview.totalUsers, section: 'users' as AdminBackofficeSection, segment: 'all' as AdminUserSegment },
    { id: 'premium', label: getAdminText(lang, 'metric_premium'), value: overview.activePremiumUsers, section: 'users' as AdminBackofficeSection, segment: 'premium' as AdminUserSegment },
    { id: 'active', label: getAdminText(lang, 'metric_active'), value: overview.activeUsers7d, section: 'users' as AdminBackofficeSection, segment: 'active_7d' as AdminUserSegment },
    { id: 'attention', label: getAdminText(lang, 'metric_attention'), value: overview.needAttentionUsers, section: 'users' as AdminBackofficeSection, segment: 'need_attention' as AdminUserSegment },
  ]), [lang, overview.activePremiumUsers, overview.activeUsers7d, overview.needAttentionUsers, overview.totalUsers]);

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

  return (
    <div
      className="admin-app-bg fixed inset-0 z-[60] overflow-y-auto admin-scroll"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="mx-auto max-w-[1600px] px-3 pb-5 pt-3 sm:px-4 sm:pb-6 sm:pt-4 xl:px-5">
        <AdminPanelShell>
          <aside className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
            <AdminSurface className="px-4 py-4 sm:px-5 sm:py-5">
              <AdminSectionHeader
                eyebrow="Lumia Admin 2.0"
                title={getAdminText(lang, 'panel_title')}
                subtitle={getAdminText(lang, 'panel_subtitle')}
                action={(
                  <AdminButton tone="secondary" className="min-w-[6rem]" onClick={onClose}>
                    {getAdminText(lang, 'close')}
                  </AdminButton>
                )}
              />

              {summaryError ? (
                <div className="mt-5">
                  <AdminStateBanner tone="info">{summaryError}</AdminStateBanner>
                </div>
              ) : null}

              <div className="mt-6 admin-kpi-grid">
                {summaryChips.map((chip) => (
                  <AdminStatChip
                    key={chip.id}
                    label={chip.label}
                    value={chip.value}
                    active={activeSection === chip.section && userSegment === chip.segment}
                    onClick={() => {
                      setUserSegment(chip.segment);
                      setActiveSection(chip.section);
                    }}
                  />
                ))}
              </div>

              <div className="mt-6">
                <p className="admin-label">{lang === 'ru' ? 'Основные разделы' : 'Primary sections'}</p>
                <div className="admin-nav mt-3">
                  {ADMIN_PRIMARY_SECTIONS.map((section) => (
                    <button
                      key={section}
                      type="button"
                      data-active={activeSection === section}
                      onClick={() => setActiveSection(section)}
                      className="admin-nav-item"
                    >
                      <span className="admin-nav-icon">{sectionIcon(section)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{sectionLabel(lang, section)}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{sectionDescription(lang, section)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="admin-label">{lang === 'ru' ? 'Дополнительно' : 'Additional'}</p>
                  <AdminBadge tone="neutral">{lang === 'ru' ? 'tools' : 'tools'}</AdminBadge>
                </div>
                <div className="admin-nav mt-3">
                  {ADMIN_SECONDARY_SECTIONS.map((section) => (
                    <button
                      key={section}
                      type="button"
                      data-active={activeSection === section}
                      onClick={() => setActiveSection(section)}
                      className="admin-nav-item"
                    >
                      <span className="admin-nav-icon">{sectionIcon(section)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{sectionLabel(lang, section)}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{sectionDescription(lang, section)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </AdminSurface>
          </aside>

          <main className="min-w-0 space-y-5">
            <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="admin-label">{lang === 'ru' ? 'Текущий раздел' : 'Current section'}</p>
                  <h1 className="admin-heading mt-2 text-[28px] leading-tight text-white sm:text-[34px]">
                    {sectionLabel(lang, activeSection)}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                    {sectionDescription(lang, activeSection)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeSection !== 'send' ? (
                    <AdminButton tone="secondary" onClick={() => setActiveSection('send')}>
                      {getAdminText(lang, 'section_send')}
                    </AdminButton>
                  ) : null}
                  {activeSection !== 'automation' ? (
                    <AdminButton tone="secondary" onClick={() => setActiveSection('automation')}>
                      {getAdminText(lang, 'section_automation')}
                    </AdminButton>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {[...ADMIN_PRIMARY_SECTIONS, ...ADMIN_SECONDARY_SECTIONS].map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`inline-flex min-h-[2.5rem] shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      activeSection === section
                        ? 'border-sky-300/35 bg-sky-300 text-[#081523]'
                        : 'border-white/10 bg-white/[0.04] text-slate-200'
                    }`}
                  >
                    <span className="h-4 w-4">{sectionIcon(section)}</span>
                    {sectionLabel(lang, section)}
                  </button>
                ))}
              </div>
            </AdminSurface>

            {renderSection()}
          </main>
        </AdminPanelShell>
      </div>
    </div>
  );
};
