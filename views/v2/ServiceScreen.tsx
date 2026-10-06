import React, { useRef, useState } from 'react';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialChartsButton,
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import type { UserProfile } from '../../types';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';

export type ServiceTab = 'matrix' | 'antistress' | 'tests' | 'sounds' | 'stories' | 'knowledge' | 'store';

export type ServiceScreenProps = {
  profile: UserProfile;
  onOpenCharts: () => void;
  onOpenMatrix: () => void;
  onOpenAntistress: () => void;
  onOpenTests: () => void;
  onOpenSounds: () => void;
  onOpenStories: () => void;
  premiumStoreContent: React.ReactNode;
  initialTab?: ServiceTab;
  activeTab?: ServiceTab;
  onTabChange?: (tab: ServiceTab) => void;
};

const SERVICE_TABS_RU: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'matrix', label: 'Матрица судьбы' },
  { id: 'antistress', label: 'Антистресс' },
  { id: 'tests', label: 'Тесты' },
  { id: 'sounds', label: 'Звуки' },
  { id: 'stories', label: 'Рассказы' },
  { id: 'knowledge', label: 'Хочу знать' },
  { id: 'store', label: 'Магазин' },
];

const SERVICE_TABS_EN: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'matrix', label: 'Destiny matrix' },
  { id: 'antistress', label: 'Anti-stress' },
  { id: 'tests', label: 'Tests' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'stories', label: 'Stories' },
  { id: 'knowledge', label: 'Learn' },
  { id: 'store', label: 'Store' },
];

export function ServiceScreen({
  initialTab = 'knowledge',
  activeTab: controlledTab,
  onTabChange,
  onOpenCharts,
  onOpenMatrix,
  onOpenAntistress,
  onOpenTests,
  onOpenSounds,
  onOpenStories,
  premiumStoreContent,
  profile,
}: ServiceScreenProps) {
  const [internalTab, setInternalTab] = useState<ServiceTab>(initialTab);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = controlledTab ?? internalTab;
  const ru = profile.language !== 'en';

  const selectTab = (tab: ServiceTab) => {
    // These are rooms of their own: the tab opens them instead of switching the content below.
    const rooms: Partial<Record<ServiceTab, () => void>> = {
      matrix: onOpenMatrix, antistress: onOpenAntistress, tests: onOpenTests, sounds: onOpenSounds, stories: onOpenStories,
    };
    const openRoom = rooms[tab];
    if (openRoom) {
      openRoom();
      return;
    }
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
        rightAction={<EditorialChartsButton label={ru ? 'Открыть мои карты' : 'Open my charts'} onClick={onOpenCharts} />}
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
      ) : null}
    </div>
  );
}
