import type {
  CompatibilityDimensionResult,
  CompatibilityDimensionKey,
  CompatibilityEvidence,
  CompatibilityReadingSection,
  SynastryResult,
} from '../../types';
import type { CalculatedCompatibility } from './compatibilityEngine';

export type CompatibilityWriterResponse = {
  summary: string;
  sections: Array<{
    id: string;
    text: string;
  }>;
  closing: {
    strength: string;
    risk: string;
    action: string;
  };
};

type NarrativeInput = {
  subjectName: string;
  partnerName: string;
  language: 'ru' | 'en';
};

type DimensionNarrative = { strength: string; risk: string; action: string };

const RU_DIMENSION_NARRATIVE: Record<CompatibilityDimensionKey, DimensionNarrative> = {
  emotional_closeness: {
    strength: 'Один замечает перемену в тоне раньше, чем она становится разговором, а второй не оставляет этот сигнал без ответа.',
    risk: 'Смена настроения быстро превращается в догадки: сигнал уже замечен, но причина ещё не названа.',
    action: 'Называйте состояние прямо, пока забота не превратилась в угадывание.',
  },
  attraction: {
    strength: 'Инициатива не повисает в воздухе: один подаёт импульс, второй его подхватывает.',
    risk: 'Искра легко становится давлением, если один ускоряет сближение, а второму нужен свой темп.',
    action: 'Оставляйте инициативе ответ, а не требование немедленно включиться.',
  },
  communication: {
    strength: 'Вы умеете быстро добраться до сути, когда обсуждаете один конкретный вопрос.',
    risk: 'Спор закручивается не из-за темы, а из-за разного темпа ответа: один уже требует ясности, второй ещё собирает слова.',
    action: 'Разделяйте сам вопрос и тон разговора, не пытаясь решить всё одной репликой.',
  },
  conflict_ease: {
    strength: 'После резкой реплики вы способны вернуться к предмету разговора, не превращая один эпизод в оценку всей связи.',
    risk: 'В напряжении один идёт вперёд, а второй защищается или берёт паузу — и спор начинает жить дольше самой причины.',
    action: 'Сначала договоритесь, когда вернётесь к разговору, и только потом берите паузу.',
  },
  trust_boundaries: {
    strength: 'Доверие растёт через понятные поступки: обещание подтверждается действием, а личное пространство не приходится отвоёвывать.',
    risk: 'Забота может незаметно стать контролем, а молчание — проверкой того, догадается ли другой.',
    action: 'Просьбу лучше назвать вслух, чем проверять близость догадкой.',
  },
  stability: {
    strength: 'Связь держат повторяемые вещи: выполненные договорённости, знакомый ритм и спокойная надёжность без громких жестов.',
    risk: 'Если правила остаются неясными, устойчивость подменяется привычкой терпеть неудобство.',
    action: 'Закрепляйте то, что уже работает, одной простой договорённостью.',
  },
  everyday_life: {
    strength: 'В повседневности вам проще, когда каждый видит не только результат, но и мелкие усилия другого.',
    risk: 'Разный бытовой темп превращает мелочь в спор о внимании и справедливости.',
    action: 'Распределяйте конкретные дела, не оставляя ожидания в режиме «и так понятно».',
  },
  autonomy: {
    strength: 'Близость не требует постоянного присутствия: каждому можно вернуться к своим делам без демонстративной дистанции.',
    risk: 'Пауза одного легко воспринимается другим как охлаждение или отказ от контакта.',
    action: 'Обозначайте границы паузы: сколько времени нужно и когда вы снова на связи.',
  },
  authenticity: {
    strength: 'Рядом проще говорить своим голосом и не собирать удобную версию себя для другого.',
    risk: 'Прямота ранит, если свободу быть собой используют как разрешение не учитывать реакцию другого.',
    action: 'Сохраняйте прямоту, но называйте её цель до резкой формулировки.',
  },
  shared_interest: {
    strength: 'Общий интерес быстро создаёт разговор и повод действовать вместе, а не только обмениваться планами.',
    risk: 'Контакт теряет энергию, когда совместность держится на одной привычной теме.',
    action: 'Добавляйте новый общий опыт раньше, чем общение начнёт повторять само себя.',
  },
  mutual_support: {
    strength: 'Поддержка читается в конкретном поступке: один замечает нагрузку, второй принимает помощь без долгого объяснения.',
    risk: 'Помощь раздражает, если её предлагают раньше, чем спросили, что действительно нужно.',
    action: 'Перед действием задайте один прямой вопрос: помочь, послушать или оставить пространство.',
  },
  decision_making: {
    strength: 'Решение появляется быстрее, когда один задаёт направление, а второй проверяет детали.',
    risk: 'Один считает вопрос уже решённым, пока второй только начал взвешивать последствия.',
    action: 'Фиксируйте момент решения вслух: обсуждаем, выбираем или уже действуем.',
  },
  role_balance: {
    strength: 'Роли складываются без борьбы, когда вклад каждого назван и не считается само собой разумеющимся.',
    risk: 'Один незаметно берёт больше ответственности, а потом предъявляет счёт за то, о чём не договаривались.',
    action: 'Пересобирайте роли до усталости, а не после неё.',
  },
  work_rhythm: {
    strength: 'Один задаёт темп, второй помогает не потерять качество — вместе это ускоряет работу без лишней суеты.',
    risk: 'Разная скорость превращает уточнение в торможение, а инициативу — в давление.',
    action: 'Согласуйте промежуточную точку проверки вместо постоянного взаимного контроля.',
  },
  responsibility: {
    strength: 'На договорённость можно опереться: задача не исчезает между разговором и исполнением.',
    risk: 'Ответственность становится неравной, если важные ожидания существуют только в голове одного человека.',
    action: 'Назовите владельца задачи и критерий готовности до начала работы.',
  },
  pressure_response: {
    strength: 'Под давлением один удерживает движение, а второй помогает не потерять важные детали.',
    risk: 'В стрессе скорость одного сталкивается с осторожностью другого, и рабочий вопрос быстро становится личным.',
    action: 'В напряжённый момент сначала разделите срочное и важное, затем обсуждайте способ работы.',
  },
};

