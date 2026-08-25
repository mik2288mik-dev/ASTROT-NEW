import React, { useRef, useState } from 'react';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialChartsButton,
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import type { UserProfile } from '../../types';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';

export type ServiceTab = 'knowledge' | 'store' | 'settings';

export type ServiceScreenProps = {
  profile: UserProfile;
  onOpenCharts: () => void;
  premiumStoreContent: React.ReactNode;
  settingsContent: React.ReactNode;
  initialTab?: ServiceTab;
  activeTab?: ServiceTab;
  onTabChange?: (tab: ServiceTab) => void;
};

const SERVICE_TABS_RU: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'knowledge', label: 'Хочу знать' },
  { id: 'store', label: 'Premium' },
  { id: 'settings', label: 'Настройки' },
];

const SERVICE_TABS_EN: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'knowledge', label: 'Learn' },
  { id: 'store', label: 'Premium' },
  { id: 'settings', label: 'Settings' },
];

export function ServiceScreen({
  initialTab = 'knowledge',
  activeTab: controlledTab,
  onTabChange,
  onOpenCharts,
  premiumStoreContent,
  settingsContent,
  profile,
}: ServiceScreenProps) {
  const [internalTab, setInternalTab] = useState<ServiceTab>(initialTab);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = controlledTab ?? internalTab;
  const ru = profile.language !== 'en';

  const selectTab = (tab: ServiceTab) => {
    if (controlledTab === undefined) setInternalTab(tab);
    onTabChange?.(tab);
    window.requestAnimationFrame(() => {
      rootRef.current?.closest<HTMLElement>('.lumia-main-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  return (
    <div ref={rootRef} className="fresh-page services-screen-page">
      <AppTopBar
        title={ru ? 'Меню' : 'Menu'}
        rightAction={(
          <EditorialChartsButton
            label={ru ? 'Открыть мои карты' : 'Open my charts'}
            onClick={onOpenCharts}
          />
        )}
      />
      <EditorialTabs
        className="services-screen-tabs"
        label={ru ? 'Сервисные разделы' : 'Service sections'}
        tabs={ru ? SERVICE_TABS_RU : SERVICE_TABS_EN}
        activeTab={activeTab}
        onTabChange={selectTab}
      />

      {activeTab === 'knowledge' ? (
        <AstrologyEncyclopedia
          embedded
          profile={profile}
        />
      ) : activeTab === 'store' ? (
        <div className="service-premium-content">
          {premiumStoreContent}
        </div>
      ) : (
        <div className="services-settings-content">
          {settingsContent}
        </div>
      )}
    </div>
  );
}
