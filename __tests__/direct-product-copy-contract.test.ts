import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const ACTIVE_COPY_FILES = [
  'constants.ts',
  'views/Onboarding.tsx',
  'views/Settings.tsx',
  'views/Paywall.tsx',
  'views/v2/HoroscopeReader.tsx',
  'views/v2/NatalMagazine.tsx',
  'components/PremiumPreview.tsx',
  'components/Horoscope/HoroscopeContent.tsx',
  'components/Dashboard/CosmicPassport.tsx',
  'lib/natalHumanShared.ts',
  'lib/natalHumanInterpretation.ts',
  'lib/natalReading/fallbacks.ts',
  'lib/retentionNotificationCatalog.ts',
];

const FORBIDDEN_COPY: Array<[string, RegExp]> = [
  ['карта сложилась', /карта\s+сложилась/iu],
  ['это про тебя', /это\s+(?:вс[её]\s+)?про\s+тебя/iu],
  ['повторяющиеся сценарии', /повторяющ[а-яё]*\s+(?:сценари|паттерн|тем)/iu],
  ['внутренний рисунок', /внутренн[а-яё]*\s+рисунок/iu],
  ['активная тема', /активн[а-яё]*\s+(?:тем|сфер|част)/iu],
  ['проявляется сильнее', /проявля[а-яё]*\s+сильнее/iu],
  ['замедлись', /\bзамедл[а-яё]*/iu],
  ['прислушайся к себе', /прислуша[а-яё]*\s+к\s+себе/iu],
  ['позволь себе', /позволь[а-яё]*\s+себе/iu],
  ['отпусти контроль', /отпусти[а-яё]*\s+контрол/iu],
  ['побереги ресурс', /поберег[а-яё]*\s+(?:внутренн[а-яё]*\s+)?ресурс/iu],
  ['энергия дня', /энерги[яи]\s+дня/iu],
  ['вселенная', /\bвселенн[а-яё]*/iu],
  ['твоё небо', /тво[её]\s+небо/iu],
  ['тёплые напоминания', /т[её]пл[а-яё]*\s+напоминан|warm\s+nudges/iu],
  ['больше про себя', /больше\s+про\s+себя|more\s+about\s+you/iu],
  ['проработай', /\bпроработ[а-яё]*/iu],
  ['раскрой потенциал', /раскр[а-яё]*\s+(?:свой\s+)?потенциал/iu],
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('active product copy contract', () => {
  it.each(ACTIVE_COPY_FILES)('%s avoids pseudo-psychological and mystical filler', (file) => {
    const content = read(file);
    const violations = FORBIDDEN_COPY
      .filter(([, pattern]) => pattern.test(content))
      .map(([label]) => label);

    expect(violations).toEqual([]);
  });

  it('keeps the runtime voice versioned and enforced', () => {
    const voice = read('lib/appVoice.ts');
    const natal = read('lib/natalHumanInterpretation.ts');
    const natalSemantics = read('lib/natalSemanticCompiler.ts');
    const questions = read('lib/personalForecastQuestionGeneration.ts');
    const forecast = read('lib/personalForecastGeneration.ts');

    expect(voice).toContain("APP_VOICE_VERSION = '5'");
    expect(voice).toContain('hasAppVoiceViolation');
    expect(natal).toContain('validateGeneratedNatalPayload');
    expect(natalSemantics).toContain('hasAppVoiceViolation');
    expect(questions).toContain('hasAppVoiceViolation');
    expect(forecast).toContain('hasAppVoiceViolation');
  });
});
