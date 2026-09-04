import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Telegram Stars paywall reachability', () => {
  it('loads every active server plan and presents Stars as one-time payments', () => {
    const paywall = read('views/Paywall.tsx');

    expect(paywall).toContain('canUseTelegramStars(distributionChannel)');
    expect(paywall).toContain('loadTelegramPremiumPlans()');
    expect(paywall).toContain('const TELEGRAM_PLAN_ORDER: PremiumPlanId[] = [');
    expect(paywall).toContain("'premium_week'");
    expect(paywall).toContain('priceLabel: `${plan.stars} Stars`');
    expect(paywall).toContain('autoRenew: false');
    expect(paywall).toContain('Разовая оплата:');
    expect(paywall).toContain("visiblePlans.length === 4 ? ' pw2-plans--four'");
  });

  it('keeps pending Telegram confirmation checkable without opening a second invoice', () => {
    const paywall = read('views/Paywall.tsx');
    const telegram = read('services/telegramService.ts');
    const app = read('App.tsx');

    expect(paywall).toContain("purchaseState === 'pending' && !telegramPaymentsEnabled");
    expect(paywall).toContain('disabled={purchaseActionLocked || catalogLoading || !selectedPlan}');
    expect(paywall).toContain("? (ru ? 'Проверить оплату' : 'Check payment')");
    expect(telegram).toContain("if (storedState) return Promise.resolve(storedState.status === 'paid' ? 'paid' : 'pending')");
    expect(app).toContain('pollForPaymentEntitlement({');
    expect(app).toContain('const validatedPatch = await paymentPatchFromServer(paymentUserId);');
    expect(app).toContain("if (!paymentResult.entitlement) {");
    expect(app).toContain("return 'pending';");
  });

  it('does not expose RuStore-only restore and management controls on Telegram', () => {
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');

    expect(paywall).toContain('{rustorePaymentsEnabled ? (');
    expect(paywall).toContain('{rustorePaymentsEnabled && restoreError ? (');
    expect(settings).toContain('rustorePurchaseControlsAvailable');
    expect(settings).toContain('if (!rustorePurchaseControlsAvailable) return;');
    expect(settings).toContain('rustorePurchaseControlsAvailable && restoreState');
  });
});
