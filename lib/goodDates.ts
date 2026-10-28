/**
 * «Хорошие даты»: the best days of the coming weeks for one activity.
 * Each activity is scored on the same lunar rules as the Moon calendars, plus Mercury and Venus going backwards,
 * the weekday tradition and the person's Sun sign (the Moon in the Sun's element helps, a square to it gets in the way).
 */
import { makeDealOperation, operationById, SIGNS_IN, type LunarDay, type Operation } from './lunarCalendar';

type Extra = {
  /** How much a backwards Venus hurts this activity. */
  ven?: number;
  /** How much a backwards Mercury hurts this activity. */
  mx?: number;
  /** Weekday bonus, 0 = Monday. */
  wd?: Partial<Record<number, number>>;
  wdText?: Partial<Record<number, string>>;
  give: string;
  mercText?: string;
  venusText?: string;
};

type Topic = { name: string; sticker: string; op: Operation; extra: Extra; phase: 'wax' | 'wane' | null };

const deal = (id: string) => operationById(id)!;
const custom = (name: string, good: number[], options: { merc?: boolean; anyPhase?: boolean } = {}) => makeDealOperation(name, good, options);

const T = (name: string, sticker: string, op: Operation, extra: Extra, phase: 'wax' | 'wane' | null = 'wax'): Topic => ({ name, sticker, op, extra, phase });

