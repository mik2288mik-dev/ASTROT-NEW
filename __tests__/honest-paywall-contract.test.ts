import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('honest contextual paywall', () => {
  const source = read('views/Paywall.tsx');

  it('names only the real Premium value groups', () => {
    expect(source).toContain('Твой прогноз — без обрезанной версии.');
    for (const reason of [
      'Полный Today, личные неделя и месяц.',
      'Глубокий разбор карты и личности.',
      'Вопросы по карте и совместимость по данным рождения.',
      'До 5 сохранённых карт помимо своей.',
    ]) {
      expect(source).toContain(reason);
    }
    expect(source).not.toContain('10 тем');
    expect(source).not.toContain('годовой прогноз');
  });

  it('defaults to three months and uses only a loaded RuStore subscription catalog', () => {
    expect(source).toContain("useState<PremiumPlanId>('premium_quarter')");
    expect(source).toContain("product.type !== 'SUBSCRIPTION'");
    expect(source).toContain('subscriptionInfo');
    expect(source).not.toContain('priceRub');
    expect(source).not.toContain('savings(');
    expect(source).not.toContain('setTimeout(');
    expect(source).toContain("Promise.reject(new Error('RUSTORE_CATALOG_UNAVAILABLE'))");
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
