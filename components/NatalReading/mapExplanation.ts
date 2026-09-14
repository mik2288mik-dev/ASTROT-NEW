import { buildNatalChartWheelModel, normalizeNatalWheelLongitude, type NatalChartWheelSource, type NatalChartWheelPoint, type NatalChartWheelAspect } from '../../lib/natalChartWheelModel';

export const MAP_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const MAP_SIGN_NAMES = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
const SIGNS_IN = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];
const SIGN_WAYS = [
  'тебе проще начать сразу и разобраться по ходу дела',
  'тебе ближе спокойный темп, надёжность и то, что можно увидеть и потрогать',
  'тебе легче через разговор, вопросы и сравнение разных вариантов',
  'для тебя особенно важны близость, привычная обстановка и личное отношение',
  'тебе хочется выразить себя открыто и видеть, что твой вклад замечают',
  'тебе проще через внимание к деталям и понятную пользу',
  'тебе важно учесть обе стороны и найти решение, которое устраивает каждого',
  'тебе важно добраться до сути; поверхностного ответа часто недостаточно',
  'тебе интереснее, когда есть простор для нового опыта и большая цель',
  'тебе ближе ясный порядок, ответственность и результат, к которому можно идти шаг за шагом',
  'тебе нужен выбор и возможность попробовать свой способ, даже если он непривычен',
  'ты больше замечаешь настроение, образы и то, что трудно передать точными словами',
];
// Local reading copy only. This module never calculates or writes chart data.
export const MAP_OBJECTS: Record<string, { name: string; glyph: string; color: string; what: string; topic: string }> = {
  sun: { name: 'Солнце', glyph: '☉', color: '#ed8700', what: 'Показывает, как ты выражаешь себя и что помогает чувствовать: это моё дело.', topic: 'выражаешь себя и выбираешь главное' },
  moon: { name: 'Луна', glyph: '☽', color: '#6631e8', what: 'Описывает привычные реакции и то, что даёт тебе чувство уюта и спокойствия.', topic: 'реагируешь на происходящее и находишь спокойствие' },
  mercury: { name: 'Меркурий', glyph: '☿', color: '#125cad', what: 'Показывает, как ты думаешь, учишься и объясняешь свои мысли.', topic: 'учишься, думаешь и разговариваешь' },
  venus: { name: 'Венера', glyph: '♀', color: '#ee2467', what: 'Описывает, что тебе нравится, как ты проявляешь симпатию и что ценишь в близости.', topic: 'выбираешь то, что нравится, и проявляешь симпатию' },
  mars: { name: 'Марс', glyph: '♂', color: '#e33342', what: 'Показывает, как ты берёшься за дело, добиваешься своего и отстаиваешь границы.', topic: 'действуешь и отстаиваешь своё' },
  jupiter: { name: 'Юпитер', glyph: '♃', color: '#484078', what: 'Описывает, как ты расширяешь знания и какие возможности хочется попробовать.', topic: 'ищешь новые возможности и расширяешь знания' },
  saturn: { name: 'Сатурн', glyph: '♄', color: '#34365d', what: 'Показывает, как ты относишься к обязательствам, правилам и долгой работе.', topic: 'берёшь обязательства и доводишь дело до результата' },
  uranus: { name: 'Уран', glyph: '♅', color: '#167f9d', what: 'Описывает потребность в свободе выбора и готовность менять привычный способ действий.', topic: 'выбираешь свой путь и пробуешь непривычное' },
  neptune: { name: 'Нептун', glyph: '♆', color: '#3854be', what: 'Описывает воображение, впечатления и то, как ты воспринимаешь невысказанное.', topic: 'представляешь, мечтаешь и замечаешь настроение' },
  pluto: { name: 'Плутон', glyph: '♇', color: '#823e87', what: 'Показывает отношение к сильным переменам и желание разобраться в причинах происходящего.', topic: 'относишься к переменам и ищешь причины' },
  chiron: { name: 'Хирон', glyph: '⚷', color: '#936433', what: 'Это отдельная точка карты. В её трактовке смотрят, где опыт проб и ошибок помогает лучше понять себя.', topic: 'учишься на собственных ошибках' },
  northnode: { name: 'Северный узел', glyph: '☊', color: '#1c8370', what: 'Это точка пересечения пути Луны с видимым путём Солнца. В трактовке её связывают с менее привычным опытом, который интересно освоить.', topic: 'осваиваешь менее привычные способы действовать' },
  southnode: { name: 'Южный узел', glyph: '☋', color: '#557769', what: 'Это вторая точка пересечения пути Луны с видимым путём Солнца. В трактовке она описывает способы, к которым проще возвращаться по привычке.', topic: 'пользуешься привычными способами действовать' },
  ascendant: { name: 'Асцендент', glyph: 'ASC', color: '#008879', what: 'Точка, которая восходила на востоке в момент рождения. Её используют, чтобы описать, как ты входишь в новую обстановку и проявляешь себя при знакомстве.', topic: 'входишь в новую обстановку и знакомишься' },
  mc: { name: 'Середина неба', glyph: 'MC', color: '#7550b8', what: 'Верхняя точка карты, рассчитанная по времени и месту рождения. В трактовке она связана с делами, в которых хочется получить заметный результат.', topic: 'выбираешь заметные цели и показываешь результат' },
  descendant: { name: 'Десцендент', glyph: 'DSC', color: '#008879', what: 'Точка напротив Асцендента. В трактовке она описывает, что привлекает тебя в сотрудничестве и близких отношениях.', topic: 'сотрудничаешь и строишь отношения' },
  ic: { name: 'Основание неба', glyph: 'IC', color: '#7550b8', what: 'Нижняя точка карты. В трактовке она связана с домом, семейными привычками и тем, что даёт ощущение своего места.', topic: 'устраиваешь дом и находишь своё место' },
};
export const mapKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, '');
export const mapObject = (key: string) => MAP_OBJECTS[mapKey(key)];
const OBJECT_THEMES: Record<string, string> = { sun: 'самовыражение', moon: 'привычные реакции', mercury: 'мысли и общение', venus: 'симпатии и вкус', mars: 'решительность и действия', jupiter: 'интерес к новому', saturn: 'обязательства и правила', uranus: 'свобода выбора', neptune: 'воображение', pluto: 'отношение к переменам', chiron: 'опыт проб и ошибок', northnode: 'освоение нового', southnode: 'привычные способы действовать', ascendant: 'поведение при знакомстве', descendant: 'сотрудничество и близость', mc: 'заметные цели', ic: 'дом и семейные привычки' };
export const MAP_HOUSES = ['', 'первое впечатление и самостоятельные начинания', 'личные деньги, вещи и то, что ты ценишь', 'повседневное общение и обучение', 'дом, семья и личные привычки', 'творчество, увлечения и радость от того, что ты делаешь', 'повседневные дела, рабочие привычки и забота о быте', 'близкие отношения и сотрудничество', 'общие обязательства, доверие и совместные деньги', 'дальнее обучение, новые взгляды и знакомство с миром', 'работа, ответственность и заметные результаты', 'дружеские связи, общие идеи и командные дела', 'уединение, отдых от внимания и дела, которые ты предпочитаешь не выставлять напоказ'];
export const MAP_ASPECTS: Record<string, { name: string; what: string; effect: string }> = {
  conjunction: { name: 'Соединение', what: 'Две точки находятся рядом. Их темы тесно переплетаются.', effect: 'часто включаются вместе: одно трудно отделить от другого' },
  sextile: { name: 'Секстиль', what: 'Связь примерно в 60°. Её читают как возможность двум темам поддерживать друг друга.', effect: 'могут помогать друг другу, когда ты находишь способ их соединить' },
  trine: { name: 'Тригон', what: 'Связь примерно в 120°. Её читают как лёгкое сочетание двух тем.', effect: 'обычно сочетаются легче; одно может естественно поддерживать другое' },
  square: { name: 'Квадрат', what: 'Связь примерно в 90°. Две темы могут требовать разных действий одновременно.', effect: 'могут мешать друг другу: хочется одного, а другая задача требует иного' },
  opposition: { name: 'Оппозиция', what: 'Две точки стоят напротив друг друга, примерно в 180°. Их темы тянут в разные стороны.', effect: 'могут тянуть в разные стороны; тебе бывает непросто уделить место обеим' },
};
export type MapSelection = { kind: 'point' | 'house' | 'aspect' | 'sign'; id: string };
export type MapReason = { title: string; subtitle: string; text: string; tone: 'sign' | 'house' | 'aspect'; facts?: string };
export function buildMapData(chart: NatalChartWheelSource) {
  const model = buildNatalChartWheelModel(chart);
  const extra = (['descendant', 'ic'] as const).flatMap(key => {
    const angle = chart.angles?.[key];
    const parent = key === 'descendant' ? 'ascendant' : 'mc';
    if (!angle || !model.angles.some(p => p.key === parent) || angle.reliability === 'variable_in_range' || (angle.reliability !== 'exact' && angle.stableSign !== true) || !Number.isFinite(angle.longitude)) return [];
    return [{ key, name: angle.object, sign: angle.sign, degree: angle.degree, longitude: angle.longitude }];
  });
  return { ...model, allPoints: [...model.allPoints, ...extra], angles: [...model.angles, ...extra] };
}
export function explainMapSelection(chart: NatalChartWheelSource, selection: MapSelection) {
  const data = buildMapData(chart);
  const findPoint = (key: string) => data.allPoints.find(p => mapKey(p.key) === mapKey(key) || mapKey(p.name) === mapKey(key));
  const signIndex = (p: NatalChartWheelPoint) => MAP_SIGNS.indexOf(p.sign) >= 0 ? MAP_SIGNS.indexOf(p.sign) : Math.floor(normalizeNatalWheelLongitude(p.longitude) / 30);
  const pointHouse = (p: NatalChartWheelPoint): number | null => {
    const rawChart = chart as unknown as { positions?: Record<string, { house?: number; stable?: { house?: boolean } }>; angles?: Record<string, { house?: number }>; [key: string]: unknown };
    const raw = rawChart.positions?.[p.key] ?? rawChart.angles?.[p.key] ?? rawChart[p.key] as { house?: number; stable?: { house?: boolean } } | undefined;
    const n = raw?.house;
    return n && data.houses.some(h => h.house === n) && ('stable' in (raw || {}) ? (raw as { stable?: { house?: boolean } }).stable?.house !== false : true) ? n : null;
  };
  const placement = (p: NatalChartWheelPoint) => `${mapObject(p.key)?.name || p.name} в ${SIGNS_IN[signIndex(p)]}${pointHouse(p) ? ` · ${pointHouse(p)} дом` : ''} · ${p.degree.toFixed(1)}°`;
  const signMeaning = (p: NatalChartWheelPoint) => `Когда ты ${mapObject(p.key)?.topic || 'проявляешь себя'}, ${SIGN_WAYS[signIndex(p)]}.`;
  const aspectMeaning = (a: NatalChartWheelAspect) => {
    const left = findPoint(a.fromKey); const right = findPoint(a.toKey);
    const pair = [mapKey(left?.key || a.fromKey), mapKey(right?.key || a.toKey)].sort().join('-');
    if (pair === 'ascendant-descendant') return 'Эти точки всегда стоят напротив друг друга. Они обозначают одну ось карты: твои самостоятельные начинания и отношения с другими. Эта связь показывает устройство карты, а не отдельную черту именно у тебя.';
    if (pair === 'ic-mc') return 'Эти точки всегда стоят напротив друг друга. Они связывают домашнюю жизнь и заметные внешние цели. Их противоположное положение — общее устройство карты.';
    if (pair === 'northnode-southnode') return 'Лунные узлы всегда стоят напротив друг друга. В трактовке их читают вместе как привычный и менее знакомый опыт. Сама эта оппозиция одинакова у всех.';
    return `В твоей карте связаны «${OBJECT_THEMES[mapKey(left?.key || a.fromKey)] || 'темы первой точки'}» и «${OBJECT_THEMES[mapKey(right?.key || a.toKey)] || 'темы второй точки'}». Они ${MAP_ASPECTS[a.type].effect}.`;
  };
  const aspectReason = (a: NatalChartWheelAspect): MapReason => ({ title: `${mapObject(findPoint(a.fromKey)?.key || a.fromKey)?.name || a.fromKey} — ${mapObject(findPoint(a.toKey)?.key || a.toKey)?.name || a.toKey}`, subtitle: MAP_ASPECTS[a.type].name, text: aspectMeaning(a), tone: 'aspect' });
  if (selection.kind === 'point') {
    const p = findPoint(selection.id); if (!p) return null;
    const meta = mapObject(p.key); if (!meta) return null;
    const house = pointHouse(p);
    const aspects = data.aspects.filter(a => findPoint(a.fromKey)?.key === p.key || findPoint(a.toKey)?.key === p.key);
    const houseText = house ? `Это особенно заметно там, где речь про ${MAP_HOUSES[house]}.` : 'Надёжное положение в доме не указано, поэтому оно не используется в этом описании.';
    const reasons: MapReason[] = [{ title: `Знак: ${MAP_SIGN_NAMES[signIndex(p)]}`, subtitle: 'Как проявляется', text: signMeaning(p), facts: placement(p), tone: 'sign' }];
    if (!data.angles.some(a => a.key === p.key)) reasons.push({ title: house ? `Дом: ${house} дом` : 'Дом не определён', subtitle: 'Где проявляется', text: houseText, tone: 'house' });
    reasons.push(...aspects.map(aspectReason));
    let additional = '';
    if (p.key === 'ascendant') {
      const rulers = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'pluto', 'jupiter', 'saturn', 'uranus', 'neptune'];
      const ruler = findPoint(rulers[signIndex(p)]);
      if (ruler) {
        additional = `При знакомстве это сочетается с тем, как ты общаешься и действуешь: ${SIGN_WAYS[signIndex(ruler)]}.`;
        reasons.push({ title: `Дополнительно: ${mapObject(ruler.key)?.name}`, subtitle: 'Планета, связанная с этим знаком', text: `В этой трактовке она уточняет, как ты проявляешь себя при знакомстве. ${signMeaning(ruler)}`, facts: placement(ruler), tone: 'sign' });
      }
    }
    if (!aspects.length) reasons.push({ title: 'Аспекты', subtitle: 'Как связано', text: 'В сохранённой карте нет надёжных связей с этой точкой. Дополнительное влияние аспектов здесь не добавляется.', tone: 'aspect' });
    const firstAspect = aspects.find(a => !['ascendant-descendant','ic-mc','northnode-southnode'].includes([mapKey(findPoint(a.fromKey)?.key || a.fromKey), mapKey(findPoint(a.toKey)?.key || a.toKey)].sort().join('-')));
    const meaning = [signMeaning(p), house ? houseText : '', firstAspect ? aspectMeaning(firstAspect) : '', additional].filter(Boolean).join(' ');
    return { title: meta.name, glyph: meta.glyph, color: meta.color, what: meta.what, yours: placement(p), meaning, reasons, summary: meaning };
  }
  if (selection.kind === 'house') {
    const h = data.houses.find(h => String(h.house) === selection.id); if (!h) return null;
    const sign = Math.floor(h.longitude / 30); const occupants = data.bodies.filter(p => pointHouse(p) === h.house);
    const what = `${h.house} дом — часть карты. Его темы — ${MAP_HOUSES[h.house]}.`;
    const meaning = `Когда речь про ${MAP_HOUSES[h.house]}, ${SIGN_WAYS[sign]}.`;
    const bodyText = occupants.length ? occupants.map(p => `${mapObject(p.key)?.name}: ${signMeaning(p)}`).join(' ') : 'В сохранённом расчёте здесь нет планет. Это не означает, что эта часть жизни отсутствует или менее важна.';
    return { title: `${h.house} дом`, glyph: '⌂', color: '#7b44df', what, yours: `${h.house} дом · ${MAP_SIGN_NAMES[sign]} на его начале · ${(h.longitude % 30).toFixed(1)}°`, meaning: `${meaning} ${bodyText}`, reasons: [{ title: `Знак: ${MAP_SIGN_NAMES[sign]}`, subtitle: 'Как ты подходишь к этой части жизни', text: meaning, tone: 'sign' as const }, { title: 'Объекты внутри', subtitle: 'Что здесь проявляется', text: bodyText, facts: occupants.map(placement).join('\n'), tone: 'house' as const }], summary: `${meaning} ${occupants.length ? 'Здесь встречаются темы: ' + occupants.map(p => mapObject(p.key)?.what).join(' ') : bodyText}` };
  }
  if (selection.kind === 'aspect') {
    const a = data.aspects.find(a => a.id === selection.id); if (!a) return null;
    const points = [findPoint(a.fromKey), findPoint(a.toKey)].filter((p): p is NatalChartWheelPoint => !!p);
    const why = aspectReason(a);
    return { title: MAP_ASPECTS[a.type].name, glyph: '△', color: '#3b70d6', what: MAP_ASPECTS[a.type].what, yours: why.title, meaning: aspectMeaning(a), reasons: [...points.map(p => ({ title: mapObject(p.key)?.name || p.name, subtitle: 'Что соединяет эта связь', text: `${mapObject(p.key)?.what} ${signMeaning(p)}`, facts: placement(p), tone: 'sign' as const })), { ...why, text: `${MAP_ASPECTS[a.type].what} ${why.text}` }], summary: aspectMeaning(a) };
  }
  const i = MAP_SIGNS.indexOf(selection.id); if (i < 0) return null;
  const occupants = data.allPoints.filter(p => signIndex(p) === i);
  const meaning = occupants.length ? occupants.map(signMeaning).join(' ') : 'В этом знаке нет надёжно рассчитанных точек твоей карты. Поэтому отдельный вывод о тебе только по этому участку круга не делается.';
  return { title: MAP_SIGN_NAMES[i], glyph: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'][i], color: '#008879', what: 'Знак описывает способ проявления. Сам по себе участок круга не описывает тебя целиком — важно, какие точки находятся здесь.', yours: occupants.map(p => mapObject(p.key)?.name).join(' · ') || 'Нет рассчитанных точек', meaning, reasons: occupants.map(p => ({ title: mapObject(p.key)?.name || p.name, subtitle: 'Точка в этом знаке', text: signMeaning(p), facts: placement(p), tone: 'sign' as const })), summary: meaning };
}
