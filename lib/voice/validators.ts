/** Canonical global validators for the NEBO voice. */
export const CORE_VOICE_MYSTICISM_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\\p{L}])карм(?:а|ы|е|у|ой|ою|ическ\\p{L}*)(?!\\p{L})/iu,
  /чакр|астрал|эзотери|вселенн|мироздан|вибрац|сакральн|магич|предначертан|высшие\\s+силы|тонкие\\s+матери|духовн[а-яё]*\\s+пут/iu,
  /(?:^|[^\\p{L}])(?:космос\\p{L}*|аур\\p{L}*|судьб\\p{L}*|знак\\p{L}*\\s+свыше)(?!\\p{L})/iu,
  /\\b(?:karma|chakra|astral|esoteric|universe|cosmos|vibration|sacred|magic|predestined|higher\\s+powers|spiritual\\s+path|aura|fate|sign\\s+from\\s+above)\\b/iu,
];

export const CORE_VOICE_CLICHE_PATTERNS: readonly RegExp[] = [
  /(?<![а-яё])(?:не\\s+спеши|не\\s+торопись)(?![а-яё])|замедл[а-яё]*/iu,
  /прислуша[а-яё]*\\s+к\\s+себе|доверь[а-яё]*\\s+(?:себе|своему\\s+пути|потоку)/iu,
  /позволь[а-яё]*\\s+себе|отпусти[а-яё]*\\s+контрол|будь\\s+в\\s+моменте/iu,
  /поберег[а-яё]*\\s+(?:внутренн[а-яё]*\\s+)?ресурс|ресурсн(?:ое|ый|ая)\\s+состояни|внутренн(?:ий|яя)\\s+ресурс/iu,
  /энерги[яи]\\s+(?:дня|периода|карты|отношений)|ритм\\s+дня|сфер[аы]\\s+дня/iu,
  /сохраня[а-яё]*\\s+баланс|раскр[а-яё]*\\s+(?:свой\\s+)?потенциал|нов[а-яё]*\\s+уровен/iu,
  /проработ[а-яё]*|исцелени[а-яё]*|внутренн(?:ий|его)\\s+реб[её]н/iu,
  /вс[её]\\s+станет\\s+понятно|вс[её]\\s+встанет\\s+на\\s+свои\\s+места/iu,
  /возьми\\s+пауз|дай\\s+себе\\s+время|один\\s+разговор\\s+покажет/iu,
  /это\\s+читается\\s+через|может\\s+проявляться|здесь\\s+описывается|полезно\\s+проверить|тема\\s+связана\\s+с|день\\s+просит/iu,
  /активн[а-яё]*\\s+(?:тем|сфер|част|энерг)|что\\s+из\\s+этого\\s+активно\\s+сейчас|проявля[а-яё]*\\s+сильнее/iu,
  /повторяющ[а-яё]*\\s+(?:тем|сценари|паттерн)|внутренн[а-яё]*\\s+рисунок|постоянн[а-яё]*\\s+рисунок/iu,
  /карта\\s+сложилась|это\\s+про\\s+тебя|внутренняя\\s+точность|чужой\\s+шум|выбрать\\s+из\\s+ясности/iu,
  /сыграет\\s+тебе\\s+на\\s+руку|где\\s+у\\s+тебя\\s+больше\\s+шансов|что\\s+стоит\\s+заметить|какой\\s+момент\\s+дня/iu,
  /период\\s+выводит\\s+на\\s+первый\\s+план|главный\\s+вызов\\s+(?:дня|недели|месяца)|точка\\s+опоры|внешняя\\s+реализац|проверка\\s+фактов|сохраняй\\s+гибкость/iu,
  /\\b(?:slow\\s+down|do\\s+not\\s+rush|listen\\s+to\\s+yourself|allow\\s+yourself|let\\s+go\\s+of\\s+control|be\\s+present|protect\\s+your\\s+energy|trust\\s+the\\s+flow|keep\\s+your\\s+balance|unlock\\s+your\\s+potential|reach\\s+the\\s+next\\s+level|everything\\s+will\\s+become\\s+clear)\\b/iu,
  /\\b(?:energy\\s+of\\s+the\\s+day|active\\s+theme|inner\\s+pattern|recurring\\s+patterns|the\\s+chart\\s+has\\s+come\\s+together|this\\s+is\\s+so\\s+you|day\\s+asks|inner\\s+precision|outside\\s+noise|choose\\s+from\\s+clarity)\\b/iu,
];

export function hasCoreVoiceMysticism(text: string): boolean {
  return !!text && CORE_VOICE_MYSTICISM_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasCoreVoiceCliche(text: string): boolean {
  return !!text && CORE_VOICE_CLICHE_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasCoreVoiceViolation(text: string): boolean {
  return hasCoreVoiceMysticism(text) || hasCoreVoiceCliche(text);
}
