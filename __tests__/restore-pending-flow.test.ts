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

    expect(restoreFlow).toContain("if (!completed && pending) return 'pending';");
    expect(restoreFlow.indexOf("return 'pending'")).toBeLessThan(
      restoreFlow.indexOf("eventType: 'restore_failed'"),
    );
  });

  it('shows a safe retry message in both the paywall and settings', () => {
    const paywall = read('views/Paywall.tsx');
    const settings = read('views/Settings.tsx');
    const message = 'RuStore ещё подтверждает покупку. Подожди немного и проверь снова — повторно покупать не нужно.';

    expect(paywall).toContain("const [restorePending, setRestorePending] = useState(false)");
    expect(paywall).toContain("if (result === 'pending') setRestorePending(true)");
    expect(paywall).toContain("purchaseState === 'pending' || restorePending");
    expect(paywall).toContain(message);
    expect(paywall).toContain('onRestore: () => Promise<PurchaseRestoreStatus>;');
    expect(settings).toContain("'idle' | 'running' | 'success' | 'pending' | 'error'");
    expect(settings).toContain("result === 'pending' ? 'pending' : 'success'");
    expect(settings).toContain('onRestorePurchase?: () => Promise<PurchaseRestoreStatus>;');
    expect(settings).toContain(message);
  });
});
