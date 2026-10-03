/**
 * «Вопрос дня»: one simple everyday question for everybody, answers grouped by
 * zodiac sign. One vote per account per day, the sign is taken from the
 * profile on the server, and percentages appear only after enough answers.
 */

export type DailyQuestion = { id: string; text: { ru: string; en: string }; options: Array<{ ru: string; en: string }> };

/** Answers of one sign needed before its percentages are shown. */
export const SIGN_MIN_VOTES = 20;
/** Answers overall needed before overall percentages are shown. */
export const ALL_MIN_VOTES = 30;

const q = (id: string, ru: string, en: string, options: Array<[string, string]>): DailyQuestion => ({
  id, text: { ru, en }, options: options.map(([optionRu, optionEn]) => ({ ru: optionRu, en: optionEn })),
});

export const DAILY_QUESTIONS: readonly DailyQuestion[] = [
  q('dinner', 'Что сегодня на ужин?', 'What is for dinner tonight?', [['Приготовлю дома', 'I will cook'], ['Закажу доставку', 'Delivery'], ['Что найдётся в холодильнике', 'Whatever is in the fridge']]),
  q('weekend', 'Идеальные выходные — это…', 'A perfect weekend is…', [['Диван и сериал', 'Couch and a series'], ['Поездка куда-нибудь', 'A trip somewhere'], ['Встречи с друзьями', 'Seeing friends']]),
  q('morning', 'Как ты просыпаешься?', 'How do you wake up?', [['С первого будильника', 'On the first alarm'], ['После третьего «ещё пять минут»', 'After the third "five more minutes"'], ['Просыпаюсь без будильника', 'Without an alarm']]),
  q('call', 'Позвонить или написать?', 'Call or text?', [['Только написать', 'Text only'], ['Позвонить — так быстрее', 'Call — it is faster'], ['Голосовое', 'A voice message']]),
  q('money', 'Неожиданно пришли деньги. Куда?', 'Unexpected money arrives. Where does it go?', [['Отложу', 'Save it'], ['Порадую себя', 'Treat myself'], ['Потрачу на близких', 'Spend on people close to me']]),
  q('season', 'Любимое время года?', 'Favourite season?', [['Лето', 'Summer'], ['Осень', 'Autumn'], ['Зима', 'Winter'], ['Весна', 'Spring']]),
  q('argue', 'В споре ты чаще…', 'In an argument you more often…', [['Стою на своём', 'Stand my ground'], ['Ищу компромисс', 'Look for a compromise'], ['Ухожу от спора', 'Avoid it']]),
  q('coffee', 'Без чего не начинается утро?', 'What does your morning need?', [['Кофе', 'Coffee'], ['Чай', 'Tea'], ['Телефон', 'My phone'], ['Тишина', 'Silence']]),
  q('party', 'На вечеринке ты…', 'At a party you are…', [['В центре внимания', 'The centre of attention'], ['В углу с одним человеком', 'In a corner with one person'], ['Рядом с едой', 'Next to the food']]),
  q('plans', 'Планы на завтра у тебя…', 'Your plans for tomorrow are…', [['Расписаны по часам', 'Scheduled by the hour'], ['Есть в голове', 'In my head'], ['Какие планы?', 'What plans?']]),
  q('travel', 'Отпуск мечты?', 'Dream holiday?', [['Море и ничего не делать', 'Sea and doing nothing'], ['Города и музеи', 'Cities and museums'], ['Горы и походы', 'Mountains and hiking']]),
  q('gift', 'Лучший подарок — это…', 'The best gift is…', [['Сделанный своими руками', 'Handmade'], ['То, что давно хотелось', 'Something long wanted'], ['Впечатление, а не вещь', 'An experience, not a thing']]),
  q('late', 'Опаздывать — это про тебя?', 'Are you a late person?', [['Никогда не опаздываю', 'Never late'], ['Минут на пять', 'Five minutes'], ['Я приду, когда приду', 'I arrive when I arrive']]),
  q('films', 'Вечером включишь…', 'Tonight you will put on…', [['Комедию', 'A comedy'], ['Детектив', 'A thriller'], ['Что-то доброе и знакомое', 'Something familiar and kind']]),
  q('secret', 'Умеешь хранить секреты?', 'Can you keep a secret?', [['Как сейф', 'Like a safe'], ['Расскажу только одному человеку', 'I tell just one person'], ['Лучше мне не рассказывать', 'Better not tell me']]),
  q('sport', 'Спорт в твоей жизни…', 'Sport in your life is…', [['Каждый день', 'Every day'], ['Когда есть настроение', 'When I feel like it'], ['Лестница считается?', 'Do stairs count?']]),
  q('sleep', 'Во сколько ты обычно засыпаешь?', 'When do you usually fall asleep?', [['До одиннадцати', 'Before eleven'], ['Около полуночи', 'Around midnight'], ['Ночь — моё время', 'Night is my time']]),
  q('shopping', 'Как ты делаешь покупки?', 'How do you shop?', [['Список и ничего лишнего', 'A list and nothing extra'], ['Иду за хлебом, выхожу с пакетом', 'Go for bread, leave with a bag'], ['Только онлайн', 'Online only']]),
  q('pet', 'Кошки или собаки?', 'Cats or dogs?', [['Кошки', 'Cats'], ['Собаки', 'Dogs'], ['Обе, и побольше', 'Both, and many']]),
  q('mood', 'Как тебе сегодняшний день?', 'How is today going?', [['Отлично', 'Great'], ['Нормально', 'Okay'], ['Бывало и лучше', 'Been better']]),
  q('food', 'Сладкое или солёное?', 'Sweet or salty?', [['Сладкое', 'Sweet'], ['Солёное', 'Salty'], ['И то и другое сразу', 'Both at once']]),
  q('book', 'Последняя прочитанная книга — это…', 'When did you last read a book?', [['Читаю прямо сейчас', 'Reading one now'], ['В этом месяце', 'This month'], ['Давно, но хочется', 'Long ago, but I want to']]),
  q('change', 'Перемены для тебя — это…', 'Change for you is…', [['Интересно', 'Exciting'], ['Тревожно', 'Unsettling'], ['Как повезёт', 'Depends']]),
  q('help', 'Если нужна помощь, ты…', 'When you need help, you…', [['Прошу сразу', 'Ask right away'], ['Справляюсь без помощи до последнего', 'Manage alone till the end'], ['Жду, что предложат', 'Wait for someone to offer']]),
  q('music', 'В наушниках сейчас…', 'In your headphones right now…', [['Музыка', 'Music'], ['Подкаст', 'A podcast'], ['Тишина', 'Silence']]),
  q('compliment', 'Какой комплимент приятнее?', 'Which compliment feels best?', [['Ты классно выглядишь', 'You look great'], ['Ты умный человек', 'You are smart'], ['С тобой легко', 'You are easy to be with']]),
  q('ex', 'С бывшими можно дружить?', 'Can you be friends with exes?', [['Да, почему нет', 'Yes, why not'], ['Только если прошло время', 'Only after some time'], ['Нет', 'No']]),
  q('cleaning', 'Уборка — это…', 'Cleaning is…', [['Медитация', 'Meditation'], ['Неизбежное зло', 'A necessary evil'], ['Когда придут гости', 'When guests are coming']]),
  q('city', 'Где хочется жить?', 'Where would you like to live?', [['В большом городе', 'In a big city'], ['В маленьком у воды', 'In a small town by the water'], ['В доме за городом', 'In a house out of town']]),
  q('promise', 'Новогодние обещания ты…', 'New Year promises — you…', [['Выполняю', 'Keep them'], ['Даю и забываю', 'Make and forget'], ['Не даю вовсе', 'Never make them']]),
];

