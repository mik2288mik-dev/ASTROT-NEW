import React, { useRef, useState } from 'react';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialSettingsButton,
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import { describePremiumEntitlement } from '../../lib/subscriptionPresentation';
import type { PremiumEntitlementSnapshot, UserProfile } from '../../types';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';

export type ServiceTab = 'knowledge' | 'store' | 'charts';

export type ServiceScreenProps = {
  profile: UserProfile;
  onOpenStore: () => void;
  onOpenSettings: () => void;
  chartsContent: React.ReactNode;
  onRestorePurchase?: () => Promise<void>;
  onManageSubscription?: () => Promise<void> | void;
  initialTab?: ServiceTab;
  activeTab?: ServiceTab;
  onTabChange?: (tab: ServiceTab) => void;
};

const SERVICE_TABS_RU: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'knowledge', label: 'Хочу знать' },
  { id: 'store', label: 'Premium' },
  { id: 'charts', label: 'Мои карты' },
];

const SERVICE_TABS_EN: readonly EditorialTabItem<ServiceTab>[] = [
  { id: 'knowledge', label: 'Learn' },
  { id: 'store', label: 'Premium' },
  { id: 'charts', label: 'My charts' },
];

const SERVICE_TITLES_RU: Record<ServiceTab, string> = {
  knowledge: 'Хочу знать',
  store: 'Premium',
  charts: 'Мои карты',
};

const SERVICE_TITLES_EN: Record<ServiceTab, string> = {
  knowledge: 'Learn',
  store: 'Premium',
  charts: 'My charts',
};

function legacyGiftEntitlement(profile: UserProfile): PremiumEntitlementSnapshot | null {
  if (profile.premiumEntitlement || !profile.premiumUntil) return profile.premiumEntitlement || null;
  return {
    state: 'gift',
    isPremium: true,
    source: 'legacy_gift',
    startsAt: null,
    endsAt: profile.premiumUntil,
    autoRenew: false,
    productId: null,
    period: null,
  };
}

function StoreSection({
  profile,
  onOpenStore,
  onRestorePurchase,
  onManageSubscription,
}: Pick<
  ServiceScreenProps,
  'profile' | 'onOpenStore' | 'onRestorePurchase' | 'onManageSubscription'
>) {
  const ru = profile.language !== 'en';
  const [restoreState, setRestoreState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const presentation = describePremiumEntitlement(
    profile.premiumEntitlement || legacyGiftEntitlement(profile),
    profile.language,
  );
  const features = ru
    ? [
        'Личный прогноз целиком, включая неделю и месяц',
        'Подробный разбор натальной карты',
        'Совместимость по двум картам',
        'До пяти дополнительных сохранённых карт',
      ]
    : [
        'The full personal forecast, including week and month',
        'A detailed natal chart reading',
        'Compatibility using two natal charts',
        'Up to five additional saved charts',
      ];

  const restore = async () => {
    if (!onRestorePurchase || restoreState === 'running') return;
    setRestoreState('running');
    try {
      await onRestorePurchase();
      setRestoreState('success');
    } catch {
      setRestoreState('error');
    }
  };

  return (
    <section className="service-premium-content" aria-labelledby="service-store-title">
      <section className="service-premium-intro">
        <p className="lumia-label">{ru ? 'Статус подписки' : 'Subscription status'}</p>
        <h1 id="service-store-title">{presentation.title}</h1>
        <p>{presentation.body}</p>
        <div className="service-premium-actions">
          <button type="button" className="fresh-btn-primary !m-0 !w-full" onClick={onOpenStore}>
            {ru ? 'Открыть магазин' : 'Open store'}
          </button>
          {presentation.canManageInStore && onManageSubscription ? (
            <button type="button" className="fresh-btn-ghost w-full" onClick={() => void onManageSubscription()}>
              {ru ? 'Управлять в RuStore' : 'Manage in RuStore'}
            </button>
          ) : null}
          <button
            type="button"
            className="fresh-btn-ghost w-full"
            disabled={!onRestorePurchase || restoreState === 'running'}
            aria-busy={restoreState === 'running'}
            onClick={() => void restore()}
          >
            {restoreState === 'running'
              ? (ru ? 'Проверяем…' : 'Checking…')
              : (ru ? 'Восстановить покупку' : 'Restore purchase')}
          </button>
        </div>
        {restoreState === 'success' ? (
          <p role="status">{ru ? 'Покупки проверены сервером.' : 'Purchases were checked by the server.'}</p>
        ) : restoreState === 'error' ? (
          <p role="alert" className="text-red-700">
            {ru
              ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.'
              : 'Could not restore the purchase. Check RuStore and your connection.'}
          </p>
        ) : null}
      </section>

      <section className="service-premium-features" aria-labelledby="service-store-features">
        <h2 id="service-store-features">{ru ? 'Что входит в Premium' : 'What Premium includes'}</h2>
        <ul role="list">
          {features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
      </section>
    </section>
  );
}

export function ServiceScreen({
  initialTab = 'knowledge',
  activeTab: controlledTab,
  onTabChange,
  onOpenStore,
  onOpenSettings,
  chartsContent,
  onRestorePurchase,
  onManageSubscription,
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
        title={(ru ? SERVICE_TITLES_RU : SERVICE_TITLES_EN)[activeTab]}
        rightAction={activeTab !== 'charts' ? (
          <EditorialSettingsButton
            label={ru ? 'Открыть настройки' : 'Open settings'}
            onClick={onOpenSettings}
          />
        ) : undefined}
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
        <StoreSection
          profile={profile}
          onOpenStore={onOpenStore}
          onRestorePurchase={onRestorePurchase}
          onManageSubscription={onManageSubscription}
        />
      ) : (
        <div className="services-charts-content">
          {chartsContent}
        </div>
      )}
    </div>
  );
}
