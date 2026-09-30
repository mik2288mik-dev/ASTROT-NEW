import {
  buildNatalChartWheelModel,
  normalizeNatalWheelLongitude,
  type NatalChartWheelSource,
  type NatalChartWheelPoint,
} from '../../lib/natalChartWheelModel';
import type { NatalChartDataV2, NatalBodyKey } from '../../lib/natalChartV2Types';
import {
  buildNatalInterpretation,
  ANGLE_ROLES_RU,
  ASPECT_DYNAMICS_RU,
  ASPECT_LABELS_RU,
  BODY_LABELS,
  BODY_ROLES,
  HOUSE_AREAS_RU,
  type NatalInterpretation,
  type NatalMeaning,
} from '../../lib/natalInterpretation';

export const MAP_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const MAP_SIGN_NAMES = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
const SIGNS_IN = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];

const OBJECT_VISUALS: Record<string, { glyph: string; color: string }> = {
  sun: { glyph: '☉', color: '#ed8700' },
  moon: { glyph: '☽', color: '#6631e8' },
  mercury: { glyph: '☿', color: '#125cad' },
  venus: { glyph: '♀', color: '#ee2467' },
  mars: { glyph: '♂', color: '#e33342' },
  jupiter: { glyph: '♃', color: '#484078' },
  saturn: { glyph: '♄', color: '#34365d' },
  uranus: { glyph: '♅', color: '#167f9d' },
  neptune: { glyph: '♆', color: '#3854be' },
  pluto: { glyph: '♇', color: '#823e87' },
  chiron: { glyph: '⚷', color: '#936433' },
  northnode: { glyph: '☊', color: '#1c8370' },
  southnode: { glyph: '☋', color: '#557769' },
  ascendant: { glyph: 'ASC', color: '#008879' },
  mc: { glyph: 'MC', color: '#7550b8' },
  descendant: { glyph: 'DSC', color: '#008879' },
  ic: { glyph: 'IC', color: '#7550b8' },
};

const ANGLE_NAMES: Record<string, string> = {
  ascendant: 'Асцендент',
  mc: 'Середина неба',
  descendant: 'Десцендент',
  ic: 'Основание неба',
};

export const mapKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, '');

function bodyMeta(key: string) {
  const canonical = Object.keys(BODY_LABELS).find((candidate) => mapKey(candidate) === mapKey(key)) as NatalBodyKey | undefined;
  if (!canonical) return null;
  const visual = OBJECT_VISUALS[mapKey(canonical)] || { glyph: '•', color: '#5e626d' };
  return {
    name: BODY_LABELS[canonical].ru,
    glyph: visual.glyph,
    color: visual.color,
    what: `В карте эта точка описывает ${BODY_ROLES[canonical].ru}.`,
    topic: BODY_ROLES[canonical].ru,
  };
}

export const MAP_OBJECTS: Record<string, { name: string; glyph: string; color: string; what: string; topic: string }> = Object.fromEntries([
  ...Object.keys(BODY_LABELS).map((key) => {
    const meta = bodyMeta(key)!;
    return [mapKey(key), meta];
  }),
  ...Object.entries(ANGLE_NAMES).map(([key, name]) => {
    const visual = OBJECT_VISUALS[key];
    const role = ANGLE_ROLES_RU[key as keyof typeof ANGLE_ROLES_RU];
    return [key, {
      name,
      glyph: visual.glyph,
      color: visual.color,
      what: `В карте эта точка описывает ${role}.`,
      topic: role,
    }];
  }),
]);

export const mapObject = (key: string) => MAP_OBJECTS[mapKey(key)];

export const MAP_HOUSES = [
  '',
  ...Array.from({ length: 12 }, (_, index) => HOUSE_AREAS_RU[index + 1]),
];

export const MAP_ASPECTS: Record<string, { name: string; what: string; effect: string }> = Object.fromEntries(
  Object.keys(ASPECT_LABELS_RU).map((key) => {
    const type = key as keyof typeof ASPECT_LABELS_RU;
    return [key, {
      name: ASPECT_LABELS_RU[type][0].toUpperCase() + ASPECT_LABELS_RU[type].slice(1),
      what: ASPECT_DYNAMICS_RU[type],
      effect: ASPECT_DYNAMICS_RU[type],
    }];
  }),
);

export type MapSelection = { kind: 'point' | 'house' | 'aspect' | 'sign'; id: string };
export type MapReason = {
  title: string;
  subtitle: string;
  text: string;
  tone: 'sign' | 'house' | 'aspect';
  facts?: string;
};

export function buildMapData(chart: NatalChartWheelSource) {
  const model = buildNatalChartWheelModel(chart);
  const extra = (['descendant', 'ic'] as const).flatMap((key) => {
    const angle = chart.angles?.[key];
    const parent = key === 'descendant' ? 'ascendant' : 'mc';
    if (
      !angle
      || !model.angles.some((point) => point.key === parent)
      || angle.reliability === 'variable_in_range'
      || (angle.reliability !== 'exact' && angle.stableSign !== true)
      || !Number.isFinite(angle.longitude)
    ) return [];
    return [{
      key,
      name: angle.object,
      sign: angle.sign,
      degree: angle.degree,
      longitude: angle.longitude,
    }];
  });
  return { ...model, allPoints: [...model.allPoints, ...extra], angles: [...model.angles, ...extra] };
}

