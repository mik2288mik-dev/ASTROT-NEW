#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old!r}')
    write(path, source.replace(old, new, 1))


# "карм" used as an unbounded stem also matched ordinary words such as
# "карман", "кармане" and "кармашек". Keep karma/karmic wording blocked,
# but require a complete Russian word form.
replace_once(
    'lib/appVoice.ts',
    r'/карм|чакр|астрал|эзотери|вселенн|мироздан|вибрац|сакральн|магич|предначертан|высшие\s+силы|тонкие\s+матери|духовн[а-яё]*\s+пут/iu,',
    r'/(?:^|[^\p{L}])карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[\p{L}]*|ичн[\p{L}]*)(?=$|[^\p{L}])|чакр|астрал|эзотери|вселенн|мироздан|вибрац|сакральн|магич|предначертан|высшие\s+силы|тонкие\s+матери|духовн[а-яё]*\s+пут/iu,',
)
replace_once(
    'lib/natalReading/permanentReport.ts',
    r'карм[а-яё]*',
    r'карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[а-яё]*|ичн[а-яё]*)',
)
replace_once(
    'lib/natalReading/reportCatalogGeneration.ts',
    r'карм[\p{L}]*',
    r'карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[\p{L}]*|ичн[\p{L}]*)',
)

write(
    '__tests__/natal-karma-boundary.test.ts',
    r'''import { hasAppVoiceMysticism } from '../lib/appVoice';
import { hasNatalPersonalityCopyViolation } from '../lib/natalReading/permanentReport';
import { hasNatalReportCatalogCopyViolation } from '../lib/natalReading/reportCatalogGeneration';

describe('Russian karma validator word boundaries', () => {
  it.each([
    'Деньги остались в кармане.',
    'Он положил ключи в карман.',
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
  ])('still rejects karma and karmic wording: %s', (value) => {
    expect(hasAppVoiceMysticism(value)).toBe(true);
    expect(hasNatalPersonalityCopyViolation(value)).toBe(true);
    expect(hasNatalReportCatalogCopyViolation(value)).toBe(true);
  });
});
''',
)

print('Applied boundary-aware karma validators and regression tests.')