export const DATE_TOPIC_GROUPS: ReadonlyArray<{ title: string; topics: Topic[] }> = [
  { title: 'Любовь', topics: [
    T('Свидание', 'heart', deal('date'), { ven: 1, wd: { 4: 1 }, give: 'рядом с тобой будет легко, и разговор пойдёт сам', venusText: 'новые знакомства чаще быстро гаснут, зато возвращаются старые истории' }, null),
    T('Признаться', 'loveletter', custom('Признаться', [4, 6, 11, 3], { anyPhase: true }), { ven: 1, mx: 0.5, wd: { 4: 1 }, give: 'слова прозвучат тепло, и их поймут правильно', mercText: 'слова легко понять не так', venusText: 'чувства путаются, и ответ может быть неясным' }, null),
    T('Свадьба', 'rings', custom('Свадьба', [1, 3, 6, 4], { merc: true }), { ven: 3, wd: { 4: 0.5, 5: 0.5 }, give: 'день выдержит и праздник, и долгую жизнь после него', mercText: 'чаще путаница с документами и планами', venusText: 'дату свадьбы на эти недели обычно не назначают' }),
    T('Переезд вместе', 'house', deal('move'), { mx: 1, give: 'общий дом начнётся спокойно, без бытовых ссор', mercText: 'переезды затягиваются, теряются вещи и документы' }),
    T('Первое знакомство', 'chats', custom('Первое знакомство', [2, 6, 4, 10, 8], { anyPhase: true }), { ven: 1, wd: { 4: 0.5 }, give: 'разговор завяжется сам, без неловких пауз', venusText: 'новое знакомство чаще быстро гаснет' }, null),
    T('Помолвка', 'rings', custom('Помолвка', [1, 3, 6, 4, 11], { merc: true }), { ven: 2.5, wd: { 4: 1 }, give: 'обещание прозвучит серьёзно и запомнится', mercText: 'планы и кольцо чаще приходится переделывать', venusText: 'с такими обещаниями лучше подождать, пока Венера снова не пойдёт вперёд' }),
    T('Серьёзный разговор', 'chats', custom('Серьёзный разговор', [6, 2, 10, 5, 9], { anyPhase: true, merc: true }), { give: 'тебя выслушают и не перебьют, получится договориться', mercText: 'слова понимают не так, приходится объяснять заново' }, null),
    T('Помириться', 'heart', custom('Помириться', [6, 11, 3, 1], { anyPhase: true }), { ven: -0.5, wd: { 4: 0.5 }, give: 'старую обиду легче отпустить, а первый шаг примут' }, null),
  ] },
  { title: 'Работа и деньги', topics: [
    T('Собеседование', 'person', deal('talk'), { mx: 1, wd: { 3: 0.5, 2: 0.5 }, give: 'тебя услышат с первого раза и запомнят', mercText: 'встречи чаще переносят и путают детали. Если дату не выбрать, просто перепроверь время и адрес' }, null),
    T('Новая работа', 'briefcase', deal('project'), { mx: 1, wd: { 0: 0.5 }, give: 'начало пройдёт гладко, и с командой быстро найдёшь общий язык', mercText: 'в первые дни путаются задачи и доступы' }),
    T('Подписать договор', 'doc', deal('contracts'), { mx: 1, wd: { 2: 0.5, 3: 0.5 }, give: 'договорённости не придётся переделывать', mercText: 'договоры часто приходится переделывать и переподписывать' }),
    T('Важные переговоры', 'chats', deal('talk'), { mx: 1, wd: { 2: 0.5 }, give: 'найдёте вариант, который устроит обе стороны', mercText: 'стороны понимают друг друга не так, и договорённости плывут' }, null),
    T('Попросить повышение', 'chart', deal('money'), { mx: 0.5, wd: { 3: 1 }, give: 'просьба прозвучит уверенно, и её поддержат', mercText: 'разговор легко отложат на потом' }),
    T('Запустить проект', 'rocket', deal('project'), { mx: 1, wd: { 1: 0.5, 6: 0.5 }, give: 'старт получит хороший разгон', mercText: 'запуски чаще переносят и доделывают на ходу' }),
    T('Открыть своё дело', 'rocket', deal('project'), { mx: 1, ven: 0.5, wd: { 3: 0.5 }, give: 'дело встанет на ноги и будет расти', mercText: 'регистрация и документы чаще затягиваются' }),
    T('Уволиться', 'door', deal('finish'), { wd: { 5: 0.5 }, give: 'уйдёшь спокойно и без лишних обид' }, 'wane'),
    T('Вложить деньги', 'chart', deal('money'), { mx: 1, ven: 1, wd: { 3: 0.5 }, give: 'деньги будут работать, а не утекать', mercText: 'в цифрах и условиях легче ошибиться', venusText: 'легко переоценить вложение' }),
    T('Взять кредит', 'doc', deal('contracts'), { mx: 1, give: 'условия будут понятными, без неприятных сюрпризов', mercText: 'в договоре легче пропустить важное условие' }),
  ] },
  { title: 'Покупки и дом', topics: [
    T('Крупная покупка', 'bag', deal('buy'), { mx: 0.5, ven: 0.5, give: 'покупка прослужит долго, и о цене не пожалеешь', mercText: 'покупки чаще возвращают или о них жалеют' }),
    T('Техника и авто', 'car', custom('Техника и авто', [2, 5, 10, 9, 1], { merc: true }), { mx: 1.5, give: 'техника будет работать без сюрпризов', mercText: 'техника чаще попадается с браком и ломается' }),
    T('Переезд', 'box', deal('move'), { mx: 1, give: 'переезд пройдёт без потерь и задержек', mercText: 'переезды затягиваются, теряются вещи и документы' }),
    T('Ремонт', 'roller', deal('repair'), { wd: { 5: 0.5 }, give: 'работа пойдёт по плану, без переделок' }, 'wane'),
    T('Купить жильё', 'house', deal('buy'), { mx: 1.5, ven: 0.5, give: 'в новом доме будет спокойно и надёжно', mercText: 'в документах и сделке легче пропустить важное' }),
    T('Одежда и обновки', 'bag', custom('Одежда и обновки', [1, 6, 4, 5]), { ven: 2, wd: { 4: 1 }, give: 'обновка будет радовать долго', venusText: 'обновки быстро разонравятся' }),
    T('Новоселье', 'box', custom('Новоселье', [3, 4, 6, 8, 1]), { wd: { 4: 1, 5: 1 }, wdText: { 5: 'суббота, гости соберутся легко' }, give: 'гостям будет тепло, а в доме весело' }),
  ] },
  { title: 'Для себя', topics: [
    T('Стрижка и уход', 'scissors', operationById('hair_grow')!, { ven: 0.5, give: 'волосы будут отрастать быстрее и лучше держать форму', venusText: 'с резкой сменой образа лучше подождать' }),
    T('Спорт и привычка', 'dumbbell', custom('Спорт и привычка', [0, 4, 8, 9]), { wd: { 1: 1 }, give: 'хватит сил, и привычка приживётся' }),
    T('Учёба и экзамен', 'cap', custom('Учёба и экзамен', [2, 5, 10, 8, 9], { anyPhase: true, merc: true }), { wd: { 2: 1 }, give: 'голова ясная, и нужное вспомнится вовремя', mercText: 'легко перепутать даты и задания, зато хорошо повторять пройденное' }, null),
    T('Путешествие', 'plane', deal('travel'), { mx: 0.5, wd: { 3: 0.5 }, give: 'дорога будет лёгкой, без задержек', mercText: 'чаще задержки и путаница с билетами, проверь брони дважды' }),
    T('Праздник и гости', 'popper', custom('Праздник и гости', [4, 6, 8, 1, 3], { anyPhase: true }), { wd: { 4: 1, 5: 1, 6: 0.5 }, wdText: { 5: 'суббота, гости соберутся легко', 6: 'воскресенье, день отдыха' }, give: 'всем будет весело и легко' }, null),
    T('День для себя', 'leaf', operationById('massage')!, { wd: { 6: 0.5, 0: 0.5 }, wdText: { 6: 'воскресенье, день отдыха' }, give: 'отдых правда восстановит силы' }, 'wane'),
    T('Начать диету', 'apple', operationById('detox')!, { wd: { 0: 0.5 }, give: 'держаться легче, и вес уходит охотнее' }, 'wane'),
    T('Визит к врачу', 'shield', operationById('surgery')!, { give: 'обследование пройдёт спокойно, а результатам можно доверять' }, 'wane'),
  ] },
  { title: 'Удача', topics: [
    T('Игра на деньги', 'dice', custom('Игра на деньги', [4, 8, 0]), { wd: { 3: 1.5, 6: 1 }, give: 'удача на твоей стороне. Ставь только то, что не жалко потерять' }),
    T('Конкурс и розыгрыш', 'gift', custom('Конкурс и розыгрыш', [4, 8, 6, 2]), { mx: 0.5, wd: { 3: 1 }, give: 'тебя заметят среди других', mercText: 'заявки теряются и приходят с ошибками' }),
    T('Подать заявку', 'doc', deal('contracts'), { mx: 1, wd: { 2: 1 }, give: 'заявку прочитают внимательно, и она не потеряется', mercText: 'заявки теряются и возвращаются с ошибками' }),
    T('Публичное выступление', 'star', custom('Публичное выступление', [4, 2, 8, 6, 0], { anyPhase: true, merc: true }), { wd: { 6: 0.5, 2: 0.5 }, give: 'тебя будут слушать, и речь запомнится', mercText: 'техника подводит, а слова путаются' }, null),
  ] },
];

