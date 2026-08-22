/**
 * The shared runtime voice for user-facing AI content.
 * Product-specific layers may sharpen it without changing the global tone.
 */

export const APP_VOICE_VERSION = '10';
export const PERSONAL_FORECAST_VOICE_VERSION = '7';

const APP_SYSTEM_VOICE_RU = `## ГОЛОС ПРИЛОЖЕНИЯ «ТВОЙ ГОРОСКОП»

Говори с человеком на «ты»: точно, спокойно, живо и без церемоний. Это разговор умного союзника, который превращает надёжный личный контекст в понятный рассказ, а не угадывает судьбу.

- Сразу называй главный вывод, затем показывай узнаваемое проявление в жизни.
- Используй только переданный надёжный контекст. Не придумывай события, биографию, мотивы, диагнозы, травмы или астрологические факты.
- В основном пользовательском тексте переводи контекст в обычный язык жизни. Астрологические термины допустимы только в явно запрошенном техническом пояснении.
- Не повторяй мысль другими словами и не раздувай текст вступлениями, оговорками или универсальными советами.
- Пиши как короткую личную заметку с живой сценой, а не как отчёт, разбор компетенций или служебную сводку. Сцена может быть узнаваемой, но не выдумывай события и биографию.
- Без эзотерики, «энергий», «вибраций», коучинговой жвачки, канцелярита и искусственного молодёжного сленга.
- Не делай тревогу, конфликт или риск обязательной темой. Хорошие возможности называй так же прямо, как ограничения.
- Не упоминай конкретных родственников или партнёров в негативном ключе. Если нужен контекст близости, говори обобщённо.
- Дерзость — это точный вывод и честная формулировка, не хамство и не кликбейт.
- Если фразу можно удалить без потери смысла — удали её.

Не используй технические заголовки «Общий фон», «Личный гороскоп», «Главное», «Энергия дня», «Что делать» или «Вечер». Заголовок нужен только когда он действительно помогает читать.`;

const APP_SYSTEM_VOICE_EN = `## THE VOICE OF “YOUR HOROSCOPE”

Address the reader as “you”: precise, calm, vivid, and direct. You are an intelligent ally turning trusted personal context into a clear story, never guessing a fate.

- State the main conclusion first, then show a recognisable real-life manifestation.
- Use only supplied trusted context. Never invent events, biography, motives, diagnoses, trauma, or astrological facts.
- Translate context into ordinary real-life language in the main user-facing copy. Astrology terminology is allowed only in an explicitly requested technical explanation.
- Do not repeat an idea in different words or inflate the text with introductions, caveats, or universal advice.
- Write like a short personal note with a living scene, never like a report, competency assessment, or executive summary. A scene may be recognisable, but never invent an event or biography.
- No mysticism, cosmic-energy language, coaching filler, corporate prose, or artificial youth slang.
- Do not make anxiety, conflict, or risk mandatory. Name good opportunities as directly as constraints.
- Never single out relatives or partners negatively. Use general interpersonal language if context is needed.
- Bold means precise and honest, never rude or clickbait.
- If a sentence can be removed without losing meaning, remove it.

Do not use the technical headings “General background”, “Personal horoscope”, “Main point”, “Energy of the day”, “What to do”, or “Evening”. Use a heading only when it makes the reading easier to scan.`;

const APP_VOICE_MYSTICISM_PATTERNS: readonly RegExp[] = [
  /карм|чакр|астрал|эзотери|вселенн|мироздан|вибрац|сакральн|магич|предначертан|высшие\s+силы|тонкие\s+матери|духовн[а-яё]*\s+пут/iu,
  /\b(?:karma|chakra|astral|esoteric|universe|cosmos|vibration|sacred|magic|predestined|higher\s+powers|spiritual\s+path)\b/iu,
];

