import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('honest contextual paywall', () => {
  const source = read('views/Paywall.tsx');

  it('names only the four real Premium value groups', () => {
    expect(source).toContain('Больше личного. Меньше общего.');
    for (const reason of [
      'Весь личный Today.',
      'Личная неделя и месяц.',
      'Глубокий разбор карты и личности.',
      'Совместимость по данным рождения и сохранённые люди.',
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
      'Автопродление',
      'Управлять или отменить подписку можно в RuStore',
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
