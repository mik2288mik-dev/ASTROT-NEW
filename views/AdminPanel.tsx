import React, { useMemo, useState } from 'react';
import { type AdminUserSegment, type AdminUsersOverview, type UserProfile } from '../types';
import { NotificationsManager } from '../components/Admin/Notifications/NotificationsManager';
import { AdminAiSettingsTab } from './admin/AdminAiSettingsTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import {
  AdminBadge,
  AdminButton,
  AdminPanelShell,
  AdminSectionHeader,
  AdminStatChip,
  AdminSurface,
} from './admin/AdminPrimitives';
import { getAdminText } from './admin/adminText';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;
type AdminSection = 'users' | 'ai' | 'cms' | 'send' | 'templates' | 'history';

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

const PRIMARY_SECTIONS: AdminSection[] = ['users', 'send', 'templates', 'history'];
const SECONDARY_SECTIONS: AdminSection[] = ['ai', 'cms'];

const sectionIcon = (section: AdminSection) => {
  switch (section) {
    case 'users':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M16 19a4 4 0 0 0-8 0" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3.5" />
          <path d="M6 19H4.5a2.5 2.5 0 0 1 0-5H7" strokeLinecap="round" />
          <path d="M18 14h1.5a2.5 2.5 0 0 1 0 5H18" strokeLinecap="round" />
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
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="2.25" />
          <path d="M12 3v3M12 18v3M4.22 7.22l2.12 2.12M17.66 14.66l2.12 2.12M3 12h3M18 12h3M4.22 16.78l2.12-2.12M17.66 9.34l2.12-2.12" strokeLinecap="round" />
        </svg>
      );
    case 'cms':
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 7.5h14M7 3.5h10v16H7z" strokeLinejoin="round" />
          <path d="M9.5 12h5M9.5 15.5h5" strokeLinecap="round" />
        </svg>
      );
  }
};

const sectionLabel = (lang: 'ru' | 'en', section: AdminSection) => {
  switch (section) {
    case 'users':
      return getAdminText(lang, 'section_users');
    case 'send':
      return getAdminText(lang, 'section_send');
    case 'templates':
      return getAdminText(lang, 'section_templates');
    case 'history':
      return getAdminText(lang, 'section_history');
    case 'ai':
      return lang === 'ru' ? 'ИИ-модель' : 'AI model';
    case 'cms':
    default:
      return lang === 'ru' ? 'Автоматизация' : 'Automation';
  }
};

const sectionDescription = (lang: 'ru' | 'en', section: AdminSection) => {
  switch (section) {
    case 'users':
      return lang === 'ru' ? 'Пользователи, Premium, Lumi и активность.' : 'Users, Premium, Lumi, and activity.';
    case 'send':
      return lang === 'ru' ? 'Личные и массовые сообщения без лишних шагов.' : 'Personal and broadcast messages without extra steps.';
    case 'templates':
      return lang === 'ru' ? 'Повторяемые сценарии и готовые тексты.' : 'Reusable scenarios and ready-made message blocks.';
    case 'history':
      return lang === 'ru' ? 'Статусы кампаний, доставки и ошибки.' : 'Campaign status, deliveries, and failures.';
    case 'ai':
      return lang === 'ru' ? 'Текущая модель интерпретаций и её настройка.' : 'Current interpretation model and its configuration.';
    case 'cms':
    default:
      return lang === 'ru' ? 'Продвинутые шаблоны, слоты и медиатека.' : 'Advanced templates, slots, and media.';
  }
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onPatchOwnProfile, onClose }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [activeSection, setActiveSection] = useState<AdminSection>('users');
  const [notificationTargetUserId, setNotificationTargetUserId] = useState<string>('');
  const [userSegment, setUserSegment] = useState<AdminUserSegment>('all');
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);

  const summaryChips = useMemo(() => ([
    { id: 'users', label: getAdminText(lang, 'metric_users'), value: overview.totalUsers, segment: 'all' as AdminUserSegment },
    { id: 'premium', label: getAdminText(lang, 'metric_premium'), value: overview.activePremiumUsers, segment: 'premium' as AdminUserSegment },
    { id: 'active', label: getAdminText(lang, 'metric_active'), value: overview.activeUsers7d, segment: 'active_7d' as AdminUserSegment },
    { id: 'attention', label: getAdminText(lang, 'metric_attention'), value: overview.needAttentionUsers, segment: 'need_attention' as AdminUserSegment },
  ]), [lang, overview.activePremiumUsers, overview.activeUsers7d, overview.needAttentionUsers, overview.totalUsers]);

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
      <div className="mx-auto max-w-[1480px] px-3 pb-5 pt-3 sm:px-4 sm:pb-6 sm:pt-4 lg:px-5">
        <AdminPanelShell>
          <aside className="xl:sticky xl:top-4">
            <AdminSurface className="px-4 py-4 sm:px-5 sm:py-5">
              <AdminSectionHeader
                eyebrow="Lumia Admin"
                title={getAdminText(lang, 'panel_title')}
                subtitle={getAdminText(lang, 'panel_subtitle')}
                action={(
                  <AdminButton tone="secondary" className="min-w-[6rem]" onClick={onClose}>
                    {getAdminText(lang, 'close')}
                  </AdminButton>
                )}
              />

              <div className="mt-6 admin-kpi-grid">
                {summaryChips.map((chip) => (
                  <AdminStatChip
                    key={chip.id}
                    label={chip.label}
                    value={chip.value}
                    active={activeSection === 'users' && userSegment === chip.segment}
                    onClick={() => {
                      setActiveSection('users');
                      setUserSegment(chip.segment);
                    }}
                  />
                ))}
              </div>

              <div className="mt-6">
                <p className="admin-label">{lang === 'ru' ? 'Основные разделы' : 'Core sections'}</p>
                <div className="admin-nav mt-3">
                  {PRIMARY_SECTIONS.map((section) => (
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
                  <p className="admin-label">{lang === 'ru' ? 'Инструменты' : 'Tools'}</p>
                  <AdminBadge tone="neutral">{lang === 'ru' ? 'advanced' : 'advanced'}</AdminBadge>
                </div>
                <div className="admin-nav mt-3">
                  {SECONDARY_SECTIONS.map((section) => (
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
            {activeSection === 'users' ? (
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
            ) : null}

            {activeSection === 'ai' ? <AdminAiSettingsTab profile={profile} /> : null}

            {activeSection === 'cms' ? <NotificationsManager profile={profile} /> : null}

            {activeSection === 'send' || activeSection === 'templates' || activeSection === 'history' ? (
              <AdminNotificationsTab
                profile={profile}
                section={activeSection}
                initialTargetUserId={notificationTargetUserId}
                onClearInitialTarget={() => setNotificationTargetUserId('')}
                onChangeSection={setActiveSection}
              />
            ) : null}
          </main>
        </AdminPanelShell>
      </div>
    </div>
  );
};