/** The question of a day (Moscow date), the same for everyone. */
export function questionForDay(dayKey: string): DailyQuestion {
  const day = Math.round(Date.parse(`${dayKey}T12:00:00Z`) / 86_400_000);
  return DAILY_QUESTIONS[((day % DAILY_QUESTIONS.length) + DAILY_QUESTIONS.length) % DAILY_QUESTIONS.length];
}

export type QuestionResults = {
  scope: 'sign' | 'all' | null;
  total: number;
  percents: number[];
};

/** Percentages that add up to 100, shown only when the sample is big enough. */
export function buildQuestionResults(input: { optionCount: number; signCounts: number[]; allCounts: number[] }): QuestionResults {
  const signTotal = input.signCounts.reduce((sum, value) => sum + value, 0);
  const allTotal = input.allCounts.reduce((sum, value) => sum + value, 0);
  const [scope, counts, total] = signTotal >= SIGN_MIN_VOTES
    ? ['sign' as const, input.signCounts, signTotal]
    : allTotal >= ALL_MIN_VOTES ? ['all' as const, input.allCounts, allTotal] : [null, [], allTotal];
  if (!scope) return { scope: null, total, percents: [] };
  const raw = Array.from({ length: input.optionCount }, (_, index) => ((counts[index] ?? 0) / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return { scope, total, percents: floors };
}