function dimensionNarrative(id: CompatibilityDimensionKey, language: 'ru' | 'en'): DimensionNarrative {
  if (language === 'ru') return RU_DIMENSION_NARRATIVE[id];
  const label = id.replaceAll('_', ' ');
  return {
    strength: `${label} gives the pair a practical point of connection.`,
    risk: `Different responses around ${label} can turn a small mismatch into a larger argument.`,
    action: `Name one concrete expectation around ${label} before acting on assumptions.`,
  };
}

function prefersStrength(score: number, supportive: number, challenging: number): boolean {
  return score >= 55 && supportive >= challenging;
}

const BODY_LABELS: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
};

const ASPECT_LABELS: Record<string, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

function technicalLabel(
  labels: Record<string, { ru: string; en: string }>,
  key: string | undefined,
  language: 'ru' | 'en',
): string {
  if (!key) return language === 'ru' ? 'показатель карты' : 'chart factor';
  return labels[key]?.[language] || key;
}

function evidenceForDimension(
  calculated: CalculatedCompatibility,
  dimension: CompatibilityDimensionResult,
  supportive: boolean,
  sectionEvidenceIds: string[] = [],
): CompatibilityEvidence | null {
  const dimensionIds = supportive
    ? dimension.supportiveEvidenceIds
    : dimension.challengingEvidenceIds;
  const scopedIds = sectionEvidenceIds.length
    ? dimensionIds.filter((id) => sectionEvidenceIds.includes(id))
    : dimensionIds;
  const allowed = new Set(scopedIds.length ? scopedIds : dimensionIds);
  const candidates = calculated.evidence
    .filter((item) => allowed.has(item.id))
    .sort((first, second) => {
      const firstImpact = Math.abs(first.dimensionEffects[dimension.id] || 0) * first.weight;
      const secondImpact = Math.abs(second.dimensionEffects[dimension.id] || 0) * second.weight;
      return secondImpact - firstImpact || first.id.localeCompare(second.id);
    });
  return candidates[0] || null;
}