function canonicalV2(chart: NatalChartWheelSource): NatalChartDataV2 | null {
  const value = chart as NatalChartDataV2;
  return value?.schemaVersion === 'natal-chart-data-v2' ? value : null;
}

function interpretationFor(chart: NatalChartWheelSource): NatalInterpretation | null {
  const v2 = canonicalV2(chart);
  return v2 ? buildNatalInterpretation(v2, 'ru') : null;
}

function meaningsByEvidence(
  interpretation: NatalInterpretation | null,
): Map<string, NatalMeaning> {
  const map = new Map<string, NatalMeaning>();
  interpretation?.meanings.forEach((meaning) => {
    meaning.evidenceIds.forEach((evidenceId) => map.set(evidenceId, meaning));
  });
  return map;
}

function reasonForMeaning(
  meaning: NatalMeaning,
  kind: 'sign' | 'house' | 'aspect',
  subtitle: string,
): MapReason {
  return {
    title: meaning.technicalText,
    subtitle,
    text: meaning.text,
    tone: kind,
    facts: meaning.technicalText,
  };
}

function conciseMeaning(values: readonly NatalMeaning[], limit: number): string {
  const unique = [...new Map(values.map((meaning) => [meaning.id, meaning])).values()];
  return unique.slice(0, limit).map((meaning) => meaning.text).join(' ');
}

function pointEvidenceIds(
  interpretation: NatalInterpretation,
  pointKey: string,
): string[] {
  const canonical = mapKey(pointKey);
  return interpretation.evidence.flatMap((fact) => {
    const bodyMatches = fact.bodyKey && mapKey(fact.bodyKey) === canonical;
    const angleMatches = fact.angleKey && mapKey(fact.angleKey) === canonical;
    const aspectMatches = fact.kind === 'aspect'
      && (
        (fact.fromKey && mapKey(fact.fromKey) === canonical)
        || (fact.toKey && mapKey(fact.toKey) === canonical)
      );
    return bodyMatches || angleMatches || aspectMatches ? [fact.id] : [];
  });
}

function placementLine(point: NatalChartWheelPoint, house: number | null): string {
  const signIndex = MAP_SIGNS.indexOf(point.sign) >= 0
    ? MAP_SIGNS.indexOf(point.sign)
    : Math.floor(normalizeNatalWheelLongitude(point.longitude) / 30);
  return `${mapObject(point.key)?.name || point.name} в ${SIGNS_IN[signIndex]}${house ? ` · ${house} дом` : ''} · ${point.degree.toFixed(1)}°`;
}

