import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('RuStore restore pending state', () => {
  it('does not report an unfinished provider confirmation as a restore failure', () => {
    const app = read('App.tsx');
    const restoreFlow = app.slice(
      app.indexOf('const restorePremiumPurchases = async'),
      app.indexOf('const requestPremium = async'),
    );

    const pendingGuard = "if (!completed && !inactive && pending) return 'pending';";
    expect(restoreFlow).toContain(pendingGuard);
    expect(restoreFlow.indexOf(pendingGuard)).toBeLessThan(
      restoreFlow.indexOf('const reason =', restoreFlow.indexOf(pendingGuard)),
    );
  });

  it('shows a safe retry message in both the paywall and settings', () => {
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');
    const message = 'RuStore ещё подтверждает покупку. Подожди немного и проверь снова — повторно покупать не нужно.';

    expect(paywall).toContain("const [restorePending, setRestorePending] = useState(false)");
    expect(paywall).toContain("if (result === 'pending') setRestorePending(true)");
    expect(paywall).toContain("|| purchaseState === 'pending'");
    expect(paywall).toContain('|| restorePending;');
    expect(paywall).toContain(message);
    expect(paywall).toContain('onRestore: () => Promise<PurchaseRestoreStatus>;');
    expect(settings).toContain("'idle' | 'running' | 'success' | 'pending' | 'error'");
    expect(settings).toContain("result === 'pending' ? 'pending' : 'success'");
    expect(settings).toContain('onRestorePurchase?: () => Promise<PurchaseRestoreStatus>;');
    expect(settings).toContain(message);
  });

  it('serializes purchase, restore, and subscription-management actions in the UI', () => {
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');

    expect(paywall).toContain('if (restoring || paying || managingSubscription) return;');
    expect(paywall).toContain('if (planSelectionLocked) return;');
    expect(paywall).toContain('disabled={planSelectionLocked}');
    expect(paywall).toContain("(purchaseState === 'pending' && !telegramPaymentsEnabled)");
    expect(paywall).toContain('disabled={purchaseActionLocked || catalogLoading || !selectedPlan}');
    expect(paywall).toContain('disabled={restoring || paying || managingSubscription}');
    expect(paywall).toContain("setPurchaseState('idle');");
    expect(settings).toContain("restoreState === 'running' || managingSubscription");
    expect(settings).toContain('disabled={managingSubscription || restoreState === \'running\'}');
    expect(settings).toContain('aria-busy={managingSubscription}');
  });

  it('surfaces subscription-management failures locally instead of resolving them as success', () => {
    const app = read('App.tsx');
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');

    expect(paywall).toContain('onManageSubscription?: () => Promise<boolean> | boolean;');
    expect(paywall).toContain('const opened = await onManageSubscription();');
    expect(paywall).toContain('if (!opened) setManageError(true);');
    expect(settings).toContain('onManageSubscription?: () => Promise<boolean> | boolean;');
    expect(settings).toContain('if (!opened) setManageSubscriptionError(true);');
    expect(app).toContain('return opened;');
  });

  it('scopes restore work and profile mutation to the account that started it', () => {
    const app = read('App.tsx');
    const service = read('services/rustorePayService.ts');

    expect(service).toContain('export function restoreRuStorePurchases(userId: string)');
    expect(service).toContain('const current = inFlightRestores.get(canonicalUserId);');
    expect(app).toContain('restoreRuStorePurchases(userId)');
    expect(app).toContain('restoreRuStorePurchases(restoreUserId)');
    expect(app).toContain('activeProfileUserIdRef.current !== restoreUserId');
    expect(app).toContain('mergePaymentProfilePatch(current, restoreUserId, validatedPatch)');
    expect(app).toContain("result.status === 'inactive'");
  });

  it('keeps terminal purchase markers safe while showing an actionable recovery path', () => {
    const app = read('App.tsx');
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');

    expect(app).toContain("paymentFailureCopy(paymentResult.reason, 'ru')");
    expect(app).toContain('throw new Error(reasonCode);');
    expect(paywall).toContain('paymentFailureCopy(restoreFailureReason, language)');
    expect(settings).toContain('paymentFailureCopy(restoreFailureReason, profile.language)');
  });
});