function evidenceNarrative(
  calculated: CalculatedCompatibility,
  evidence: CompatibilityEvidence | null,
  dimension: CompatibilityDimensionResult,
  supportive: boolean,
  input: NarrativeInput,
): string {
  if (!evidence) return '';
  const directional = calculated.directionalPatterns.find((pattern) => pattern.evidenceIds.includes(evidence.id));

  const language = input.language;
  const technical = evidence.technical || {};
  const subjectBody = technicalLabel(BODY_LABELS, technical.subjectKey, language);
  const partnerBody = technicalLabel(BODY_LABELS, technical.partnerKey, language);
  const aspect = technicalLabel(ASPECT_LABELS, technical.aspect, language);
  const orb = typeof technical.orb === 'number'
    ? language === 'ru' ? ` с орбом ${technical.orb.toFixed(1)}°` : ` with a ${technical.orb.toFixed(1)}° orb`
    : '';
  const sourceName = evidence.direction === 'partner_to_subject' ? input.partnerName : input.subjectName;
  const targetName = evidence.direction === 'partner_to_subject' ? input.subjectName : input.partnerName;
  const direction = directional
    ? language === 'ru'
      ? `Направление влияния: ${directional.title}.`
      : `Direction of influence: ${directional.title}.`
    : '';
  const impact = language === 'ru'
    ? supportive
      ? `Именно этот контакт добавляет опору в теме «${dimension.label}».`
      : `Именно здесь расчёт отмечает напряжение в теме «${dimension.label}».`
    : supportive
      ? `This contact directly supports ${dimension.label.toLowerCase()}.`
      : `This is where the calculation finds pressure around ${dimension.label.toLowerCase()}.`;

  if (evidence.type === 'aspect') {
    return language === 'ru'
      ? `Расчёт показывает аспект «${aspect}» между показателями «${subjectBody}» (${input.subjectName}) и «${partnerBody}» (${input.partnerName})${orb}. ${direction} ${impact}`.replace(/\s{2,}/g, ' ')
      : `Calculated aspect between ${subjectBody} (${input.subjectName}) and ${partnerBody} (${input.partnerName}): ${aspect}${orb}. ${direction} ${impact}`.replace(/\s{2,}/g, ' ');
  }
  if (evidence.type === 'angle') {
    return language === 'ru'
      ? `Расчёт показывает аспект «${aspect}» между показателем «${subjectBody}» (${sourceName}) и «${partnerBody}» второй карты (${targetName})${orb}. ${impact}`
      : `Calculated aspect between ${subjectBody} (${sourceName}) and the other chart's ${partnerBody} (${targetName}): ${aspect}${orb}. ${impact}`;
  }
  if (evidence.type === 'house_overlay' && typeof technical.house === 'number') {
    return language === 'ru'
      ? `Показатель «${subjectBody}» (${sourceName}) попадает в ${technical.house}-й дом второй карты (${targetName}). ${impact}`
      : `${subjectBody} (${sourceName}) falls in the other chart's house ${technical.house} (${targetName}). ${impact}`;
  }
  return `${evidence.label.replace(/[.!?]+$/, '')}. ${impact}`;
}

export function buildDeterministicCompatibilityNarrative(
  calculated: CalculatedCompatibility,
  input: NarrativeInput,
): CompatibilityWriterResponse {
  const strongest = calculated.strongestDimensions[0] || calculated.dimensions[0];
  const challenging = calculated.challengingDimensions[0] || calculated.dimensions.at(-1) || calculated.dimensions[0];
  const strengthCopy = dimensionNarrative(strongest.id, input.language);
  const challengeCopy = dimensionNarrative(challenging.id, input.language);
  const strengthEvidence = evidenceForDimension(calculated, strongest, true)
    || evidenceForDimension(calculated, strongest, false);
  const challengeEvidence = evidenceForDimension(calculated, challenging, false)
    || evidenceForDimension(calculated, challenging, true);
  const strengthFact = evidenceNarrative(calculated, strengthEvidence, strongest, true, input)
    || strengthCopy.strength;
  const challengeFact = evidenceNarrative(calculated, challengeEvidence, challenging, false, input)
    || challengeCopy.risk;
  const summary = input.language === 'ru'
    ? `Для пары ${input.subjectName} и ${input.partnerName} расчёт выделяет два главных факта. ${strengthFact} ${challengeFact} ${challengeCopy.action}`
    : `The calculation highlights two main facts for ${input.subjectName} and ${input.partnerName}. ${strengthFact} ${challengeFact} ${challengeCopy.action}`;

  const sections = calculated.sectionPlan.map((section, sectionIndex) => {
    const dimensions = section.dimensionIds
      .map((id) => calculated.dimensions.find((dimension) => dimension.id === id))
      .filter(Boolean) as typeof calculated.dimensions;
    const primary = dimensions[sectionIndex % Math.max(dimensions.length, 1)] || strongest;
    const secondary = dimensions.find((dimension) => dimension.id !== primary.id);
    const primaryCopy = dimensionNarrative(primary.id, input.language);
    const primaryIsStrength = prefersStrength(
      primary.score,
      primary.supportiveEvidenceIds.length,
      primary.challengingEvidenceIds.length,
    );
    const primaryEvidence = evidenceForDimension(calculated, primary, primaryIsStrength, section.evidenceIds)
      || evidenceForDimension(calculated, primary, !primaryIsStrength, section.evidenceIds);
    const lead = evidenceNarrative(calculated, primaryEvidence, primary, primaryIsStrength, input)
      || (primaryIsStrength ? primaryCopy.strength : primaryCopy.risk);
    const contrast = secondary
      ? (() => {
          const copy = dimensionNarrative(secondary.id, input.language);
          const secondaryIsStrength = prefersStrength(
            secondary.score,
            secondary.supportiveEvidenceIds.length,
            secondary.challengingEvidenceIds.length,
          );
          const secondaryEvidence = evidenceForDimension(
            calculated,
            secondary,
            secondaryIsStrength,
            section.evidenceIds,
          );
          if (secondaryEvidence?.id === primaryEvidence?.id) return '';
          return evidenceNarrative(calculated, secondaryEvidence, secondary, secondaryIsStrength, input)
            || (secondaryIsStrength ? copy.strength : copy.risk);
        })()
      : '';
    const action = primaryCopy.action;
    const text = [lead, contrast, action].filter(Boolean).join(' ');
    return { id: section.id, text };
  });

  return {
    summary,
    sections,
    closing: {
      strength: strengthFact,
      risk: challengeFact,
      action: challengeCopy.action,
    },
  };
}

