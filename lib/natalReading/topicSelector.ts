import type { NatalEvidenceFact } from './permanentReport';

export type NatalEvidenceTopicKey =
  | 'main'
  | 'character'
  | 'love'
  | 'communication'
  | 'work'
  | 'money'
  | 'first_impression'
  | 'inner'
  | 'decisions'
  | 'strengths'
  | 'change'
  | 'boredom'
  | 'closeness'
  | 'autonomy'
  | 'irritation'
  | 'conflict'
  | 'criticism'
  | 'misunderstood'
  | 'turnoffs'
  | 'risk'
  | 'authority'
  | 'deadlines';

type AspectBias = 'neutral' | 'prefer_harmonious' | 'prefer_hard';

type TopicSpec = Readonly<{
  primaryBodies: readonly string[];
  secondaryBodies?: readonly string[];
  houses?: readonly number[];
  angles?: readonly string[];
  aspectBias?: AspectBias;
  directPairs?: readonly (readonly [string, string])[];
}>;

const TOPIC_SPECS: Record<NatalEvidenceTopicKey, TopicSpec> = {
  main: {
    primaryBodies: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter'],
    secondaryBodies: ['saturn'],
    houses: [1, 7, 10],
    angles: ['ascendant', 'mc'],
  },
  character: {
    primaryBodies: ['sun', 'moon', 'mercury', 'mars'],
    secondaryBodies: ['jupiter', 'saturn', 'venus'],
    houses: [1],
    angles: ['ascendant'],
  },
  love: {
    primaryBodies: ['venus', 'moon', 'mars'],
    secondaryBodies: ['sun', 'saturn', 'jupiter'],
    houses: [5, 7],
    angles: ['descendant'],
  },
  communication: {
    primaryBodies: ['mercury'],
    secondaryBodies: ['moon', 'mars', 'sun', 'venus'],
    houses: [3, 9],
  },
  work: {
    primaryBodies: ['mars', 'saturn', 'jupiter', 'mercury'],
    secondaryBodies: ['sun'],
    houses: [6, 10],
    angles: ['mc'],
  },
  money: {
    primaryBodies: ['venus', 'jupiter', 'saturn', 'mercury'],
    secondaryBodies: ['mars'],
    houses: [2, 8],
  },
  first_impression: {
    primaryBodies: ['sun', 'mercury'],
    secondaryBodies: ['venus', 'moon'],
    houses: [1],
    angles: ['ascendant'],
  },
  inner: {
    primaryBodies: ['moon', 'sun', 'venus'],
    secondaryBodies: ['mercury'],
  },
  decisions: {
    primaryBodies: ['mercury', 'sun'],
    secondaryBodies: ['mars', 'jupiter', 'saturn'],
  },
  strengths: {
    primaryBodies: ['sun', 'jupiter', 'mars', 'mercury', 'venus', 'moon'],
    secondaryBodies: ['saturn'],
    aspectBias: 'prefer_harmonious',
  },
  change: {
    primaryBodies: ['mercury', 'mars', 'sun'],
    secondaryBodies: ['uranus', 'saturn', 'jupiter'],
  },
  boredom: {
    primaryBodies: ['mercury', 'mars', 'jupiter'],
    secondaryBodies: ['uranus', 'saturn', 'venus'],
  },
  closeness: {
    primaryBodies: ['venus', 'moon'],
    secondaryBodies: ['mars', 'saturn', 'sun'],
    houses: [5, 7],
    angles: ['descendant'],
  },
  autonomy: {
    primaryBodies: ['uranus', 'saturn', 'mars'],
    secondaryBodies: ['sun', 'mercury'],
    directPairs: [
      ['saturn', 'uranus'],
      ['uranus', 'mars'],
      ['saturn', 'mars'],
      ['uranus', 'sun'],
    ],
  },
  irritation: {
    primaryBodies: ['mercury', 'mars', 'moon'],
    secondaryBodies: ['saturn'],
    aspectBias: 'prefer_hard',
  },
  conflict: {
    primaryBodies: ['mercury', 'mars'],
    secondaryBodies: ['moon', 'saturn'],
    aspectBias: 'prefer_hard',
    directPairs: [['mercury', 'mars']],
  },
  criticism: {
    primaryBodies: ['mercury', 'saturn', 'mars'],
    secondaryBodies: ['moon'],
    aspectBias: 'prefer_hard',
    directPairs: [
      ['mercury', 'saturn'],
      ['mercury', 'mars'],
    ],
  },
  misunderstood: {
    primaryBodies: ['mercury'],
    secondaryBodies: ['neptune', 'uranus'],
    directPairs: [
      ['mercury', 'neptune'],
      ['mercury', 'uranus'],
    ],
  },
  turnoffs: {
    primaryBodies: ['venus', 'mars', 'moon'],
    secondaryBodies: ['saturn', 'mercury'],
    houses: [5, 7],
    angles: ['descendant'],
  },
  risk: {
    primaryBodies: ['jupiter', 'mars', 'mercury'],
    secondaryBodies: ['saturn', 'venus'],
    houses: [2, 8],
  },
  authority: {
    primaryBodies: ['saturn', 'sun', 'mars'],
    secondaryBodies: ['mercury', 'jupiter'],
    directPairs: [
      ['saturn', 'sun'],
      ['saturn', 'mars'],
      ['saturn', 'mercury'],
    ],
  },
  deadlines: {
    primaryBodies: ['saturn', 'mars', 'mercury'],
    secondaryBodies: ['sun', 'jupiter'],
    houses: [6, 10],
    angles: ['mc'],
  },
};