const APP_VOICE_CLICHE_PATTERNS: readonly RegExp[] = [
  /(?<![а-яё])(?:не\s+спеши|не\s+торопись)(?![а-яё])|замедл[а-яё]*/iu,
  /прислуша[а-яё]*\s+к\s+себе|доверь[а-яё]*\s+(?:себе|своему\s+пути|потоку)/iu,
  /позволь[а-яё]*\s+себе|отпусти[а-яё]*\s+контрол|будь\s+в\s+моменте/iu,
  /поберег[а-яё]*\s+(?:внутренн[а-яё]*\s+)?ресурс|ресурсн(?:ое|ый|ая)\s+состояни|внутренн(?:ий|яя)\s+ресурс/iu,
  /энерги[яи]\s+(?:дня|периода|карты|отношений)|ритм\s+дня|сфер[аы]\s+дня/iu,
  /сохраня[а-яё]*\s+баланс|раскр[а-яё]*\s+(?:свой\s+)?потенциал|нов[а-яё]*\s+уровен/iu,
  /проработ[а-яё]*|исцелени[а-яё]*|внутренн(?:ий|его)\s+реб[её]н/iu,
  /вс[её]\s+станет\s+понятно|вс[её]\s+встанет\s+на\s+свои\s+места/iu,
  /возьми\s+пауз|дай\s+себе\s+время|один\s+разговор\s+покажет/iu,
  /это\s+читается\s+через|может\s+проявляться|здесь\s+описывается|полезно\s+проверить|тема\s+связана\s+с|день\s+просит/iu,
  /активн[а-яё]*\s+(?:тем|сфер|част|энерг)|что\s+из\s+этого\s+активно\s+сейчас|проявля[а-яё]*\s+сильнее/iu,
  /повторяющ[а-яё]*\s+(?:тем|сценари|паттерн)|внутренн[а-яё]*\s+рисунок|постоянн[а-яё]*\s+рисунок/iu,
  /карта\s+сложилась|это\s+про\s+тебя|внутренняя\s+точность|чужой\s+шум|выбрать\s+из\s+ясности/iu,
  /сыграет\s+тебе\s+на\s+руку|где\s+у\s+тебя\s+больше\s+шансов|что\s+стоит\s+заметить|какой\s+момент\s+дня/iu,
  /период\s+выводит\s+на\s+первый\s+план|главный\s+вызов\s+(?:дня|недели|месяца)|точка\s+опоры|внешняя\s+реализац|финансовые\s+решения\s+и\s+договор[её]нности\s+требуют|проверка\s+фактов|сохраняй\s+гибкость/iu,
  /\b(?:slow\s+down|do\s+not\s+rush|do\s+not\s+scatter\s+yourself|listen\s+to\s+yourself|allow\s+yourself|let\s+go\s+of\s+control|be\s+present|protect\s+your\s+energy|trust\s+the\s+flow|keep\s+your\s+balance|unlock\s+your\s+potential|reach\s+the\s+next\s+level|everything\s+will\s+become\s+clear)\b/iu,
  /\b(?:energy\s+of\s+the\s+day|active\s+theme|inner\s+pattern|recurring\s+patterns|the\s+chart\s+has\s+come\s+together|this\s+is\s+so\s+you|day\s+asks|inner\s+precision|outside\s+noise|choose\s+from\s+clarity)\b/iu,
  /\b(?:the\s+period\s+brings\s+.+\s+to\s+the\s+foreground|main\s+challenge\s+of\s+the\s+(?:day|week|month)|point\s+of\s+support|external\s+realisation|executive\s+summary)\b/iu,
];

export function getAppSystemVoice(language: 'ru' | 'en' = 'ru'): string {
  return language === 'en' ? APP_SYSTEM_VOICE_EN : APP_SYSTEM_VOICE_RU;
}

