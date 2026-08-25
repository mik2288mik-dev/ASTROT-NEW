import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('honest contextual paywall', () => {
  const source = read('views/Paywall.tsx');
  const rustoreService = read('services/rustorePayService.ts');

  it('names only the real Premium value groups', () => {
    expect(source).toContain('Твой прогноз — без обрезанной версии.');
    for (const reason of [
      'Полный Today, личные неделя и месяц',
      'Глубокая карта, вопросы и совместимость',
      'До 5 дополнительных сохранённых карт',
    ]) {
      expect(source).toContain(reason);
    }
    expect(source).not.toContain('10 тем');
    expect(source).not.toContain('годовой прогноз');
  });

  it('explains each subscription term without inventing savings or popularity', () => {
    for (const advantage of ['Короткий срок', 'Реже продлевать', 'На весь год']) {
      expect(source).toContain(advantage);
    }
    expect(source).not.toMatch(/эконом|скидк|выгодн|популярн/i);
  });

  it('defaults to three months and uses only a loaded RuStore subscription catalog', () => {
    expect(source).toContain("initialPlanId = 'premium_quarter'");
    expect(source).toContain('useState<PremiumPlanId>(initialPlanId)');
    expect(source).toContain("product.type !== 'SUBSCRIPTION'");
    expect(source).toContain('subscriptionInfo');
    expect(source).not.toContain('priceRub');
    expect(source).not.toContain('savings(');
    expect(source).not.toContain('setTimeout(');
    expect(source).toContain('if (!rustorePaymentsEnabled)');
    expect(rustoreService).toContain('if (!entries.length) return {}');
  });

  it('shows renewal, cancellation, legal, close, Free, and restore controls', () => {
    for (const copy of [
      'Подписка продлевается автоматически',
      'Управлять или отменить подписку можно в RuStore: Профиль → Подписки',
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