const HARMONIOUS = new Set(['trine', 'sextile']);
const HARD = new Set(['square', 'opposition']);

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function key(value: unknown): string {
  return text(value)
    .replace(/[\s_-]+/g, '')
    .toLocaleLowerCase('en-US');
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function placementBody(fact: NatalEvidenceFact): string {
  return key(fact.data.key || fact.object);
}

function aspectEndpoints(fact: NatalEvidenceFact): [string, string] {
  return [
    key(fact.data.fromKey || fact.data.from),
    key(fact.data.toKey || fact.data.to),
  ];
}

function directPairMatches(spec: TopicSpec, left: string, right: string): boolean {
  if (!spec.directPairs?.length) return true;
  return spec.directPairs.some(([a, b]) => (
    (key(a) === left && key(b) === right)
    || (key(a) === right && key(b) === left)
  ));
}

function indexScore(values: readonly string[] | undefined, value: string, start: number, step: number): number {
  if (!values?.length) return 0;
  const index = values.map(key).indexOf(value);
  return index < 0 ? 0 : Math.max(1, start - index * step);
}

function aspectTopicScore(fact: NatalEvidenceFact, spec: TopicSpec): number | null {
  if (fact.kind !== 'aspect' || fact.data.reliable === false) return null;
  const [from, to] = aspectEndpoints(fact);
  if (!from || !to || !directPairMatches(spec, from, to)) return null;

  const primary = new Set(spec.primaryBodies.map(key));
  const secondary = new Set((spec.secondaryBodies || []).map(key));
  const primaryHits = Number(primary.has(from)) + Number(primary.has(to));
  const secondaryHits = Number(secondary.has(from)) + Number(secondary.has(to));
  // A secondary body may refine a topic, but it cannot create the topic by
  // itself. Broad chapters therefore never inherit an unrelated outer-planet
  // aspect merely because Saturn/Uranus/etc. appears somewhere in the chart.
  if (primaryHits === 0) return null;

  let score = 0;
  if (primaryHits === 2) score += 105;
  else score += 74;
  score += secondaryHits * 14;
  score += indexScore(spec.primaryBodies, from, 18, 2);
  score += indexScore(spec.primaryBodies, to, 18, 2);

  const orb = Math.abs(finite(fact.data.orb) ?? finite((fact.data.orbRange as { min?: unknown } | undefined)?.min) ?? 8);
  score += Math.max(0, 40 - orb * 5);

  const type = key(fact.data.type);
  if (spec.aspectBias === 'prefer_harmonious' && HARMONIOUS.has(type)) score += 14;
  if (spec.aspectBias === 'prefer_hard' && HARD.has(type)) score += 14;

  return score;
}

export function scoreNatalEvidenceForTopic(
  fact: NatalEvidenceFact,
  topic: NatalEvidenceTopicKey,
): number | null {
  const spec = TOPIC_SPECS[topic];
  if (!spec) return null;

  if (fact.kind === 'aspect') return aspectTopicScore(fact, spec);

  if (fact.kind === 'placement') {
    if (!text(fact.data.sign) || key(fact.data.reliability) === 'variableinrange') return null;
    const body = placementBody(fact);
    const primary = indexScore(spec.primaryBodies, body, 72, 4);
    if (primary > 0) return primary;
    const secondary = indexScore(spec.secondaryBodies, body, 34, 3);
    return secondary > 0 ? secondary : null;
  }

  if (fact.kind === 'angle') {
    if (!text(fact.data.sign) || key(fact.data.reliability) === 'variableinrange') return null;
    const angle = key(fact.data.key || fact.object);
    const index = (spec.angles || []).map(key).indexOf(angle);
    return index < 0 ? null : 68 - index * 4;
  }

  if (fact.kind === 'house') {
    if (!text(fact.data.sign) || key(fact.data.reliability) === 'variableinrange') return null;
    const house = finite(fact.data.house);
    const index = house == null ? -1 : (spec.houses || []).indexOf(Math.round(house));
    return index < 0 ? null : 54 - index * 4;
  }

  return null;
}

export type RankedNatalEvidence = {
  fact: NatalEvidenceFact;
  score: number;
};

function factBodies(fact: NatalEvidenceFact): string[] {
  if (fact.kind === 'placement') return [placementBody(fact)].filter(Boolean);
  if (fact.kind === 'aspect') return aspectEndpoints(fact).filter(Boolean);
  return [];
}

function corroborationBonus(
  item: NatalEvidenceFact,
  candidates: readonly NatalEvidenceFact[],
): number {
  const anchors = new Set(factBodies(item));
  if (anchors.size === 0) return 0;
  let supportingFacts = 0;
  for (const other of candidates) {
    if (other.id === item.id) continue;
    const overlap = factBodies(other).some((body) => anchors.has(body));
    if (overlap) supportingFacts += 1;
  }
  // Confirmation matters, but it must never overpower topic relevance or orb.
  return Math.min(12, supportingFacts * 3);
}

export function rankNatalTopicEvidence(
  facts: readonly NatalEvidenceFact[],
  topic: NatalEvidenceTopicKey,
): RankedNatalEvidence[] {
  const base = facts
    .map((fact) => ({ fact, score: scoreNatalEvidenceForTopic(fact, topic) }))
    .filter((item): item is RankedNatalEvidence => item.score != null);
  const candidateFacts = base.map((item) => item.fact);
  return base
    .map((item) => ({
      ...item,
      score: item.score + corroborationBonus(item.fact, candidateFacts),
    }))
    .sort((left, right) => right.score - left.score || left.fact.id.localeCompare(right.fact.id));
}

/**
 * Selects a small, topic-specific evidence set.
 *
 * This is deliberately not a positive/negative balancer. Hard and harmonious
 * aspects compete on relevance and exactness. Explicit conflict-like topics may
 * prefer hard aspects, but broad chapters do not inherit that preference.
 */
export function selectNatalTopicEvidence(
  facts: readonly NatalEvidenceFact[],
  topic: NatalEvidenceTopicKey,
  options: { limit?: number; min?: number } = {},
): NatalEvidenceFact[] {
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  const min = Math.max(1, Math.min(options.min ?? Math.min(3, limit), limit));
  const ranked = rankNatalTopicEvidence(facts, topic);
  const selected: NatalEvidenceFact[] = [];
  const usedBodies = new Map<string, number>();

  for (const { fact } of ranked) {
    if (selected.length >= limit) break;
    const bodies = factBodies(fact);
    const saturated = bodies.length > 0
      && bodies.every((body) => (usedBodies.get(body) || 0) >= 2);
    if (saturated && selected.length >= min) continue;
    selected.push(fact);
    for (const body of bodies) usedBodies.set(body, (usedBodies.get(body) || 0) + 1);
  }

  if (selected.length < min) {
    for (const { fact } of ranked) {
      if (selected.length >= min || selected.length >= limit) break;
      if (selected.some((item) => item.id === fact.id)) continue;
      selected.push(fact);
    }
  }

  return selected;
}

export function inferNatalEvidenceTopic(question: string): NatalEvidenceTopicKey {
  const value = question.toLocaleLowerCase('ru');

  if (/(?:раздраж|бесит|выводит\s+из\s+себя|irritat|annoy)/iu.test(value)) return 'irritation';
  if (/(?:спор|ссор|конфликт|руга|argument|conflict|fight)/iu.test(value)) return 'conflict';
  if (/(?:критик|critici[sz])/iu.test(value)) return 'criticism';
  if (/(?:не\s+понима|понимают\s+не\s+так|misunderstood|misread)/iu.test(value)) return 'misunderstood';
  if (/(?:отталкива|turn\s*off|repel)/iu.test(value)) return 'turnoffs';
  if (/(?:риск|risk)/iu.test(value)) return 'risk';
  if (/(?:началь|руковод|authority|manager|boss)/iu.test(value)) return 'authority';
  if (/(?:дедлайн|срок|deadline)/iu.test(value)) return 'deadlines';
  if (/(?:привязан|сближа|близост|attachment|closeness|intimacy)/iu.test(value)) return 'closeness';
  if (/(?:свобод|самостоятель|автоном|freedom|autonom|independen)/iu.test(value)) return 'autonomy';
  if (/(?:надоеда|скуч|bored|boring)/iu.test(value)) return 'boredom';
  if (/(?:меняю\s+мнени|решени|выбор|decid|choice|change\s+my\s+mind)/iu.test(value)) return 'decisions';
  if (/(?:любов|отношен|партн[её]р|симпат|нежн|роман|love|relationship|partner|affection|romance)/iu.test(value)) return 'love';
  if (/(?:общен|разговор|говор|переписк|объясн|слуша|communicat|conversation|texting|explain|listen)/iu.test(value)) return 'communication';
  if (/(?:работ|карьер|дело|клиент|команд|work|career|business|client|team)/iu.test(value)) return 'work';
  if (/(?:деньг|доход|трат|покуп|цен[ау]|коп|money|income|spend|purchase|price|saving)/iu.test(value)) return 'money';
  if (/(?:сильн|получается\s+лучше|талант|strength|best\s+at|talent)/iu.test(value)) return 'strengths';
  if (/(?:знаком|впечатлен|first\s+impression|new\s+people)/iu.test(value)) return 'first_impression';

  return 'character';
}

export function getNatalTopicSpec(topic: NatalEvidenceTopicKey): TopicSpec {
  return TOPIC_SPECS[topic];
}
