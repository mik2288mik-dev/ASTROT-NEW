import React from 'react';
import type { UserProfile } from '../../types';
import { NotificationsManager } from '../../components/Admin/Notifications/NotificationsManager';

type Props = {
  profile: UserProfile;
};

export const AdminAutomationTab: React.FC<Props> = ({ profile }) => {
  return <NotificationsManager profile={profile} />;
};
