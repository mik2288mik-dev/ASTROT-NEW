import React, { useMemo, useState } from 'react';
import { type AdminUserSegment, type AdminUsersOverview, type UserProfile } from '../types';
import { NotificationsManager } from '../components/Admin/Notifications/NotificationsManager';
import { AdminAiSettingsTab } from './admin/AdminAiSettingsTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminChipButton, AdminPanelShell, AdminSectionHeader, AdminStatChip, AdminSurface } from './admin/AdminPrimitives';
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

const SECTION_IDS: AdminSection[] = ['users', 'ai', 'cms', 'send', 'templates', 'history'];

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

  const sectionLabel = (section: AdminSection) => {
    switch (section) {
      case 'users':
        return getAdminText(lang, 'section_users');
      case 'ai':
        return lang === 'ru' ? 'ИИ' : 'AI';
      case 'cms':
        return lang === 'ru' ? 'Рассылки' : 'Campaigns';
      case 'send':
        return getAdminText(lang, 'section_send');
      case 'templates':
        return getAdminText(lang, 'section_templates');
      case 'history':
      default:
        return getAdminText(lang, 'section_history');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#07111f]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-4">
        <AdminPanelShell>
          <AdminSurface className="sticky top-[calc(env(safe-area-inset-top,0px)+12px)] z-20 px-5 py-5">
            <AdminSectionHeader
              eyebrow="Lumia Admin"
              title={getAdminText(lang, 'panel_title')}
              subtitle={getAdminText(lang, 'panel_subtitle')}
              action={(
                <button
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  {getAdminText(lang, 'close')}
                </button>
              )}
            />

            <div className="scrollbar-hide -mx-2 mt-5 overflow-x-auto px-2">
              <div className="flex min-w-max gap-3">
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
            </div>

            <div className="scrollbar-hide -mx-2 mt-5 overflow-x-auto px-2">
              <div className="flex min-w-max gap-2">
                {SECTION_IDS.map((section) => (
                  <AdminChipButton
                    key={section}
                    active={activeSection === section}
                    onClick={() => setActiveSection(section)}
                  >
                    {sectionLabel(section)}
                  </AdminChipButton>
                ))}
              </div>
            </div>
          </AdminSurface>

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
        </AdminPanelShell>
      </div>
    </div>
  );
};
