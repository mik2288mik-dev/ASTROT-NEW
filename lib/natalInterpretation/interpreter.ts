import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  ANGLE_LABELS,
  ANGLE_ROLES_RU,
  ANGLE_TOPICS,
  ASPECT_DYNAMICS_RU,
  ASPECT_LABELS_RU,
  BODY_TOPICS,
  HOUSE_AREAS_RU,
  HOUSE_TOPICS,
  bodyLabel,
  bodyRole,
  isBackgroundSignBody,
  signStyle,
} from './meanings';
import { extractNatalInterpretationEvidence } from './evidence';
import type {
  NatalInterpretationEvidence,
  NatalMeaning,
  NatalMeaningScope,
  NatalMeaningTopic,
} from './types';

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function aspectScope(
  fromKey: NonNullable<NatalInterpretationEvidence['fromKey']>,
  toKey: NonNullable<NatalInterpretationEvidence['toKey']>,
): NatalMeaningScope {
  const angles = new Set(['ascendant', 'mc', 'descendant', 'ic']);
  if (angles.has(fromKey) || angles.has(toKey)) return 'personal';
  const fromBackground = isBackgroundSignBody(fromKey as keyof typeof BODY_TOPICS);
  const toBackground = isBackgroundSignBody(toKey as keyof typeof BODY_TOPICS);
  return fromBackground && toBackground ? 'background' : 'personal';
}

