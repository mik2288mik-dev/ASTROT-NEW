import React, { useRef, useState } from 'react';
import { useTelemetrySection } from '../../services/useAppTelemetry';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import type { UserProfile } from '../../types';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';

import { NeboShop } from '../../components/nebo/NeboShop';
import { RestHome } from '../../components/nebo/RestHome';

export type ServiceTab = 'matrix' | 'antistress' | 'tests' | 'sounds' | 'stories' | 'knowledge' | 'store';

export type ServiceScreenProps = {
  profile: UserProfile;
  onOpenCharts: () => void;
  onOpenMatrix: () => void;
  onOpenAntistress: () => void;
  onOpenTests: (testId?: string) => void;
  onOpenSounds: () => void;
  onOpenStories: () => void;
  onOpenMoon?: () => void;
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
  onOpenCharts: _onOpenCharts,
  onOpenMatrix,
  onOpenAntistress,
  onOpenTests,
  onOpenSounds,
  onOpenStories,
  onOpenMoon,
  premiumStoreContent,
  profile,
}: ServiceScreenProps) {
  const [internalTab, setInternalTab] = useState<ServiceTab>(initialTab);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = controlledTab ?? internalTab;
  useTelemetrySection('services', activeTab);
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

  // «Отдых» (canvas): the calm rooms as big picture cards. Knowledge and the store keep their own pages.
  const restHome = activeTab !== 'knowledge' && activeTab !== 'store';
  const restRooms: ReadonlyArray<{ id: ServiceTab; title: string; text: string; image: string }> = ru ? [
    { id: 'sounds', title: 'Звуки', text: 'Море, дождь, лес и музыка для сна', image: '/assets/home-tiles/sounds.webp' },
    { id: 'stories', title: 'Рассказы на ночь', text: 'Новая серия каждый вечер, читать или слушать', image: '/assets/home-tiles/stories.webp' },
    { id: 'antistress', title: 'Антистресс и дыхание', text: 'Дыхание, пузыри и минута тишины', image: '/assets/home-tiles/antistress.webp' },
    { id: 'tests', title: 'Тесты', text: 'Новый тест каждый понедельник', image: '/assets/home-tiles/tests.webp' },
  ] : [
    { id: 'sounds', title: 'Sounds', text: 'Sea, rain, forest and sleep music', image: '/assets/home-tiles/sounds.webp' },
    { id: 'stories', title: 'Bedtime stories', text: 'A new episode every evening', image: '/assets/home-tiles/stories.webp' },
    { id: 'antistress', title: 'Anti-stress and breathing', text: 'Breathing, bubbles and a quiet minute', image: '/assets/home-tiles/antistress.webp' },
    { id: 'tests', title: 'Tests', text: 'A new test every Monday', image: '/assets/home-tiles/tests.webp' },
  ];

  return (
    <div ref={rootRef} className={restHome ? 'fresh-page services-screen-page nebo-rest' : 'fresh-page services-screen-page'}>
      <AppTopBar title={restHome ? (ru ? 'Отдых' : 'Unwind') : (ru ? 'Меню' : 'Menu')} />
      {restHome && ru ? (
        <RestHome
          onOpenSounds={onOpenSounds}
          onOpenStories={onOpenStories}
          onOpenTests={onOpenTests}
          onOpenAntistress={onOpenAntistress}
          onOpenMoon={onOpenMoon}
        />
      ) : restHome ? (
        <>
          <div className="nebo-page-title">
            <h1>{ru ? 'Отдых' : 'Unwind'}</h1>
            <p>{ru ? 'Звуки, рассказы, дыхание и тесты' : 'Sounds, stories, breathing and tests'}</p>
          </div>
          <div className="nebo-rest-list">
            {restRooms.map((room, index) => (
              <button
                key={room.id}
                type="button"
                className={index === 0 ? 'nebo-rest-card is-hero' : 'nebo-rest-card'}
                onClick={() => selectTab(room.id)}
              >
                <img src={room.image} alt="" loading={index === 0 ? 'eager' : 'lazy'} />
                <span className="nebo-rest-card-copy">
                  <strong>{room.title}</strong>
                  <span>{room.text}</span>
                </span>
              </button>
            ))}
            {onOpenMoon ? (
              <button type="button" className="nebo-rest-card nebo-rest-card--moon" onClick={onOpenMoon}>
                <span className="nebo-rest-card-copy">
                  <strong>{ru ? 'Лунные календари' : 'Moon calendars'}</strong>
                  <span>{ru ? 'Сад, стрижка, здоровье, дела и дом по фазам Луны' : 'Garden, haircut, health, plans and home by moon phase'}</span>
                </span>
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <EditorialTabs
          className="services-screen-tabs"
          label={ru ? 'Сервисные разделы' : 'Service sections'}
          tabs={ru ? SERVICE_TABS_RU : SERVICE_TABS_EN}
          activeTab={activeTab}
          onTabChange={selectTab}
        />
      )}

      {activeTab === 'knowledge' ? (
        <AstrologyEncyclopedia
          embedded
          profile={profile}
        />
      ) : activeTab === 'store' ? (
        <div className="service-premium-content">
          <NeboShop profile={profile} plusContent={premiumStoreContent} />
        </div>
      ) : null}
    </div>
  );
}