export const DATE_TOPICS: Topic[] = DATE_TOPIC_GROUPS.flatMap((group) => group.topics);

export function findTopic(name: string): Topic | null {
  return DATE_TOPICS.find((topic) => topic.name === name) ?? null;
}

const SIGN_DAY = ['день смелых решений', 'день спокойных и надёжных дел', 'день разговоров и новостей', 'день дома и близких', 'день, когда легко быть заметным', 'день точности и порядка', 'день договорённостей и красоты', 'день честных разговоров', 'день планов и дороги', 'день серьёзных дел', 'день идей и друзей', 'день мягкости и чувств'];
const WD_DAY = ['понедельник, день дома и заботы', 'вторник, день сил и движения', 'среда, день разговоров и учёбы', 'четверг, по традиции день удачи', 'пятница, по традиции день любви и красоты', 'суббота, чтобы довести дело до конца', 'воскресенье, день, когда тебя замечают'];

export type ScoredDay = { day: LunarDay; score: number; verdict: readonly [0 | 1 | 2, string]; category: 'best' | 'good' | 'neutral' | 'avoid' };

/** Scores every day for the topic. `sunSign` 0-11 brings the person's chart in. */
export function scoreDays(topic: Topic, days: LunarDay[], sunSign: number | null): ScoredDay[] {
  return days.map((day) => {
    const verdict = topic.op.evaluate(day);
    const extra = topic.extra;
    let score = verdict[0] + (extra.wd?.[day.weekday] ?? 0) * 0.5;
    if (day.venusRetrograde && extra.ven) score -= extra.ven * 0.5;
    if (day.mercuryRetrograde && extra.mx) score -= extra.mx * 0.75;
    if (sunSign !== null) {
      if (day.sign % 4 === sunSign % 4) score += 0.25;
      else if ((day.sign - sunSign + 12) % 12 === 3 || (day.sign - sunSign + 12) % 12 === 9) score -= 0.25;
    }
    const exactBlocks = Boolean(day.exact) && topic.op.id !== 'detox';
    const category: ScoredDay['category'] = verdict[0] === 0 || score <= 0.5 || exactBlocks ? 'avoid' : score >= 1.75 ? 'good' : 'neutral';
    return { day, score, verdict, category };
  });
}