const MACHINE_CLICHES = [
  'считывается',
  'ощущается',
  'проявляется',
  'между вами присутствует',
  'в этой связи',
  'возникает динамика',
  'наблюдается',
  'может быть непросто',
  'заметно там, где',
];

function acceptableWriterText(value: string, minLength: number): boolean {
  const text = value.trim();
  if (text.length < minLength) return false;
  const lower = text.toLocaleLowerCase('ru');
  return MACHINE_CLICHES.filter((phrase) => lower.includes(phrase)).length <= 1;
}

function cleanWriterResponse(value: unknown): CompatibilityWriterResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as { summary?: unknown; sections?: unknown; closing?: unknown };
  const summaryCandidate = typeof source.summary === 'string' ? source.summary.trim() : '';
  const summary = acceptableWriterText(summaryCandidate, 90) ? summaryCandidate : '';
  const seenSections = new Set<string>();
  const sections = Array.isArray(source.sections)
    ? source.sections.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const candidate = item as { id?: unknown; text?: unknown };
        const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
        const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
        const signature = text.toLocaleLowerCase('ru').replace(/\s+/g, ' ');
        if (!id || !acceptableWriterText(text, 80) || seenSections.has(signature)) return [];
        seenSections.add(signature);
        return [{ id, text }];
      })
    : [];
  const closingSource = source.closing && typeof source.closing === 'object' && !Array.isArray(source.closing)
    ? source.closing as { strength?: unknown; risk?: unknown; action?: unknown }
    : null;
  const closing = closingSource
    ? {
        strength: typeof closingSource.strength === 'string' && acceptableWriterText(closingSource.strength, 24) ? closingSource.strength.trim() : '',
        risk: typeof closingSource.risk === 'string' && acceptableWriterText(closingSource.risk, 24) ? closingSource.risk.trim() : '',
        action: typeof closingSource.action === 'string' && acceptableWriterText(closingSource.action, 24) ? closingSource.action.trim() : '',
      }
    : { strength: '', risk: '', action: '' };
  return summary || sections.length || closing.strength || closing.risk || closing.action
    ? { summary, sections, closing }
    : null;
}

export function buildCompatibilityResult(
  calculated: CalculatedCompatibility,
  writerValue: unknown,
  input: NarrativeInput,
): SynastryResult {
  const fallback = buildDeterministicCompatibilityNarrative(calculated, input);
  const writer = cleanWriterResponse(writerValue);
  const allowedSections = new Map((writer?.sections || []).map((section) => [section.id, section.text]));
  const fallbackSections = new Map(fallback.sections.map((section) => [section.id, section.text]));
  const sections: CompatibilityReadingSection[] = calculated.sectionPlan.map((section) => ({
    id: section.id,
    title: section.title,
    text: allowedSections.get(section.id) || fallbackSections.get(section.id) || '',
    evidenceIds: section.evidenceIds,
  }));
  const tensionIds = new Set(['tension', 'conflicts', 'friction', 'recurring_arguments', 'under_pressure']);
  const difficulty = sections.find((section) => tensionIds.has(section.id)) || sections.at(-2) || sections[0];
  const potential = sections.at(-1) || sections[0];
  const connection = sections.find((section) => ['brings_closer', 'emotional_closeness', 'support', 'work_together'].includes(section.id)) || sections[1] || sections[0];

  return {
    schemaVersion: 'compatibility-v2',
    engineVersion: calculated.engineVersion,
    overallScore: calculated.overallScore,
    compatibilityScore: calculated.overallScore,
    verdict: calculated.verdict,
    relationshipContext: calculated.relationshipContext,
    calculationLevel: calculated.calculationLevel,
    dimensions: calculated.dimensions,
    strongestDimensions: calculated.strongestDimensions,
    challengingDimensions: calculated.challengingDimensions,
    sections,
    evidence: calculated.evidence,
    directionalPatterns: calculated.directionalPatterns,
    limitations: calculated.limitations,
    closing: {
      strength: writer?.closing.strength || fallback.closing.strength,
      risk: writer?.closing.risk || fallback.closing.risk,
      action: writer?.closing.action || fallback.closing.action,
    },
    summary: writer?.summary || fallback.summary,
    fullAnalysis: {
      generalTheme: sections[0]?.text || fallback.summary,
      attraction: connection?.text || '',
      difficulties: difficulty?.text || '',
      recommendations: [],
      potential: potential?.text || '',
    },
  };
}
