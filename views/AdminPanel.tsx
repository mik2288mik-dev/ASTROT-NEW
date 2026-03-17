import React, { useState } from 'react';
import { type UserProfile } from '../types';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;

interface AdminPanelProps {
  profile: UserProfile;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onClose: () => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onPatchOwnProfile, onClose }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [activeTab, setActiveTab] = useState<'users' | 'notifications'>('users');
  const [notificationTargetUserId, setNotificationTargetUserId] = useState<string>('');

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
        className="sticky top-0 z-10 border-b border-astro-border bg-astro-card px-4 py-5 shadow-md"
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

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              activeTab === 'users'
                ? 'bg-astro-highlight text-white'
                : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
            }`}
          >
            {T(lang, 'Пользователи', 'Users')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              activeTab === 'notifications'
                ? 'bg-astro-highlight text-white'
                : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
            }`}
          >
            {T(lang, 'Уведомления', 'Notifications')}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 p-4">
        {activeTab === 'users' ? (
          <AdminUsersTab
            profile={profile}
            onPatchOwnProfile={onPatchOwnProfile}
            onSendNotification={(userId) => {
              setNotificationTargetUserId(userId);
              setActiveTab('notifications');
            }}
          />
        ) : (
          <AdminNotificationsTab
            profile={profile}
            initialTargetUserId={notificationTargetUserId}
            onClearInitialTarget={() => setNotificationTargetUserId('')}
          />
        )}
      </div>
    </div>
  );
};