/** The days to show: the best one, then good ones by score. */
export function rankDays(scored: ScoredDay[], fromKey: string): ScoredDay[] {
  const ahead = scored.filter((item) => item.day.dayKey >= fromKey && item.category === 'good');
  const sorted = [...ahead].sort((a, b) => b.score - a.score || a.day.dayKey.localeCompare(b.day.dayKey));
  if (sorted[0]) sorted[0] = { ...sorted[0], category: 'best' };
  return sorted;
}

export function goodDayCount(topic: Topic, days: LunarDay[], sunSign: number | null, fromKey: string): number {
  return rankDays(scoreDays(topic, days, sunSign), fromKey).length;
}

/** Plain reasons why the day suits the activity. */
export function whyGood(topic: Topic, item: ScoredDay): string[] {
  const { day } = item;
  const parts: string[] = [];
  parts.push(SIGN_DAY[day.sign]);
  if (topic.phase === 'wax' && day.waxing) parts.push('Луна растёт');
  else if (topic.phase === 'wane' && !day.waxing) parts.push('Луна убывает');
  if (topic.extra.mx && !day.mercuryRetrograde) parts.push('Меркурий идёт вперёд');
  if (topic.extra.ven && topic.extra.ven > 0 && !day.venusRetrograde) parts.push('Венера идёт вперёд');
  const wd = topic.extra.wd?.[day.weekday];
  if (wd) parts.push(topic.extra.wdText?.[day.weekday] ?? WD_DAY[day.weekday]);
  return parts;
}

export function whyBad(topic: Topic, item: ScoredDay): string {
  const { day } = item;
  if (day.exact) return day.exact.q === 2 ? 'Полнолуние: эмоции на пике, решения бывают поспешными' : 'Новолуние: время планировать, а не начинать';
  if (day.eclipse) return 'Рядом затмение: важное лучше сдвинуть';
  if (day.mercuryRetrograde && topic.extra.mx) return `Ретроградный Меркурий: ${topic.extra.mercText || 'всё важное перепроверяй дважды'}`;
  if (day.venusRetrograde && (topic.extra.ven ?? 0) >= 1) return `Венера идёт назад: ${topic.extra.venusText || 'с этим лучше подождать'}`;
  return item.verdict[1] || `Луна ${SIGNS_IN[day.sign]}: день средний`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type { Topic as DateTopic };
