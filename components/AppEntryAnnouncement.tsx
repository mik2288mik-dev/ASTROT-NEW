import React from 'react';
import type { AppEntryAnnouncement as AppEntryAnnouncementData } from '../lib/appEntryAnnouncement';
import { CosmicSheet } from './lumia-ui/CosmicSheet';

type Props = {
  announcement: AppEntryAnnouncementData | null;
  onClose: () => void;
};

export function AppEntryAnnouncement({ announcement, onClose }: Props) {
  return (
    <CosmicSheet
      open={announcement !== null}
      title={announcement?.title || ''}
      closeLabel="Закрыть сообщение"
      onClose={onClose}
      footer={(
        <button type="button" className="forecast-bottom-sheet-primary" onClick={onClose}>
          Понятно
        </button>
      )}
    >
      <p className="app-entry-announcement-message">{announcement?.message}</p>
    </CosmicSheet>
  );
}
