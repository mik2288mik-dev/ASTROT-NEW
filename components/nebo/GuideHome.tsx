import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { NatalChartData, PlanetPosition } from '../../types';
import type { KnowledgeTopic } from '../../lib/knowledge/types';
import { normalizeZodiacKey, ZODIAC_KEYS } from '../../lib/zodiacKeys';
import { SIGNS_IN } from '../../lib/lunarCalendar';
import { loadExploreCharts } from '../PersonalForecastFeed/exploreCharts';

type Chip = 'planets' | 'signs' | 'houses' | 'aspects' | 'points';
const CHIPS: ReadonlyArray<[Chip, string]> = [['planets', 'Планеты'], ['signs', 'Знаки'], ['houses', 'Дома'], ['aspects', 'Аспекты'], ['points', 'Точки']];

const PLANETS: ReadonlyArray<[string, keyof NatalChartData, string, string]> = [
  ['planet-sun', 'sun', '☉', 'суть, воля, ради чего ты живёшь'],
  ['planet-moon', 'moon', '☽', 'чувства, покой, что нужно для уюта'],
  ['planet-mercury', 'mercury', '☿', 'мысли, речь, переписки'],
  ['planet-venus', 'venus', '♀', 'любовь, вкус, деньги на радости'],
  ['planet-mars', 'mars', '♂', 'энергия, смелость, как ты споришь'],
  ['planet-jupiter', 'jupiter', '♃', 'рост, удача, щедрость'],
  ['planet-saturn', 'saturn', '♄', 'опыт, границы, ответственность'],
  ['planet-uranus', 'uranus', '♅', 'перемены, свобода, неожиданности'],
  ['planet-neptune', 'neptune', '♆', 'мечты, интуиция, вдохновение'],
  ['planet-pluto', 'pluto', '♇', 'глубина, кризисы, перерождение'],
];
const PLANET_NAMES: Record<string, string> = { sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс', jupiter: 'Юпитер', saturn: 'Сатурн', uranus: 'Уран', neptune: 'Нептун', pluto: 'Плутон', rising: 'Асцендент' };
const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const ASPECT_GLYPHS: Record<string, string> = { 'aspect-conjunction': '☌', 'aspect-sextile': '⚹', 'aspect-square': '□', 'aspect-trine': '△', 'aspect-opposition': '☍' };
const ASPECT_TYPES: Record<string, string> = { 'aspect-conjunction': 'conjunction', 'aspect-sextile': 'sextile', 'aspect-square': 'square', 'aspect-trine': 'trine', 'aspect-opposition': 'opposition' };
const POINTS = ['ascendant', 'descendant', 'midheaven', 'imum-coeli', 'node-north', 'node-south'];

const signIndex = (sign: string | undefined | null) => {
  const key = normalizeZodiacKey(String(sign || ''));
  return key ? ZODIAC_KEYS.findIndex((item) => item === key) : -1;
};
const firstClause = (text: string) => text.split(/[.:;]/)[0].trim().replace(/^./, (ch) => ch.toLowerCase()).slice(0, 70);

/** «У тебя»: the person's own placement for this topic, from their chart. */
function personalLine(topic: KnowledgeTopic, chart: NatalChartData | null): string | null {
  if (!chart) return null;
  const planet = PLANETS.find(([id]) => id === topic.id);
  if (planet) {
    const position = chart[planet[1]] as PlanetPosition | null | undefined;
    const index = signIndex(position?.sign);
    if (!position || index < 0) return null;
    return `${PLANET_NAMES[planet[1] as string]} ${SIGNS_IN[index]}${position.house ? `, в ${position.house} доме` : ''}${position.retrograde ? ', идёт назад' : ''}.`;
  }
  const signMatch = /^sign-(\w+)$/.exec(topic.id);
  if (signMatch) {
    const index = ZODIAC_KEYS.findIndex((key) => key.toLowerCase() === signMatch[1]);
    const inSign = Object.entries(PLANET_NAMES).filter(([key]) => signIndex((chart[key as keyof NatalChartData] as PlanetPosition | null | undefined)?.sign) === index).map(([, name]) => name);
    return inSign.length ? `В этом знаке у тебя: ${inSign.join(', ')}.` : 'В этом знаке у тебя нет планет. Это нормально: в карте всего десять планет на двенадцать знаков.';
  }
  const houseMatch = /^house-(\d+)$/.exec(topic.id);
  if (houseMatch) {
    const inHouse = Object.entries(PLANET_NAMES).filter(([key]) => String((chart[key as keyof NatalChartData] as PlanetPosition | null | undefined)?.house ?? '') === houseMatch[1]).map(([, name]) => name);
    return inHouse.length ? `В этом доме у тебя: ${inHouse.join(', ')}.` : 'В этом доме у тебя нет планет: эта сфера живёт по правилам знака на его границе.';
  }
  if (ASPECT_TYPES[topic.id]) {
    const list = (chart.aspects || []).filter((aspect) => aspect.type === ASPECT_TYPES[topic.id]).slice(0, 4)
      .map((aspect) => `${PLANET_NAMES[String(aspect.from).toLowerCase()] || aspect.from} и ${PLANET_NAMES[String(aspect.to).toLowerCase()] || aspect.to}`);
    return list.length ? `У тебя так связаны: ${list.join('; ')}.` : 'В твоей карте такого аспекта нет.';
  }
  if (topic.id === 'ascendant') {
    const index = signIndex(chart.rising?.sign);
    return index >= 0 ? `Твой Асцендент ${SIGNS_IN[index]}.` : null;
  }
  return null;
}

export function GuideHome({ topics, userId, onOpenArticle }: { topics: readonly KnowledgeTopic[]; userId: string; onOpenArticle: (topic: KnowledgeTopic) => void }) {
  const [chip, setChip] = useState<Chip>('planets');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<KnowledgeTopic | null>(null);
  const [chart, setChart] = useState<NatalChartData | null>(null);
  useEffect(() => {
    void loadExploreCharts(userId).then((charts) => setChart((charts.find((item) => item.is_primary)?.chart_data as NatalChartData | undefined) ?? null)).catch(() => undefined);
  }, [userId]);

  const byId = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);
  const items = useMemo(() => {
    const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((topic): topic is KnowledgeTopic => Boolean(topic));
    const needle = query.trim().toLowerCase();
    if (needle) {
      return topics.filter((topic) => topic.title.toLowerCase().includes(needle) || topic.aliases.some((alias) => alias.toLowerCase().includes(needle))).slice(0, 30)
        .map((topic) => ({ topic, glyph: '·', sub: firstClause(topic.shortAnswer || topic.summary) }));
    }
    if (chip === 'planets') return PLANETS.map(([id, , glyph, sub]) => ({ topic: byId.get(id), glyph, sub })).filter((item): item is { topic: KnowledgeTopic; glyph: string; sub: string } => Boolean(item.topic));
    if (chip === 'signs') return ZODIAC_KEYS.map((key, i) => ({ topic: byId.get(`sign-${key.toLowerCase()}`), glyph: SIGN_GLYPHS[i], sub: '' })).filter((item): item is { topic: KnowledgeTopic; glyph: string; sub: string } => Boolean(item.topic)).map((item) => ({ ...item, sub: firstClause(item.topic.shortAnswer || item.topic.summary) }));
    if (chip === 'houses') return pick(Array.from({ length: 12 }, (_, i) => `house-${i + 1}`)).map((topic, i) => ({ topic, glyph: String(i + 1), sub: firstClause(topic.shortAnswer || topic.summary) }));
    if (chip === 'aspects') return pick(Object.keys(ASPECT_GLYPHS)).map((topic) => ({ topic, glyph: ASPECT_GLYPHS[topic.id], sub: firstClause(topic.shortAnswer || topic.summary) }));
    return pick(POINTS).map((topic) => ({ topic, glyph: topic.id === 'ascendant' ? 'ASC' : topic.id === 'midheaven' ? 'MC' : topic.id === 'descendant' ? 'DSC' : topic.id === 'imum-coeli' ? 'IC' : '☊', sub: firstClause(topic.shortAnswer || topic.summary) }));
  }, [byId, chip, query, topics]);

  const mine = open ? personalLine(open, chart) : null;
  return (
    <div className="nebo-guide">
      <label className="nebo-dates-search">
        <Search size={18} aria-hidden />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Планета, знак, дом, аспект или точка" aria-label="Поиск по справочнику" />
      </label>
      {!query.trim() ? (
        <div className="nebo-guide-chips" role="tablist">
          {CHIPS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={chip === id} className={chip === id ? 'is-active' : ''} onClick={() => setChip(id)}>{label}</button>)}
        </div>
      ) : null}
      <div className="nebo-guide-list">
        {items.map(({ topic, glyph, sub }) => (
          <button key={topic.id} type="button" className="nebo-guide-row" onClick={() => setOpen(topic)}>
            <span className="nebo-guide-glyph" aria-hidden="true">{glyph}</span>
            <span><strong>{topic.title}</strong>{sub ? <small>{sub}</small> : null}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        ))}
        {!items.length ? <p className="nebo-period-loading">Ничего не нашлось. Попробуй другое слово.</p> : null}
      </div>
      {open ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setOpen(null)}>
          <div className="nebo-why" role="dialog" aria-modal="true" aria-label={open.title} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setOpen(null)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <p className="nebo-why-kicker">Справочник · {open.categoryLabel}</p>
            <h2>{open.title}</h2>
            <ol className="nebo-why-steps">
              <li className="is-sky"><b>Что это</b><p>{open.summary}</p></li>
              {mine ? <li className="is-you"><b>У тебя</b><p>{mine}</p></li> : null}
            </ol>
            <button type="button" className="nebo-period-cta" onClick={() => { setOpen(null); onOpenArticle(open); }}>Читать подробнее</button>
            <button type="button" className="nebo-inbox-close" onClick={() => setOpen(null)}>Понятно</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
