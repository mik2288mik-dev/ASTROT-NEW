import { buildTranslate } from '../lib/i18n/domTranslator';
import { russianOnlyRequest } from '../services/apiClient';

describe('generation stays in Russian whatever the interface language is', () => {
  test('rewrites the language in JSON bodies and query strings', () => {
    const body = JSON.stringify({ sign: 'leo', language: 'en', nested: { lang: 'es' }, locale: 'en' });
    const result = russianOnlyRequest('/api/content/home-cards?locale=en&language=es&x=1', { method: 'POST', body });
    expect(result.path).toBe('/api/content/home-cards?locale=ru&language=ru&x=1');
    expect(JSON.parse(String(result.init.body))).toEqual({ sign: 'leo', language: 'ru', nested: { lang: 'ru' }, locale: 'ru' });
  });

  test('leaves other text alone, including what a person typed', () => {
    const body = JSON.stringify({ question: 'What does "language":"en" mean?', language: 'ru' });
    expect(russianOnlyRequest('/api/x?slang=en', { body })).toEqual({ path: '/api/x?slang=en', init: { body } });
  });
});

describe('translation of on-screen text', () => {
  const translate = buildTranslate({
    'Настройки': 'Settings',
    'Все звезды\nтвои!': 'All the stars\nare yours!',
    'Осталось {0} из {1}': '{0} of {1} left',
    '{0} из {1}': '{0} of {1}',
    '{0} и {1}': '{0} and {1}',
  });

  test('finds exact phrases whatever the spacing', () => {
    expect(translate('  Настройки ')).toBe('Settings');
    expect(translate('Все звезды твои!')).toBe('All the stars\nare yours!');
  });

  test('moves values into a phrase', () => {
    expect(translate('Осталось 3 из 5')).toBe('3 of 5 left');
    expect(translate('3 из 5')).toBe('3 of 5');
  });

  test('a short frame never catches generated text, which stays as it is', () => {
    expect(translate('Ты часть из них')).toBeNull();
    expect(translate('Любовь и работа')).toBeNull();
    expect(translate('Сегодня хороший день для разговора')).toBeNull();
  });
});
