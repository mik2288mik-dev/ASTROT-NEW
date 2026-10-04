import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Gift } from 'lucide-react';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialChartsButton,
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import type { UserProfile } from '../../types';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';
import { GiftIdeasSheet, type GiftPerson } from '../../components/home/GiftIdeasSheet';
import { loadExploreCharts } from '../../components/PersonalForecastFeed/exploreCharts';

export type ServiceTab = 'matrix' | 'knowledge' | 'store';

export type ServiceScreenProps = {
  profile: UserProfile;
  onOpenCharts: () => void;
  onOpenMatrix: () => void;
  premiumStoreContent: React.ReactNode;
  initialTab?: ServiceTab;
  activeTab?: ServiceTab;
  onTabChange?: (tab: ServiceTab) => void;
};

const SERVICE_TABS_RU: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'matrix', label: 'Матрица судьбы' },
  { id: 'knowledge', label: 'Хочу знать' },
  { id: 'store', label: 'Магазин' },
];

const SERVICE_TABS_EN: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'matrix', label: 'Destiny matrix' },
  { id: 'knowledge', label: 'Learn' },
  { id: 'store', label: 'Store' },
];

export function ServiceScreen({
  initialTab = 'knowledge',
  activeTab: controlledTab,
  onTabChange,
  onOpenCharts,
  onOpenMatrix,
  premiumStoreContent,
  profile,
}: ServiceScreenProps) {
  const [internalTab, setInternalTab] = useState<ServiceTab>(initialTab);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = controlledTab ?? internalTab;
  const ru = profile.language !== 'en';
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPeople, setGiftPeople] = useState<GiftPerson[]>([]);

  useEffect(() => {
    if (!giftOpen) return undefined;
    let active = true;
    void loadExploreCharts(String(profile.id || 'guest')).then((charts) => {
      if (!active) return;
      setGiftPeople(charts
        .filter((chart) => !chart.is_primary && !chart.archived_at && chart.subject_type !== 'self' && chart.name?.trim())
        .map((chart) => ({ name: chart.name.trim().split(/\s+/u)[0], chart: chart.chart_data ?? null, relation: chart.relation_label ?? null })));
    });
    return () => { active = false; };
  }, [giftOpen, profile.id]);

  const selectTab = (tab: ServiceTab) => {
    if (tab === 'matrix') {
      onOpenMatrix();
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
      {ru ? (
        <button type="button" className="service-gift-entry" onClick={() => setGiftOpen(true)}>
          <span className="service-gift-entry-icon" aria-hidden="true"><Gift size={20} strokeWidth={1.8} /></span>
          <span className="service-gift-entry-copy">
            <b>Что подарить?</b>
            <span>Идеи подарков по карте человека или по знаку — бесплатно</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}
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
      <GiftIdeasSheet open={giftOpen} person={null} people={giftPeople} onClose={() => setGiftOpen(false)} />
    </div>
  );
}
