import type { Language } from '../types';

type MotivationTheme = 'work' | 'money' | 'knowledge' | 'friendship' | 'love' | 'life';

const POOLS: Record<Language, Record<MotivationTheme, string[]>> = {
  ru: {
    work: [
      'Сегодня лучше один завершённый шаг, чем пять начатых.',
      'Начни с самого простого дела — импульс подтянет остальное.',
      'Если задача кажется большой, разрежь её до одного действия на 15 минут.',
      'Не откладывай разговор, который блокирует работу.',
      'Закрой одну вкладку в голове — выбери один приоритет до обеда.',
    ],
    money: [
      'Не принимай финансовых решений на эмоциях до обеда.',
      'Сначала цифры, потом ощущения — так спокойнее.',
      'Мелкая трата сегодня не страшна; страшна — без плана.',
      'Проверь одну подписку или платёж, о котором давно забывал.',
      'Не сравнивай свой темп с чужими покупками в ленте.',
    ],
    knowledge: [
      'Спроси себя: что я хочу понять, а не доказать.',
      'Одна новая мысль сегодня важнее десяти прочитанных абзацев.',
      'Если не можешь объяснить просто — вернись к вопросу, не к ответу.',
      'Запиши одно «не знаю» — это честнее, чем угадывать.',
      'Учись там, где завтра пригодится, а не где красиво звучит.',
    ],
    friendship: [
      'Напиши тому, о ком думала сегодня утром.',
      'Короткое «как ты?» иногда важнее длинного совета.',
      'Не жди повода — повод уже есть.',
      'Если давно молчите, начни с одного конкретного воспоминания.',
      'Поддержка сегодня — это внимание, не лекция.',
    ],
    love: [
      'Говори прямо — намёки сегодня не работают.',
      'Сначала услышь, потом отвечай — так меньше недопонимания.',
      'Маленький жест внимания сильнее большого обещания.',
      'Не проверяй чувства догадками — спроси одним ясным вопросом.',
      'Тепло сегодня — в простых словах, не в драме.',
    ],
    life: [
      'Выбери одно «да» и одно спокойное «нет».',
      'День не обязан быть продуктивным, чтобы быть хорошим.',
      'Сделай паузу до того, как устанешь — не после.',
      'Один маленький порядок дома иногда успокаивает голову.',
      'Не гонись за идеальным днём — достаточно честного.',
    ],
  },
  en: {
    work: [
      'One finished step beats five started ones today.',
      'Start with the smallest task — momentum will follow.',
      'If it feels huge, shrink it to one 15-minute action.',
      'Do not postpone the conversation blocking your work.',
      'Pick one priority before lunch and protect it.',
    ],
    money: [
      'Avoid money decisions on emotion before lunch.',
      'Numbers first, feelings second — calmer that way.',
      'A small spend is fine; drifting without a plan is not.',
      'Review one subscription you keep forgetting about.',
      'Your pace is not their shopping cart.',
    ],
    knowledge: [
      'Ask what you want to understand, not what you want to prove.',
      'One real insight beats ten skimmed paragraphs.',
      'If you cannot explain it simply, revisit the question.',
      'Write down one honest “I do not know yet.”',
      'Learn where tomorrow needs you, not where it sounds impressive.',
    ],
    friendship: [
      'Text the person you thought about this morning.',
      'A short “how are you?” can matter more than a long advice speech.',
      'You do not need a reason — the reason is already there.',
      'If you have been quiet, start with one specific memory.',
      'Support today is attention, not a lecture.',
    ],
    love: [
      'Say it plainly — hints will not land today.',
      'Listen first, answer second — fewer misunderstandings.',
      'A small gesture beats a big promise.',
      'Do not test feelings with guesses — ask one clear question.',
      'Warmth today lives in simple words, not drama.',
    ],
    life: [
      'Choose one yes and one calm no.',
      'A day does not have to be productive to be good.',
      'Pause before you are empty, not after.',
      'One small bit of order at home can settle the mind.',
      'Skip the perfect day — aim for an honest one.',
    ],
  },
};

function hashDate(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return h;
}

function themeForWeekday(weekday: number): MotivationTheme {
  if (weekday === 1) return 'work';
  if (weekday === 2) return 'money';
  if (weekday === 3) return 'knowledge';
  if (weekday === 4) return 'friendship';
  if (weekday === 5) return 'love';
  return 'life';
}

export function getDailyMotivation(dateKey: string, language: Language): string {
  const lang = language === 'en' ? 'en' : 'ru';
  const [, , dayStr] = dateKey.split('-');
  const d = new Date(`${dateKey}T12:00:00`);
  const weekday = Number.isFinite(d.getTime()) ? d.getDay() : Number(dayStr) % 7;
  const theme = themeForWeekday(weekday);
  const pool = POOLS[lang][theme];
  return pool[hashDate(dateKey) % pool.length];
}

export function getTimeGreeting(language: Language, hour: number): string {
  const ru = language === 'ru';
  if (hour < 12) return ru ? 'Доброе утро' : 'Good morning';
  if (hour < 18) return ru ? 'Добрый день' : 'Good afternoon';
  return ru ? 'Добрый вечер' : 'Good evening';
}
