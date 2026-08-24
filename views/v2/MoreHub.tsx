import React, { useState } from 'react';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  EditorialProfileButton,
  EditorialTabs,
  type EditorialTabItem,
} from '../../components/editorial/EditorialScreenChrome';
import { hasActivePremium } from '../../lib/accessMatrix';
import { describePremiumEntitlement } from '../../lib/subscriptionPresentation';
import type { PremiumEntitlementSnapshot } from '../../types';
import { Settings, type SettingsProps } from '../Settings';
import { AstrologyEncyclopedia } from './AstrologyEncyclopedia';

export type MoreHubTab = 'knowledge' | 'premium' | 'settings';

export type MoreHubProps = Omit<SettingsProps, 'embedded' | 'onRequestPremium'> & {
  onOpenPremium: () => void;
  initialTab?: MoreHubTab;
  activeTab?: MoreHubTab;
  onTabChange?: (tab: MoreHubTab) => void;
};

const MORE_TABS_RU: readonly EditorialTabItem<MoreHubTab>[] = [
  { id: 'knowledge', label: 'Знания' },
  { id: 'premium', label: 'Premium' },
  { id: 'settings', label: 'Настройки' },
];

const MORE_TABS_EN: readonly EditorialTabItem<MoreHubTab>[] = [
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'premium', label: 'Premium' },
  { id: 'settings', label: 'Settings' },
];

function legacyGiftEntitlement(profile: SettingsProps['profile']): PremiumEntitlementSnapshot | null {
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

function PremiumHub({
  profile,
  onOpenPremium,
  onRestorePurchase,
  onManageSubscription,
}: Pick<MoreHubProps, 'profile' | 'onOpenPremium' | 'onRestorePurchase' | 'onManageSubscription'>) {
  const ru = profile.language !== 'en';
  const [restoreState, setRestoreState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const premium = hasActivePremium(profile);
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
    <main
      className="mx-auto grid w-full max-w-[620px] gap-8 overflow-x-clip px-5 pb-28 pt-6"
      aria-labelledby="more-premium-title"
    >
      <section className="grid gap-3">
        <p className="lumia-label">{ru ? 'Статус подписки' : 'Subscription status'}</p>
        <h1 id="more-premium-title" className="text-balance font-serif text-2xl font-medium text-mono-ink">
          {presentation.title}
        </h1>
        <p className="text-pretty text-base text-mono-muted">{presentation.body}</p>

        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          {!premium || presentation.shouldPromote ? (
            <button type="button" className="fresh-btn-primary !m-0 !w-full" onClick={onOpenPremium}>
              {ru ? 'Посмотреть Premium' : 'View Premium'}
            </button>
          ) : null}
          {premium && presentation.canManageInStore && onManageSubscription ? (
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
          <p role="status" className="text-base text-mono-muted">
            {ru ? 'Покупки проверены сервером.' : 'Purchases were checked by the server.'}
          </p>
        ) : restoreState === 'error' ? (
          <p role="alert" className="text-base text-red-700">
            {ru
              ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.'
              : 'Could not restore the purchase. Check RuStore and your connection.'}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3" aria-labelledby="more-premium-features">
        <h2 id="more-premium-features" className="font-serif text-xl font-medium text-mono-ink">
          {ru ? 'Что входит в Premium' : 'What Premium includes'}
        </h2>
        <ul className="divide-y divide-black/10 border-y border-black/10" role="list">
          {features.map((feature) => (
            <li key={feature} className="py-3 text-base text-mono-ink">
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export function MoreHub({
  initialTab = 'knowledge',
  activeTab: controlledTab,
  onTabChange,
  onOpenPremium,
  ...settingsProps
}: MoreHubProps) {
  const [internalTab, setInternalTab] = useState<MoreHubTab>(initialTab);
  const activeTab = controlledTab ?? internalTab;
  const ru = settingsProps.profile.language !== 'en';

  const selectTab = (tab: MoreHubTab) => {
    if (controlledTab === undefined) setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="fresh-page more-hub-page !min-h-full overflow-x-clip !bg-white pb-24">
      <AppTopBar
        title={ru ? 'Ещё' : 'More'}
        rightAction={(
          <EditorialProfileButton
            label={ru ? 'Открыть профиль' : 'Open profile'}
            onClick={settingsProps.onOpenProfile}
          />
        )}
      />
      <EditorialTabs
        className="more-hub-tabs"
        label={ru ? 'Разделы экрана «Ещё»' : 'More sections'}
        tabs={ru ? MORE_TABS_RU : MORE_TABS_EN}
        activeTab={activeTab}
        onTabChange={selectTab}
      />

      {activeTab === 'knowledge' ? (
        <AstrologyEncyclopedia
          embedded
          profile={settingsProps.profile}
          onOpenProfile={settingsProps.onOpenProfile}
        />
      ) : activeTab === 'premium' ? (
        <PremiumHub
          profile={settingsProps.profile}
          onOpenPremium={onOpenPremium}
          onRestorePurchase={settingsProps.onRestorePurchase}
          onManageSubscription={settingsProps.onManageSubscription}
        />
      ) : (
        <Settings
          {...settingsProps}
          embedded
          onRequestPremium={onOpenPremium}
        />
      )}
    </div>
  );
}
