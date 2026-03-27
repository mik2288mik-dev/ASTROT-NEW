import React, { useMemo, useState } from 'react';
import { type AdminUserSegment, type AdminUsersOverview, type UserProfile } from '../types';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminAiSettingsTab } from './admin/AdminAiSettingsTab';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;
type AdminSection = 'users' | 'ai' | 'send' | 'templates' | 'history';

interface AdminPanelProps {
  profile: UserProfile;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onClose: () => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

const ADMIN_SECTIONS: Array<{ id: AdminSection; title: { ru: string; en: string } }> = [
  { id: 'users', title: { ru: 'Пользователи', en: 'Users' } },
  { id: 'ai', title: { ru: 'AI', en: 'AI' } },
  { id: 'send', title: { ru: 'Отправка', en: 'Send' } },
  { id: 'templates', title: { ru: 'Шаблоны', en: 'Templates' } },
  { id: 'history', title: { ru: 'История', en: 'History' } },
];

const EMPTY_OVERVIEW: AdminUsersOverview = {
  totalUsers: 0,
  activePremiumUsers: 0,
  totalLumiBalance: 0,
  activeUsers7d: 0,
  needAttentionUsers: 0,
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onPatchOwnProfile, onClose }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [activeSection, setActiveSection] = useState<AdminSection>('users');
  const [notificationTargetUserId, setNotificationTargetUserId] = useState<string>('');
  const [userSegment, setUserSegment] = useState<AdminUserSegment>('all');
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);

  const summaryChips = useMemo(() => ([
    {
      id: 'premium',
      label: T(lang, 'Premium', 'Premium'),
      value: overview.activePremiumUsers,
      segment: 'premium' as AdminUserSegment,
    },
    {
      id: 'users',
      label: T(lang, 'Пользователи', 'Users'),
      value: overview.totalUsers,
      segment: 'all' as AdminUserSegment,
    },
    {
      id: 'lumi',
      label: 'Lumi',
      value: overview.totalLumiBalance,
      segment: 'need_attention' as AdminUserSegment,
    },
    {
      id: 'active',
      label: T(lang, 'Активны 7д', 'Active 7d'),
      value: overview.activeUsers7d,
      segment: 'active_7d' as AdminUserSegment,
    },
  ]), [lang, overview.activePremiumUsers, overview.activeUsers7d, overview.totalLumiBalance, overview.totalUsers]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-astro-bg"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div
        className="sticky top-0 z-10 border-b border-astro-border bg-astro-card/95 px-4 py-5 shadow-md backdrop-blur"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-astro-text">Admin Panel</h2>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-astro-subtext">
              {T(lang, 'Owner / admin access only', 'Owner / admin access only')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-astro-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-astro-text transition-colors hover:border-astro-highlight/40"
          >
            {T(lang, 'Закрыть', 'Close')}
          </button>
        </div>

        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
          <div className="mb-3 flex min-w-max gap-2">
            {summaryChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => {
                  setActiveSection('users');
                  setUserSegment(chip.segment);
                }}
                className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                  activeSection === 'users' && userSegment === chip.segment
                    ? 'border-astro-highlight/50 bg-astro-highlight/10'
                    : 'border-astro-border bg-astro-bg/30 hover:border-astro-highlight/30'
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest text-astro-subtext">{chip.label}</p>
                <p className="mt-1 text-sm font-semibold text-astro-text">{chip.value}</p>
              </button>
            ))}
          </div>

          <div className="flex min-w-max gap-2">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  activeSection === section.id
                    ? 'bg-astro-highlight text-white'
                    : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
                }`}
              >
                {section.title[lang]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 p-4">
        {activeSection === 'ai' ? (
          <AdminAiSettingsTab profile={profile} />
        ) : activeSection === 'users' ? (
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
        ) : (
          <AdminNotificationsTab
            profile={profile}
            section={activeSection}
            initialTargetUserId={notificationTargetUserId}
            onClearInitialTarget={() => setNotificationTargetUserId('')}
            onChangeSection={setActiveSection}
          />
        )}
      </div>
    </div>
  );
};