const PERSONAL_FORECAST_VOICE_VIOLATION_PATTERNS: readonly RegExp[] = [
  /не\s+пряч\p{L}*[^.!?]{0,60}(?:идеальн\p{L}*|совершенств\p{L}*)/iu,
  /(?:черновик\p{L}*[^.!?]{0,40}попал\p{L}*\s+в\s+яблочк\p{L}*|маршрут\p{L}*[^.!?]{0,40}крюк\p{L}*|втор(?:ая|ую)\s+жизн\p{L}*|дистанц\p{L}*[^.!?]{0,40}сда[её]т\p{L}*|вариант\p{L}*[^.!?]{0,25}вариант\p{L}*)/iu,
  /(?:дом\p{L}*\s+выдох\p{L}*|дому\s+станет\s+легче|домашн\p{L}*\s+революц\p{L}*|жилищ\p{L}*[^.!?]{0,100}освобожд\p{L}*\s+мест\p{L}*|освобод\p{L}*[^.!?]{0,60}(?:мест\p{L}*|участ\p{L}*)[^.!?]{0,60}дом\p{L}*)/iu,
  /(?:^|[^\p{L}])(?:ресурс\p{L}*|проявленност\p{L}*|поток\p{L}*|осознанност\p{L}*|заземл\p{L}*|экологичн\p{L}*|гештальт\p{L}*|внутренн\p{L}*\s+реб[её]н\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:космос\p{L}*|аур\p{L}*|судьб\p{L}*|знак\p{L}*\s+свыше)(?!\p{L})/iu,
  /(?:^|[^\p{L}])зв[её]зд\p{L}*\s+(?:обещают|говорят|подсказывают|советуют|предсказывают)(?!\p{L})/iu,
  /(?:твоя|ваша)\s+карт[аы]\s+(?:показывает|говорит|подсказывает)|по\s+(?:твоей|вашей)\s+карт[еы]/iu,
  /твоя\s+сил[аы][^\p{L}\p{N}]{1,6}в\s+спокойн\p{L}*\s+присутстви\p{L}*|внутренн\p{L}*\s+(?:ясност|облегчени|состояни)\p{L}*|(?:опор\p{L}*\s+внутри|внутренн\p{L}*\s+опор\p{L}*)|пространств\p{L}*\s+для\s+(?:себя|своих\s+чувств|чувств)|разобра\p{L}*\s+в\s+себе/iu,
  /\b(?:the\s+stars\s+(?:promise|say|suggest|predict)|step\s+into\s+your\s+power|trust\s+the\s+flow|listen\s+to\s+yourself|allow\s+yourself|be\s+present|inner\s+child|close\s+the\s+gestalt|your\s+chart\s+(?:shows|says|suggests)|according\s+to\s+your\s+chart)\b/iu,
  /\b(?:your\s+strength\s+is\s+in\s+calm\s+presence|inner\s+clarity|inner\s+support|make\s+space\s+for\s+(?:yourself|your\s+feelings))\b/iu,
  /\b(?:aura|fate|sign\s+from\s+above)\b/iu,
];

export function hasAppVoiceMysticism(text: string): boolean {
  return APP_VOICE_MYSTICISM_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasAppVoiceCliche(text: string): boolean {
  return APP_VOICE_CLICHE_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasAppVoiceViolation(text: string): boolean {
  return hasAppVoiceMysticism(text) || hasAppVoiceCliche(text);
}

export function hasPersonalForecastVoiceViolation(text: string): boolean {
  return hasAppVoiceViolation(text)
    || PERSONAL_FORECAST_VOICE_VIOLATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function withAppVoiceVersion(baseVersion: string): string {
  return `${baseVersion}+voice.${APP_VOICE_VERSION}`;
}

export function withPersonalForecastVoiceVersion(baseVersion: string): string {
  return `${baseVersion}+forecast-voice.${PERSONAL_FORECAST_VOICE_VERSION}`;
}

export function withAppVoiceCacheKey(baseKey: string): string {
  return `${baseKey}:voice:${APP_VOICE_VERSION}`;
}
