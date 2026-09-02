import { hasAppVoiceMysticism } from '../lib/appVoice';
import { hasNatalPersonalityCopyViolation } from '../lib/natalReading/permanentReport';
import { hasNatalReportCatalogCopyViolation } from '../lib/natalReading/reportCatalogGeneration';

describe('Russian karma validator word boundaries', () => {
  it.each([
    'Деньги остались в кармане.',
    'Он положил ключи в карман.',
    'В карманах ничего не осталось.',
    'Для мелочи есть отдельный кармашек.',
  ])('does not confuse an ordinary pocket word with karma: %s', (value) => {
    expect(hasAppVoiceMysticism(value)).toBe(false);
    expect(hasNatalPersonalityCopyViolation(value)).toBe(false);
    expect(hasNatalReportCatalogCopyViolation(value)).toBe(false);
  });

  it.each([
    'Карма обязательно вернётся.',
    'Это кармический урок.',
    'Всё объясняется кармичной связью.',
    'Он приписал это карме.',
  ])('still rejects karma and karmic wording: %s', (value) => {
    expect(hasAppVoiceMysticism(value)).toBe(true);
    expect(hasNatalPersonalityCopyViolation(value)).toBe(true);
    expect(hasNatalReportCatalogCopyViolation(value)).toBe(true);
  });
});