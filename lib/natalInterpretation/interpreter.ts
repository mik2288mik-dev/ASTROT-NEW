import type { NatalChartDataV2, NatalBodyKey } from '../natalChartV2Types';
import {
  ANGLE_LABELS, ANGLE_TOPICS, ASPECT_LABELS_RU, BODY_TOPICS,
  HOUSE_AREAS_RU, HOUSE_OPENINGS_RU, HOUSE_TOPICS, POINT_ACTIONS_RU,
  bodyLabel, bodySignMeaning, isBackgroundSignBody, signStyle,
} from './meanings';
import { extractNatalInterpretationEvidence } from './evidence';
import type { NatalInterpretationEvidence, NatalMeaning, NatalMeaningScope, NatalMeaningTopic } from './types';

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
const angles = new Set(['ascendant', 'mc', 'descendant', 'ic']);
const angleOpenings = {
  ascendant: { ru: 'В новой компании', en: 'When meeting people' },
  mc: { ru: 'В работе', en: 'At work' },
  descendant: { ru: 'В близких отношениях', en: 'In close relationships' },
  ic: { ru: 'Дома и в семье', en: 'At home and with family' },
};
const houseOpeningsEn: Record<number, string> = {
  1: 'When meeting people', 2: 'When spending money', 3: 'When talking and learning',
  4: 'At home and with family', 5: 'In hobbies and dating', 6: 'In everyday tasks',
  7: 'In close relationships', 8: 'When sharing money and responsibilities',
  9: 'When learning or travelling', 10: 'At work', 11: 'With friends and shared plans',
  12: 'When spending time alone',
};
function aspectScope(from: string, to: string): NatalMeaningScope {
  if (angles.has(from) || angles.has(to)) return 'personal';
  return isBackgroundSignBody(from as NatalBodyKey) && isBackgroundSignBody(to as NatalBodyKey)
    ? 'background' : 'personal';
}
function pointTopics(key: NonNullable<NatalInterpretationEvidence['fromKey']>): NatalMeaningTopic[] {
  return key in ANGLE_TOPICS ? ANGLE_TOPICS[key as keyof typeof ANGLE_TOPICS] : BODY_TOPICS[key as NatalBodyKey];
}
function pointLabel(key: NonNullable<NatalInterpretationEvidence['fromKey']>, language: 'ru' | 'en'): string {
  return key in ANGLE_LABELS ? ANGLE_LABELS[key as keyof typeof ANGLE_LABELS] : bodyLabel(key as NatalBodyKey, language);
}
function aspectText(fact: NatalInterpretationEvidence, language: 'ru' | 'en'): string {
  const left = POINT_ACTIONS_RU[fact.fromKey!];
  const right = POINT_ACTIONS_RU[fact.toKey!];
  if (language === 'en') {
    const actions: Partial<Record<NatalBodyKey, string>> = {
      sun: 'deciding what you want', moon: 'taking your feelings into account', mercury: 'thinking and explaining your ideas',
      venus: 'getting along with someone close to you', mars: 'getting started', jupiter: 'trying something new',
      saturn: 'keeping a promise and finishing a task', uranus: 'changing a familiar way of doing things',
      neptune: 'imagining how things might turn out', pluto: 'making a major change',
    };
    const role = (key: NonNullable<NatalInterpretationEvidence['fromKey']>) => angles.has(key)
      ? { ascendant: 'meeting people', mc: 'working towards a goal', descendant: 'getting along with someone', ic: 'looking after your home and family' }[key as keyof typeof angleOpenings]!
      : actions[key as NatalBodyKey]!;
    const a = role(fact.fromKey!), b = role(fact.toKey!);
    switch (fact.aspectType) {
      case 'square': return `You may find it hard to combine ${a} with ${b}.`;
      case 'opposition': return `Sometimes you have to choose between ${a} and ${b}.`;
      case 'trine': return `You usually find it easy to combine ${a} with ${b}.`;
      case 'sextile': return `${a} may help you with ${b}.`;
      default: return `${a} is closely connected with ${b}.`;
    }
  }
  switch (fact.aspectType) {
    case 'square': return `Тебе бывает трудно одновременно ${left.infinitive} и ${right.infinitive}.`;
    case 'opposition': return `Иногда ты выбираешь между тем, чтобы ${left.infinitive}, и тем, чтобы ${right.infinitive}.`;
    case 'trine': return `Тебе обычно легко ${left.infinitive}, когда ты ${right.present}.`;
    case 'sextile': return `Тебе может быть проще ${left.infinitive}, когда ты ${right.present}.`;
    default: return `Когда ты ${left.present}, это тесно связано с тем, как ты ${right.present}.`;
  }
}
function meaningForEvidence(fact: NatalInterpretationEvidence, language: 'ru' | 'en'): NatalMeaning | null {
  const base = { id: `meaning:${fact.id}`, evidenceIds: [fact.id] };
  if (fact.kind === 'body_sign' && fact.bodyKey && fact.sign) {
    const text = bodySignMeaning(fact.bodyKey, fact.sign, language);
    if (!text) return null;
    return { ...base, semanticKey: `body-sign:${fact.bodyKey}:${fact.sign}`,
      scope: isBackgroundSignBody(fact.bodyKey) ? 'background' : 'personal', text,
      technicalText: `${bodyLabel(fact.bodyKey, language)} · ${fact.sign}${fact.degree == null ? '' : ` · ${fact.degree.toFixed(1)}°`}`,
      topics: BODY_TOPICS[fact.bodyKey] };
  }
  // Motion is calculator data, not proof of a person's response or habits.
  // A body's house is attached to its observation below rather than narrated twice.
  if (fact.kind === 'body_house' || fact.kind === 'body_retrograde') return null;
  if (fact.kind === 'angle_sign' && fact.angleKey && fact.sign) {
    const style = signStyle(fact.sign, language);
    if (!style) return null;
    return { ...base, semanticKey: `angle-sign:${fact.angleKey}:${fact.sign}`, scope: 'personal',
      text: `${angleOpenings[fact.angleKey][language]} ${language === 'ru' ? 'ты' : ''} ${style}.`.replace(/\s+/g, ' '),
      technicalText: `${ANGLE_LABELS[fact.angleKey]} · ${fact.sign}${fact.degree == null ? '' : ` · ${fact.degree.toFixed(1)}°`}`,
      topics: ANGLE_TOPICS[fact.angleKey] };
  }
  if (fact.kind === 'house_cusp' && fact.house && fact.sign) {
    const style = signStyle(fact.sign, language);
    const opening = language === 'ru' ? HOUSE_OPENINGS_RU[fact.house] : houseOpeningsEn[fact.house];
    if (!style || !opening) return null;
    return { ...base, semanticKey: `house-cusp:${fact.house}:${fact.sign}`, scope: 'structural',
      text: `${opening} ${language === 'ru' ? 'ты' : ''} ${style}.`.replace(/\s+/g, ' '),
      technicalText: `${fact.house} ${language === 'ru' ? 'дом' : 'house'} · ${fact.sign}${fact.degree == null ? '' : ` · ${fact.degree.toFixed(1)}°`}`,
      topics: HOUSE_TOPICS[fact.house] || ['general'] };
  }
  if (fact.kind === 'aspect' && fact.fromKey && fact.toKey && fact.aspectType) {
    // These calculated points stay on the map; a generic pair of roles is not
    // enough to turn them into a personal claim in the reading.
    if ([fact.fromKey, fact.toKey].some(key => ['chiron', 'northNode', 'southNode'].includes(key))) return null;
    return { ...base, semanticKey: `aspect:${fact.fromKey}:${fact.aspectType}:${fact.toKey}`,
      scope: aspectScope(fact.fromKey, fact.toKey), text: aspectText(fact, language),
      technicalText: `${pointLabel(fact.fromKey, language)} · ${language === 'ru' ? ASPECT_LABELS_RU[fact.aspectType] : fact.aspectType} · ${pointLabel(fact.toKey, language)}${fact.orb == null ? '' : ` · ${fact.orb.toFixed(1)}°`}`,
      topics: unique([...pointTopics(fact.fromKey), ...pointTopics(fact.toKey)]) };
  }
  return null;
}
export function interpretNatalChart(chart: NatalChartDataV2, language: 'ru' | 'en' = 'ru') {
  const extracted = extractNatalInterpretationEvidence(chart);
  const meanings = extracted.evidence.map(fact => {
    const meaning = meaningForEvidence(fact, language);
    if (meaning && fact.kind === 'body_sign') {
      const house = extracted.evidence.find(candidate => candidate.kind === 'body_house' && candidate.bodyKey === fact.bodyKey);
      if (house?.house) {
        meaning.area = language === 'ru' ? HOUSE_AREAS_RU[house.house] : houseOpeningsEn[house.house];
        meaning.evidenceIds.push(house.id);
        meaning.technicalText += ` · ${house.house} ${language === 'ru' ? 'дом' : 'house'}`;
        meaning.topics = unique([...meaning.topics, ...(HOUSE_TOPICS[house.house] || [])]);
      }
    }
    return meaning;
  }).filter((meaning): meaning is NatalMeaning => !!meaning);
  return { ...extracted, meanings };
}