export function explainMapSelection(chart: NatalChartWheelSource, selection: MapSelection) {
  const data = buildMapData(chart);
  const interpretation = interpretationFor(chart);
  const byEvidence = meaningsByEvidence(interpretation);
  const findPoint = (key: string) => data.allPoints.find(
    (point) => mapKey(point.key) === mapKey(key) || mapKey(point.name) === mapKey(key),
  );
  const pointHouse = (point: NatalChartWheelPoint): number | null => {
    const v2 = canonicalV2(chart);
    if (!v2) return null;
    const body = Object.entries(v2.positions).find(([key]) => mapKey(key) === mapKey(point.key))?.[1];
    return body?.house != null && (body.reliability === 'exact' || body.stable.house === true)
      ? body.house
      : null;
  };

  if (selection.kind === 'point') {
    const point = findPoint(selection.id);
    if (!point) return null;
    const meta = mapObject(point.key);
    if (!meta) return null;

    const evidenceIds = interpretation ? pointEvidenceIds(interpretation, point.key) : [];
    const meanings = evidenceIds
      .map((id) => ({ id, meaning: byEvidence.get(id) }))
      .filter((entry): entry is { id: string; meaning: NatalMeaning } => !!entry.meaning);
    const distinctMeanings = [...new Map(meanings.map(entry => [entry.meaning.id, entry])).values()];
    const reasons = distinctMeanings.map(({ id, meaning }) => {
      const fact = interpretation?.evidence.find((candidate) => candidate.id === id);
      const tone: MapReason['tone'] = fact?.kind === 'aspect'
        ? 'aspect'
        : fact?.kind === 'body_house'
          ? 'house'
          : 'sign';
      const subtitle = fact?.kind === 'aspect'
        ? 'Что это означает'
        : fact?.kind === 'body_house'
          ? 'К каким делам относится'
          : fact?.kind === 'body_retrograde'
            ? 'Движение точки'
            : 'Что это означает';
      return reasonForMeaning(meaning, tone, subtitle);
    });
    const primaryMeanings = meanings
      .filter(({ id }) => {
        const fact = interpretation?.evidence.find((candidate) => candidate.id === id);
        if (!fact || fact.kind === 'aspect') return false;
        return fact.kind !== 'body_retrograde' || fact.retrograde === true;
      })
      .sort((left, right) => {
        const priority = (id: string) => {
          const kind = interpretation?.evidence.find((candidate) => candidate.id === id)?.kind;
          if (kind === 'body_sign' || kind === 'angle_sign') return 0;
          if (kind === 'body_house') return 1;
          if (kind === 'body_retrograde') return 2;
          return 3;
        };
        return priority(left.id) - priority(right.id);
      })
      .map((entry) => entry.meaning);
    const meaning = primaryMeanings.length
      ? conciseMeaning(primaryMeanings, 2)
      : meanings.length
        ? conciseMeaning(meanings.map((entry) => entry.meaning), 1)
        : 'Одного положения этой точки недостаточно, чтобы сделать вывод о тебе.';
    return {
      title: meta.name,
      glyph: meta.glyph,
      color: meta.color,
      what: meta.what,
      yours: placementLine(point, pointHouse(point)),
      meaning,
      reasons,
      summary: meaning,
    };
  }

  if (selection.kind === 'house') {
    const house = Number(selection.id);
    const wheelHouse = data.houses.find((candidate) => candidate.house === house);
    if (!wheelHouse) return null;
    const evidenceIds = interpretation
      ? interpretation.evidence
          .filter((fact) => (
            (fact.kind === 'house_cusp' && fact.house === house)
            || (fact.kind === 'body_house' && fact.house === house)
          ))
          .map((fact) => fact.id)
      : [];
    const meanings = evidenceIds
      .map((id) => byEvidence.get(id))
      .filter((meaning): meaning is NatalMeaning => !!meaning);
    const cusp = interpretation?.evidence.find(
      (fact) => fact.kind === 'house_cusp' && fact.house === house,
    );
    const meaning = meanings.length
      ? conciseMeaning(meanings, 2)
      : 'Для объяснения этого дома недостаточно данных.';
    return {
      title: `${house} дом`,
      glyph: '⌂',
      color: '#7b44df',
      what: `${house} дом — часть карты про ${MAP_HOUSES[house]}.`,
      yours: cusp?.sign
        ? `${house} дом · начало в ${cusp.sign}${cusp.degree == null ? '' : ` · ${cusp.degree.toFixed(1)}°`}`
        : `${house} дом`,
      meaning,
      reasons: meanings.map((item) => reasonForMeaning(item, 'house', 'Что здесь рассчитано')),
      summary: meaning,
    };
  }

  if (selection.kind === 'aspect') {
    const aspect = data.aspects.find((candidate) => candidate.id === selection.id);
    if (!aspect) return null;
    const meaning = byEvidence.get(`aspect:${aspect.id}`);
    const left = findPoint(aspect.fromKey);
    const right = findPoint(aspect.toKey);
    const title = `${mapObject(left?.key || aspect.fromKey)?.name || aspect.fromKey} — ${mapObject(right?.key || aspect.toKey)?.name || aspect.toKey}`;
    const text = meaning?.text || 'Этой связи недостаточно, чтобы сделать отдельный вывод о тебе.';
    return {
      title: MAP_ASPECTS[aspect.type].name,
      glyph: '△',
      color: '#3b70d6',
      what: MAP_ASPECTS[aspect.type].what,
      yours: title,
      meaning: text,
      reasons: meaning ? [reasonForMeaning(meaning, 'aspect', title)] : [],
      summary: text,
    };
  }

  const signIndex = MAP_SIGNS.indexOf(selection.id);
  if (signIndex < 0) return null;
  const occupants = data.allPoints.filter((point) => {
    const index = MAP_SIGNS.indexOf(point.sign) >= 0
      ? MAP_SIGNS.indexOf(point.sign)
      : Math.floor(normalizeNatalWheelLongitude(point.longitude) / 30);
    return index === signIndex;
  });
  const evidenceIds = occupants.flatMap((point) => {
    const key = mapKey(point.key);
    const body = Object.keys(BODY_LABELS).find((candidate) => mapKey(candidate) === key);
    const angle = ['ascendant', 'mc', 'descendant', 'ic'].find((candidate) => candidate === key);
    return [
      ...(body ? [`position:${body}:sign`] : []),
      ...(angle ? [`angle:${angle}:sign`] : []),
    ];
  });
  const meanings = evidenceIds
    .map((id) => byEvidence.get(id))
    .filter((meaning): meaning is NatalMeaning => !!meaning);
  const text = meanings.length
    ? conciseMeaning(meanings, 3)
    : 'В этом знаке нет точек, по которым можно сделать отдельный вывод о тебе.';
  return {
    title: MAP_SIGN_NAMES[signIndex],
    glyph: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'][signIndex],
    color: '#008879',
    what: 'Это один из двенадцати участков круга. Здесь видно, какие точки твоей карты находятся в этом знаке.',
    yours: occupants.map((point) => mapObject(point.key)?.name).filter(Boolean).join(' · ') || 'Нет рассчитанных точек',
    meaning: text,
    reasons: meanings.map((meaning) => reasonForMeaning(meaning, 'sign', 'Точка в этом знаке')),
    summary: text,
  };
}
