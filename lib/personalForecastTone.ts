/**
 * Catch clear problem-led forecast phrasing before it reaches the reader.
 * This is a narrow guard, not a sentiment classifier: the writer prompt remains
 * responsible for choosing a pleasant topic and an ordinary conversational voice.
 */
const NEGATIVE_FORECAST_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['TENSION', /(?:напряж[её]нн\p{L}*\s+(?:день|недел\p{L}*|месяц\p{L}*|обстановк\p{L}*|разговор\p{L}*)|напряжени\p{L}*[^.!?\n]{0,45}(?:раст[её]т|нараст\p{L}*|усил\p{L}*|спад\p{L}*|копит\p{L}*|порт\p{L}*)|(?:чувству\p{L}*|ощуща\p{L}*|сним\p{L}*)\s+напряжени\p{L}*)/iu],
  ['CONFLICT', /(?:(?:спор|ссор|конфликт)\p{L}*[^.!?\n]{0,45}(?:разгор\p{L}*|обостр\p{L}*|нараст\p{L}*|испорт\p{L}*|неизбеж\p{L}*)|(?:разгор\p{L}*|обостр\p{L}*|избег\p{L}*)[^.!?\n]{0,35}(?:спор|ссор|конфликт)\p{L}*|разду\p{L}*\s+разговор\p{L}*|разговор\p{L}*[^.!?\n]{0,60}(?:легко\s+)?(?:обостр\p{L}*|перераст\p{L}*\s+в\s+(?:спор|ссор)\p{L}*|разду\p{L}*|заводиш\p{L}*))/iu],
  ['IRRITATION', /(?:терпени\p{L}*\s+на\s+нуле|(?:мелоч\p{L}*|чуж\p{L}*\s+медлительност\p{L}*|задержк\p{L}*|вс[её])[^.!?\n]{0,35}раздраж\p{L}*|раздраж\p{L}*[^.!?\n]{0,45}(?:мелоч\p{L}*|ожидан\p{L}*|медлительност\p{L}*|задержк\p{L}*|сильнее|когда\s+тянут\s+резину)|легко\s+(?:раздража\p{L}*|вспыл\p{L}*|сорв\p{L}*))/iu],
  ['OVERLOAD', /(?:не\s+тащи\s+вс[её]\s+на\s+себе|(?:взять|брать|бер[её]шь|возьм[её]шь)\s+на\s+себя\s+больше[^.!?\n]{0,35}(?:успе\p{L}*|мож\p{L}*)|(?:дел\p{L}*|задач\p{L}*|обязанност\p{L}*)[^.!?\n]{0,35}(?:навал\p{L}*|слишком\s+много|перегруз\p{L}*)|(?:усталост\p{L}*|перегрузк\p{L}*)[^.!?\n]{0,35}(?:накоп\p{L}*|нараст\p{L}*|усил\p{L}*))/iu],
  ['FEAR_OR_FAILURE', /(?:(?:тревог\p{L}*|стресс\p{L}*|страх\p{L}*)[^.!?\n]{0,35}(?:нараст\p{L}*|усил\p{L}*|не\s+отпуск\p{L}*|накро\p{L}*)|(?:предсто\p{L}*|ожида\p{L}*|жд[её]т)\s+(?:трудн\p{L}*|тяж[её]л\p{L}*)\s+(?:день|недел\p{L}*|месяц\p{L}*|период\p{L}*)|вс[её]\s+(?:пойд[её]т|ид[её]т)\s+не\s+по\s+плану)/iu],
  ['WARNING_LED', /(?:не\s+обещай\s+лишнего|не\s+бери\s+на\s+себя\s+нов\p{L}*\s+обязательств\p{L}*|(?:осторожнее|будь\s+осторож\p{L}*)\s+с\s+(?:люд\p{L}*|слов\p{L}*|решени\p{L}*|деньг\p{L}*)|сначала\s+(?:сверь|проверь)\s+детали[^.!?\n]{0,35}(?:обеща\p{L}*|соглаша\p{L}*))/iu],
  ['ENGLISH_PROBLEM_LED', /(?:\b(?:tension|stress|anxiety)\s+(?:will\s+)?(?:rise|grow|build|ease|fade)\b|\b(?:argument|conflict)\s+(?:will\s+)?(?:escalate|erupt)\b|\bdon't\s+take\s+on\s+more\s+than\s+you\s+can\b|\bpatience\s+(?:is\s+)?(?:running\s+out|at\s+zero)\b)/iu],
  ['ASTROLOGY_JARGON', /(?:натальн\p{L}*\s+(?:карт\p{L}*|планет\p{L}*)|транзит\p{L}*\s+(?:планет\p{L}*|сатурн\p{L}*|юпитер\p{L}*|марс\p{L}*|венер\p{L}*|меркур\p{L}*|солнц\p{L}*|лун\p{L}*)|(?:венер\p{L}*|марс\p{L}*|меркур\p{L}*|сатурн\p{L}*|юпитер\p{L}*|лун\p{L}*|солнц\p{L}*)\s+(?:в\s+)?(?:трин\p{L}*|секстил\p{L}*|оппозиц\p{L}*|квадрат\p{L}*|соединени\p{L}*)|(?:трин\p{L}*|секстил\p{L}*|оппозиц\p{L}*|квадрат\p{L}*)\s+(?:к|с|между)\s+(?:тво\p{L}*\s+)?(?:венер\p{L}*|марс\p{L}*|меркур\p{L}*|сатурн\p{L}*|юпитер\p{L}*|лун\p{L}*|солнц\p{L}*))/iu],
];

/** Returns diagnostic categories only; never logs or stores forecast text. */
export function getPersonalForecastToneViolationCodes(text: string): string[] {
  return NEGATIVE_FORECAST_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
}
