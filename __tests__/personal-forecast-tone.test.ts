import { getPersonalForecastToneViolationCodes } from '../lib/personalForecastTone';

describe('personal forecast tone guard', () => {
  it.each([
    ['К вечеру напряжение спадёт само.', 'TENSION'],
    ['Сегодня напряжённый день, и всё идёт медленнее.', 'TENSION'],
    ['Разговор легко перерастёт в спор.', 'CONFLICT'],
    ['Терпение на нуле: чужая медлительность раздражает.', 'IRRITATION'],
    ['Сегодня раздражает, когда тянут резину.', 'IRRITATION'],
    ['Одна реплика легко раздувает разговор.', 'CONFLICT'],
    ['С утра захочется взять на себя больше, чем ты успеешь.', 'OVERLOAD'],
    ['Не тащи всё на себе.', 'OVERLOAD'],
    ['Сначала сверь детали, потом обещай результат.', 'WARNING_LED'],
    ['Тревога нарастает, и день будет непростым.', 'FEAR_OR_FAILURE'],
    ['Tension will build during the day.', 'ENGLISH_PROBLEM_LED'],
    ['Венера в трине к твоему Солнцу: мягкая связь.', 'ASTROLOGY_JARGON'],
    ['Транзит Сатурна к натальной карте.', 'ASTROLOGY_JARGON'],
  ])('flags a clearly problem-led phrase: %s', (text, code) => {
    expect(getPersonalForecastToneViolationCodes(text)).toContain(code);
  });

  it.each([
    'Хороший день для разговоров. Напиши тому, с кем давно хотелось поболтать.',
    'Сегодня можно не спешить. Даже обычное дело принесёт удовольствие.',
    'В споре о фильмах легко найти повод посмеяться.',
    'После работы останется время на что-то приятное.',
    'Тихий день без напряжения и лишней суеты.',
    'A relaxed day with time for a good conversation.',
  ])('allows a pleasant or calm reading: %s', (text) => {
    expect(getPersonalForecastToneViolationCodes(text)).toEqual([]);
  });
});
