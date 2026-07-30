import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const ACTIVE_COPY_FILES = [
  'views/Onboarding.tsx',
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
  ['повторяющиеся сценарии', /повторяющ\w*\s+(?:сценари|паттерн|тем)/iu],
  ['внутренний рисунок', /внутренн\w*\s+рисунок/iu],
  ['активная тема', /активн\w*\s+(?:тем|сфер|част)/iu],
  ['проявляется сильнее', /проявля\w*\s+сильнее/iu],
  ['замедлись', /\bзамедл\w*/iu],
  ['прислушайся к себе', /прислуша\w*\s+к\s+себе/iu],
  ['позволь себе', /позволь\w*\s+себе/iu],
  ['отпусти контроль', /отпусти\w*\s+контрол/iu],
  ['побереги ресурс', /поберег\w*\s+ресурс/iu],
  ['энергия дня', /энерги[яи]\s+дня/iu],
  ['вселенная', /\bвселенн\w*/iu],
  ['проработай', /\bпроработ\w*/iu],
  ['раскрой потенциал', /раскр\w*\s+(?:свой\s+)?потенциал/iu],
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
    const questions = read('lib/personalForecastQuestionGeneration.ts');
    const forecast = read('lib/personalForecastGeneration.ts');

    expect(voice).toContain("APP_VOICE_VERSION = '2'");
    expect(voice).toContain('hasAppVoiceViolation');
    expect(natal).toContain('hasAppVoiceViolation');
    expect(questions).toContain('hasAppVoiceViolation');
    expect(forecast).toContain('hasAppVoiceViolation');
  });
});
