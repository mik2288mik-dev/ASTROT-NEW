import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('honest contextual paywall', () => {
  const source = read('views/Paywall.tsx');
  const rustoreService = read('services/rustorePayService.ts');

  it('names only the real Premium value groups', () => {
    for (const reason of [
      'Личные прогнозы',
      'Натальный разбор',
      'Совместимость',
      'Мои карты',
    ]) {
      expect(source).toContain(reason);
    }
    expect(source).toContain('PREMIUM_SAVED_PERSON_LIMIT');
    expect(source).toContain('Своя + до ${PREMIUM_SAVED_PERSON_LIMIT} карт других людей');
    expect(source).not.toMatch(/До 5 (?:дополнительных )?сохранённых карт|До 5 сохранённых карт|Up to 5/iu);
    expect(source).not.toContain('47 ответов');
    expect(source).not.toContain('10 тем');
    expect(source).not.toContain('годовой прогноз');
  });

  it('presents subscription terms with one shared set of benefits and no invented discounts', () => {
    expect(source).toContain('type="radio"');
    expect(source).toContain('className="pw2-benefits"');
    expect(source).not.toContain('pw2-plan-features');
    expect(source).not.toContain('PLAN_ADVANTAGES');
    expect(source).not.toMatch(/эконом|скидк|выгодн|популярн/i);
  });

  it('defaults to three months and uses only loaded channel-authoritative catalogs', () => {
    expect(source).toContain("initialPlanId = 'premium_quarter'");
    expect(source).toContain('useState<PremiumPlanId>(initialPlanId)');
    expect(source).toContain("product.type !== 'SUBSCRIPTION'");
    expect(source).toContain('subscriptionInfo');
    expect(source).not.toContain('priceRub');
    expect(source).not.toContain('savings(');
    expect(source).not.toContain('setTimeout(');
    expect(source).toContain('if (!paymentCatalogEnabled)');
    expect(source).toContain('loadTelegramPremiumPlans()');
    expect(rustoreService).toContain('if (!entries.length) return {}');
  });

  it('shows renewal, cancellation, legal, close, Free, and restore controls', () => {
    for (const copy of [
      'Автопродление:',
      'Отмена в RuStore: Профиль → Подписки',
      'Остаться на Free',
      'Восстановить покупку',
      'Условия использования',
      'Политика конфиденциальности',
      'Закрыть',
    ]) {
      expect(source).toContain(copy);
    }
  });
});