function meaningForEvidence(
  evidence: NatalInterpretationEvidence,
  language: 'ru' | 'en',
): NatalMeaning | null {
  if (language !== 'ru') {
    // English keeps the same deterministic architecture. Russian is the
    // production language; English copy can be expanded without changing IDs.
  }

  if (evidence.kind === 'body_sign' && evidence.bodyKey && evidence.sign) {
    const style = signStyle(evidence.sign, language);
    if (!style) return null;
    const label = bodyLabel(evidence.bodyKey, language);
    const role = bodyRole(evidence.bodyKey, language);
    const background = isBackgroundSignBody(evidence.bodyKey);
    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `body-sign:${evidence.bodyKey}:${evidence.sign}`,
      scope: background ? 'background' : 'personal',
      text: language === 'ru'
        ? background
          ? `Это фоновая настройка темы «${role}»: ${style}.`
          : `В теме «${role}» ${style}.`
        : background
          ? `This is a background modifier for ${role}: ${style}.`
          : `For ${role}, ${style}.`,
      technicalText: `${label} · ${evidence.sign}${evidence.degree == null ? '' : ` · ${evidence.degree.toFixed(1)}°`}`,
      topics: BODY_TOPICS[evidence.bodyKey],
      evidenceIds: [evidence.id],
    };
  }

  if (evidence.kind === 'body_house' && evidence.bodyKey && evidence.house) {
    const area = HOUSE_AREAS_RU[evidence.house];
    if (!area) return null;
    const label = bodyLabel(evidence.bodyKey, language);
    const role = bodyRole(evidence.bodyKey, language);
    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `body-house:${evidence.bodyKey}:${evidence.house}`,
      scope: 'personal',
      text: language === 'ru'
        ? `Тема «${role}» особенно заметна в сфере: ${area}.`
        : `${role} is especially expressed through house ${evidence.house}.`,
      technicalText: language === 'ru'
        ? `${label} · ${evidence.house} дом`
        : `${label} · house ${evidence.house}`,
      topics: unique([
        ...BODY_TOPICS[evidence.bodyKey],
        ...(HOUSE_TOPICS[evidence.house] || []),
      ]),
      evidenceIds: [evidence.id],
    };
  }

  if (evidence.kind === 'body_retrograde' && evidence.bodyKey && typeof evidence.retrograde === 'boolean') {
    const label = bodyLabel(evidence.bodyKey, language);
    const role = bodyRole(evidence.bodyKey, language);
    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `body-retrograde:${evidence.bodyKey}:${evidence.retrograde ? 'r' : 'direct'}`,
      scope: isBackgroundSignBody(evidence.bodyKey) ? 'background' : 'personal',
      text: evidence.retrograde
        ? language === 'ru'
          ? `В теме «${role}» астрологическая трактовка учитывает ретроградность: часть реакции чаще сначала проходит через внутренний пересмотр, а уже потом выражается наружу.`
          : `For ${role}, the interpretation includes retrograde motion: part of the response is processed inwardly before it is expressed outwardly.`
        : language === 'ru'
          ? `В теме «${role}» дополнительная ретроградная поправка к трактовке не применяется.`
          : `For ${role}, no additional retrograde modifier is applied.`,
      technicalText: evidence.retrograde
        ? `${label} · ретроградное движение`
        : `${label} · директное движение`,
      topics: BODY_TOPICS[evidence.bodyKey],
      evidenceIds: [evidence.id],
    };
  }

  if (evidence.kind === 'angle_sign' && evidence.angleKey && evidence.sign) {
    const style = signStyle(evidence.sign, language);
    if (!style) return null;
    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `angle-sign:${evidence.angleKey}:${evidence.sign}`,
      scope: 'personal',
      text: language === 'ru'
        ? `Это добавляет свой способ действия ${ANGLE_ROLES_RU[evidence.angleKey]}: ${style}.`
        : `This modifies the angle through the style of ${evidence.sign}.`,
      technicalText: `${ANGLE_LABELS[evidence.angleKey]} · ${evidence.sign}${evidence.degree == null ? '' : ` · ${evidence.degree.toFixed(1)}°`}`,
      topics: ANGLE_TOPICS[evidence.angleKey],
      evidenceIds: [evidence.id],
    };
  }

  if (evidence.kind === 'house_cusp' && evidence.house && evidence.sign) {
    const area = HOUSE_AREAS_RU[evidence.house];
    const style = signStyle(evidence.sign, language);
    if (!area || !style) return null;
    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `house-cusp:${evidence.house}:${evidence.sign}`,
      scope: 'structural',
      text: language === 'ru'
        ? `Когда речь про ${area}, ${style}.`
        : `House ${evidence.house} begins in ${evidence.sign}, shaping the approach to that area.`,
      technicalText: language === 'ru'
        ? `${evidence.house} дом · начало в ${evidence.sign}${evidence.degree == null ? '' : ` · ${evidence.degree.toFixed(1)}°`}`
        : `House ${evidence.house} · ${evidence.sign}`,
      topics: HOUSE_TOPICS[evidence.house] || ['general'],
      evidenceIds: [evidence.id],
    };
  }

  if (
    evidence.kind === 'aspect'
    && evidence.aspectType
    && evidence.fromKey
    && evidence.toKey
  ) {
    const fromIsBody = !['ascendant', 'mc', 'descendant', 'ic'].includes(evidence.fromKey);
    const toIsBody = !['ascendant', 'mc', 'descendant', 'ic'].includes(evidence.toKey);
    const fromLabel = fromIsBody
      ? bodyLabel(evidence.fromKey as keyof typeof BODY_TOPICS, language)
      : ANGLE_LABELS[evidence.fromKey as keyof typeof ANGLE_LABELS];
    const toLabel = toIsBody
      ? bodyLabel(evidence.toKey as keyof typeof BODY_TOPICS, language)
      : ANGLE_LABELS[evidence.toKey as keyof typeof ANGLE_LABELS];
    const fromRole = fromIsBody
      ? bodyRole(evidence.fromKey as keyof typeof BODY_TOPICS, language)
      : ANGLE_ROLES_RU[evidence.fromKey as keyof typeof ANGLE_ROLES_RU];
    const toRole = toIsBody
      ? bodyRole(evidence.toKey as keyof typeof BODY_TOPICS, language)
      : ANGLE_ROLES_RU[evidence.toKey as keyof typeof ANGLE_ROLES_RU];
    const topics: NatalMeaningTopic[] = unique([
      ...(fromIsBody
        ? BODY_TOPICS[evidence.fromKey as keyof typeof BODY_TOPICS]
        : ANGLE_TOPICS[evidence.fromKey as keyof typeof ANGLE_TOPICS]),
      ...(toIsBody
        ? BODY_TOPICS[evidence.toKey as keyof typeof BODY_TOPICS]
        : ANGLE_TOPICS[evidence.toKey as keyof typeof ANGLE_TOPICS]),
    ]);

    return {
      id: `meaning:${evidence.id}`,
      semanticKey: `aspect:${evidence.fromKey}:${evidence.aspectType}:${evidence.toKey}`,
      scope: aspectScope(evidence.fromKey, evidence.toKey),
      text: language === 'ru'
        ? `Связь между темами «${fromRole}» и «${toRole}» устроена так: ${ASPECT_DYNAMICS_RU[evidence.aspectType]}.`
        : `The two functions are linked by a ${evidence.aspectType}.`,
      technicalText: language === 'ru'
        ? `${fromLabel} · ${ASPECT_LABELS_RU[evidence.aspectType]} · ${toLabel}${evidence.orb == null ? '' : ` · орб ${evidence.orb.toFixed(1)}°`}`
        : `${fromLabel} · ${evidence.aspectType} · ${toLabel}`,
      topics,
      evidenceIds: [evidence.id],
    };
  }

  return null;
}

export function interpretNatalChart(
  chart: NatalChartDataV2,
  language: 'ru' | 'en' = 'ru',
): {
  evidence: ReturnType<typeof extractNatalInterpretationEvidence>['evidence'];
  rejectedEvidence: ReturnType<typeof extractNatalInterpretationEvidence>['rejectedEvidence'];
  meanings: NatalMeaning[];
} {
  const extracted = extractNatalInterpretationEvidence(chart);
  const meanings = extracted.evidence
    .map((fact) => meaningForEvidence(fact, language))
    .filter((meaning): meaning is NatalMeaning => !!meaning);

  return { ...extracted, meanings };
}
