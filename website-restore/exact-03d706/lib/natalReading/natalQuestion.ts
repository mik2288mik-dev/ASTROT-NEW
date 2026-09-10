import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { APP_VOICE_VERSION, getAppSystemVoice, withAppVoiceVersion } from '../appVoice';
import {
  createLunaStructuredResponse,
  OPENAI_LUNA_MODEL,
  type StrictJsonSchema,
} from '../openaiResponses';
import {
  moderatePersonalForecastCustomQuestion,
  normalizePersonalForecastQuestionInput,
  type PersonalForecastQuestionModerationReason,
} from '../personalForecastQuestionModeration';
import {
  buildNatalModelContext,
  buildNatalPromptContext,
  getNatalNarrativeEvidenceIds,
  hasNatalPersonalityCopyViolation,
  isNatalReliabilityTextAllowed,
  NATAL_PERMANENT_CONTRACT_VERSION,
  type BuiltNatalModelContext,
  type NatalPermanentPremiumReport,
  type NatalReadingLanguage,
} from './permanentReport';
import type {
  NatalFreeQuestionUsage,
  NatalQuestionStoredMessage,
  NatalQuestionUsage,
} from './natalQuestionStore';

const MAX_ANSWER_ATTEMPTS = 2;

export const NATAL_QUESTION_PROMPT_VERSION = withAppVoiceVersion(
  'natal-question.v4.scope-gate.responses-strict-schema-repair',
);
export const NATAL_QUESTION_CONTRACT_VERSION = 'natal-question-v4';

const NATAL_QUESTION_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    evidence_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'evidence_ids'],
  additionalProperties: false,
};

export type NatalQuestionModeration = {
  status: 'approved' | 'rejected';
  reason:
    | PersonalForecastQuestionModerationReason
    | 'relevant_natal_question'
    | 'not_natal_question'
    | 'needs_specificity'
    | 'professional_prescription'
    | 'sensitive_personal_data'
    | 'third_party_inference'
    | 'compatibility_requires_two_charts';
  normalizedQuestion: string;
};

export type NatalQuestionAnswer = {
  text: string;
  evidenceIds: string[];
  model?: string;
  generationAttempts?: 1 | 2;
};

export type NatalQuestionValidationCode =
  | 'ANSWER_TOO_SHORT'
  | 'ANSWER_TOO_LONG'
  | 'SENTENCE_COUNT_INVALID'
  | 'EVIDENCE_REQUIRED'
  | 'EVIDENCE_UNKNOWN'
  | 'COPY_VIOLATION'
  | 'DIAGNOSTIC_CLAIM'
  | 'PROFESSIONAL_IMPERATIVE'
  | 'GUARANTEED_OUTCOME'
  | 'KARMIC_CLAIM'
  | 'STRONG_GUARANTEE'
  | 'HIGH_STAKES_PRESCRIPTION'
  | 'UNSUPPORTED_FUTURE_TIMING'
  | 'UNSUPPORTED_FUTURE_EVENT'
  | 'RELIABILITY_VIOLATION';

export class NatalQuestionValidationError extends Error {
  readonly code = 'NATAL_QUESTION_VALIDATION_FAILED';

  constructor(
    readonly validationCodes: readonly NatalQuestionValidationCode[],
    readonly attempts: number,
  ) {
    super('NATAL_QUESTION_VALIDATION_FAILED');
    this.name = 'NatalQuestionValidationError';
  }
}

export type NatalQuestionSnapshot = {
  chartId: number;
  messages: NatalQuestionStoredMessage[];
  usage: NatalQuestionUsage;
  access: {
    isPremium: boolean;
    freeQuestionUsed: NatalFreeQuestionUsage['used'];
    freeQuestionRemaining: NatalFreeQuestionUsage['remaining'];
  };
  promptVersion: string;
  voiceVersion: string;
};

export type NatalQuestionPromptContext = {
  chartId: number;
  chart: ReturnType<typeof buildNatalPromptContext>;
  permanentReport: NatalPermanentPremiumReport;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    text: string;
    evidenceIds: string[];
  }>;
  question: string;
};

type RawNatalQuestionAnswer = {
  answer?: unknown;
  evidence_ids?: unknown;
};

type NatalQuestionAnswerRequester = (input: {
  language: NatalReadingLanguage;
  prompt: string;
}) => Promise<RawNatalQuestionAnswer>;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function evidenceIdsFromPayload(payload: Record<string, unknown> | null): string[] {
  const value = payload?.evidenceIds || payload?.evidence_ids;
  return Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))]
    : [];
}

const NATAL_SCOPE_PATTERNS = [
  /(?:натальн[\p{L}-]*\s+карт|карт[\p{L}-]*\s+рождени|гороскоп|астролог|зодиак|асцендент|десцендент|планет|солнц|лун|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|аспект|транзит|ретроград|знак[\p{L}-]*\s+зодиак|дом[\p{L}-]*\s+(?:карт|гороскоп))/iu,
  /(?:natal\s+chart|birth\s+chart|horoscope|astrolog|zodiac|ascendant|descendant|planet|sun\s+sign|moon\s+sign|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|aspect|transit|retrograde)/iu,
] as const;

const EXPLICIT_CHART_SCOPE_PATTERNS = [
  /(?:натальн[\p{L}-]*\s+карт|карт[\p{L}-]*\s+рождени|личн[\p{L}-]*\s+гороскоп|гороскоп[\p{L}-]*\s+рождени)/iu,
  /(?:natal\s+chart|birth\s+chart|personal\s+horoscope|birth\s+horoscope)/iu,
] as const;

const ASTROLOGY_FACTOR_PATTERNS = [
  /(?:асцендент|десцендент|планет|солнц|лун|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|аспект|транзит|ретроград|знак[\p{L}-]*\s+зодиак|дом[\p{L}-]*\s+(?:карт|гороскоп))/iu,
  /(?:ascendant|descendant|planet|sun\s+sign|moon\s+sign|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|aspect|transit|retrograde|zodiac\s+sign|chart\s+house)/iu,
] as const;

const PERSONAL_SUBJECT_PATTERNS = [
  /(?:^|[^\p{L}])(?:я|мне|меня|мной|мой|моя|мо[её]|мои|мою|моего|моей|мо[её]м|моим|моими|моих|у\s+меня|обо\s+мне|про\s+меня)(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:i|me|my|mine|myself|about\s+me)(?:$|[^\p{L}])/iu,
] as const;

const INTERPRETIVE_INTENT_PATTERNS = [
  /(?:почему|зачем|как|что|како(?:й|я|е|ие)|когда|где|из-за\s+чего|что\s+(?:значит|означает|говорит|показывает)|разбери|объясни|расскажи|помогает|мешает|проявляется|реагир|веду\s+себя|склон(?:ен|на)|стоит\s+ли|можно\s+ли|будет\s+ли|подходит\s+ли)/iu,
  /(?:why|how|what|which|when|where|what\s+does|explain|interpret|tell\s+me|describe|helps?|gets?\s+in\s+the\s+way|shows?\s+up|react|behave|tend\s+to|should\s+i|can\s+i|will\s+i|is\s+it)/iu,
] as const;

const PERSONAL_PATTERN_DOMAIN_PATTERNS = [
  /(?:характер|черт[\p{L}-]*|сильн[\p{L}-]*\s+сторон|слаб[\p{L}-]*\s+сторон|талант|способност|реакц|реагир|эмоц|чувств|привыч|поведен|решен|выбор|сомнен|риск|общен|разговор|конфликт|спор|границ|довер|помощ|отношен|любов|близост|семь|родител|друз|муж|жен|супруг|работ|карьер|профес|коллег|руковод|деньг|доход|трат|накоп|самооцен|уверен|страх|контрол|ответствен|мотивац|цел[ьи]|темп|инициатив|лидер|партн[её]р|прокраст|откладыв|дисциплин|организ|довож|начина)/iu,
  /(?:character|trait|strength|weakness|talent|abilit|reaction|react|emotion|feeling|habit|behavio|decision|choice|doubt|risk|communicat|conversation|conflict|argument|boundar|trust|help|relationship|love|intimacy|family|parent|friend|husband|wife|spouse|work|career|profession|colleague|manager|money|income|spend|saving|confidence|fear|control|responsibilit|motivation|goal|pace|initiative|leader|partner|procrastinat|put\w*\s+off|disciplin|organi[sz]|follow\w*\s+through|start\w*)/iu,
] as const;

const TIMING_QUESTION_PATTERNS = [
  /(?:сегодня|завтра|на\s+этой\s+недел|на\s+следующей\s+недел|в\s+этом\s+месяц|в\s+следующем\s+месяц|в\s+этом\s+году|когда|какая\s+дат|лучший\s+ли\s+день|подходящ\w*\s+(?:день|момент)|составь\s+(?:мне\s+)?гороскоп|сделай\s+(?:мне\s+)?гороскоп|дай\s+(?:мне\s+)?гороскоп)/iu,
  /(?:today|tomorrow|this\s+week|next\s+week|this\s+month|next\s+month|this\s+year|when|which\s+date|best\s+day|right\s+time|make\s+(?:me\s+)?a\s+horoscope|give\s+me\s+a\s+horoscope)/iu,
] as const;

const TIMING_DECISION_PATTERNS = [
  /(?:стоит\s+ли|можно\s+ли|подходит\s+ли|лучший\s+ли|начин|запуск|публикац|переезд|решен|разговор|встреч|отношен|работ|покуп|подпис|гороскоп)/iu,
  /(?:should\s+i|can\s+i|is\s+it|best|start|launch|publish|move|decision|conversation|meeting|relationship|work|buy|sign|horoscope)/iu,
] as const;

const UNIVERSAL_ASSISTANT_TASK_PATTERNS = [
  /(?:^|[^\p{L}])(?:приготовь|свари|испеки|пожарь|купи|закажи|подбери|посоветуй|выбери|напиши|сочини|переведи|исправь|отладь|запрограммируй|реши|нарисуй|создай|поставь|отправь|забронируй|построй|проложи|спланируй)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:сделай|составь)(?!\s+(?:мне\s+)?гороскоп)(?!\p{L})/iu,
  /(?:приготов|свари|испек|пожарь|рецепт|составь\s+меню|посчитай\s+калори|борщ|суп(?!\p{L}))/iu,
  /(?:(?:купи|закажи|подбери|посоветуй|выбери)(?!\p{L})[^.!?]{0,100}(?:телефон|ноутбук|товар|одежд|подарок|отел|ресторан|курс)|какой\s+(?:телефон|ноутбук|товар)\s+(?:купить|выбрать))/iu,
  /(?:напиши|сочини|расскажи|придумай|переведи|перевод|исправь|отладь|запрограммируй|реши|сделай)(?!\p{L})[^.!?]{0,100}(?:анекдот|шутк|стих|песн|письм|пост|резюме|код|программ|скрипт|домашн|задач|контрольн|экзамен|презентац)/iu,
  /(?:прогноз\s+погоды|температура\s+на\s+улице|сч[её]т\s+(?:матча|игры)|новост|курс\s+валют|столица\s+какой|кто\s+(?:президент|выиграл))/iu,
  /(?:нарисуй|создай\s+(?:картин|изображен|видео)|поставь\s+напоминан|отправь\s+(?:письм|сообщен)|забронируй)/iu,
  /(?:составь|построй|проложи|спланируй)(?!\p{L})[^.!?]{0,100}(?:маршрут|поездк|путешеств|расписан|трениров|диет|бюджет)/iu,
  /(?:cook|recipe|boil|bake|fry|make\s+(?:me\s+)?(?:dinner|lunch|breakfast)|calories)/iu,
  /(?:(?:buy|order|pick|recommend|choose)\b[^.!?]{0,100}(?:phone|laptop|product|clothes|gift|hotel|restaurant|course)|which\s+(?:phone|laptop|product)\s+should\s+i\s+buy)/iu,
  /(?:write|compose|tell|make|translate|fix|debug|program|solve|do)\b[^.!?]{0,100}(?:joke|poem|song|email|post|resume|code|program|script|homework|exam|presentation)/iu,
  /(?:weather\s+forecast|temperature\s+outside|match\s+score|game\s+score|news|exchange\s+rate|who\s+(?:is\s+the\s+president|won))/iu,
  /(?:draw|create\s+(?:an?\s+)?(?:image|picture|video)|set\s+(?:a\s+)?reminder|send\s+(?:an?\s+)?(?:email|message)|book\s+(?:a\s+)?(?:hotel|table|flight))/iu,
  /(?:build|make|plan)\b[^.!?]{0,100}(?:route|trip|travel|schedule|workout|diet|budget)/iu,
  /(?:^|[^\p{L}])(?:cook|boil|bake|fry|buy|order|pick|recommend|choose|write|compose|translate|fix|debug|program|solve|draw|create|set|send|book)(?!\p{L})/iu,
  /(?:^|[^\p{L}])make(?!\s+(?:me\s+)?a\s+horoscope)(?!\p{L})/iu,
] as const;

const PRESCRIPTIVE_ASSISTANT_REQUEST_PATTERNS = [
  /(?:как|что)\s+мне\s+(?:лучше\s+)?(?:сделать|делать|найти|получить|добиться|заработать|увеличить|выбрать|купить|продать|написать|составить|подготовить|выучить|помириться|вернуть|убедить|заставить|уволиться|устроиться|перейти|переехать|построить|общаться|вести\s+себя|поступить|решить)(?!\p{L})/iu,
  /(?:дай|составь)\s+(?:мне\s+)?(?:совет|план|инструкц|список|стратег)/iu,
  /(?:how|what)\s+(?:can|should|do)\s+i\s+(?:make|do|find|get|achieve|earn|increase|choose|buy|sell|write|prepare|learn|reconcile|win\s+back|convince|force|quit|apply|move|build|communicate|behave|decide)(?!\p{L})/iu,
  /(?:give|make)\s+me\s+(?:advice|a\s+plan|an?\s+instruction|a\s+list|a\s+strategy)/iu,
] as const;

const PROFESSIONAL_PRESCRIPTION_PATTERNS = [
  /(?:диагноз|диагност|болезн|заболеван|лечен|лекарств|препарат|таблет|дозировк)/iu,
  /(?:как\s+выиграть\s+суд|подавать\s+ли\s+в\s+суд|юридическ\w*\s+(?:совет|стратег)|как\s+уйти\s+от\s+налог)/iu,
  /(?:куда\s+вложить\s+деньги|какие\s+акци\w*\s+купить|инвестировать\s+ли|брать\s+ли\s+кредит|оформлять\s+ли\s+ипотек)/iu,
  /(?:diagnos|disease|illness|treat(?:ment)?|medicine|medication|pills?|dosage)/iu,
  /(?:how\s+to\s+win\s+(?:a\s+)?lawsuit|should\s+i\s+sue|legal\s+(?:advice|strategy)|evade\s+tax)/iu,
  /(?:where\s+should\s+i\s+invest|which\s+stocks?\s+should\s+i\s+buy|should\s+i\s+invest|should\s+i\s+take\s+(?:a\s+)?loan|should\s+i\s+get\s+(?:a\s+)?mortgage)/iu,
] as const;

const SENSITIVE_INPUT_PATTERNS = [
  /(?:здоровь|медицин|диагноз|диагност|болезн|заболеван|лечен|лекарств|препарат|таблет|дозировк|после\s+операци|беременн|депресси|паническ[\p{L}-]*\s+атак|психиатр|психотерап|расстройств)/iu,
  /\b(?:health|medical|diagnos|disease|illness|treat(?:ment)?|medicine|medication|pills?|dosage|surgery|pregnan|depress|panic\s+attack|psychiatr|psychotherap|disorder)\w*\b/iu,
  /(?:паспорт|снилс|(?<!\p{L})инн(?!\p{L})|водительск[\p{L}-]*\s+удостовер|удостоверен[\p{L}-]*\s+личност|номер\s+документ|серия\s+(?:и\s+)?номер)/iu,
  /\b(?:passport|social\s+security|ssn|tax\s+id|driver'?s\s+licen[cs]e|identity\s+document|document\s+number)\b/iu,
  /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/iu,
  /(?:@[\p{L}\d_]{3,}|(?:телефон|номер\s+телефона|мой\s+номер|phone(?:\s+number)?|contact\s+me)[^.!?\n]{0,32}\+?\d)/iu,
  /(?<!\d)(?:\+\d[\d\s()-]{8,}\d)(?!\d)/u,
  /(?:парол|пин[-\s]?код|код\s+из\s+смс|одноразов[\p{L}-]*\s+код|код\s+подтвержден|(?<!\p{L})otp(?!\p{L})|(?<!\p{L})(?:cvv|cvc)(?!\p{L}))/iu,
  /\b(?:password|passcode|pin\s+code|one[-\s]?time\s+(?:password|code)|verification\s+code|otp|cvv|cvc)\b/iu,
  /(?:банковск[\p{L}-]*\s+карт|номер\s+карт|плат[её]жн[\p{L}-]*\s+данн|банковск[\p{L}-]*\s+реквизит|номер\s+сч[её]та|(?<!\p{L})(?:бик|iban)(?!\p{L}))/iu,
  /\b(?:bank\s+card|card\s+number|payment\s+data|bank\s+details|bank\s+account|account\s+number|routing\s+number|iban)\b/iu,
  /(?<!\d)(?:\d[\s-]*){13,19}(?!\d)/u,
] as const;

const THIRD_PARTY_INFERENCE_PATTERNS = [
  /(?:что|как)\s+(?:он|она|они|мо[йя]\s+(?:партн[её]р|муж|жена)|муж|жена)\s+(?:думает|чувствует|скрывает)|(?:любит|обманывает|изменяет)\s+ли\s+(?:он|она|мо[йя]\s+партн[её]р|партн[её]р|муж|жена)|верн[её]тся\s+ли\s+(?:он|она|мо[йя]\s+(?:партн[её]р|муж|жена))/iu,
  /(?:расскажи\s+(?:мне\s+)?(?:про|о)|како[йя]\s+характер\s+у|какие\s+(?:сильные|слабые)\s+стороны\s+у)\s+мо(?:его|ей|ю|им)\s+(?:партн[её]р|муж|жен|начальник|коллег|друг|подруг|мам|пап|реб[её]н|сын|доч)/iu,
  /(?:как|почему)\s+мо[йя]\s+(?:партн[её]р|муж|жена|начальник|коллега|друг|подруга)\s+(?:обычно\s+)?(?:реагирует|вед[её]т\s+себя|поступает)/iu,
  /(?:what|how)\s+(?:(?:does|do)\s+)?(?:he|she|they|my\s+partner|my\s+husband|my\s+wife)\s+(?:thinks?|feels?|hides?)|does\s+(?:he|she|my\s+partner|my\s+husband|my\s+wife)\s+(?:love|cheat|lie)|will\s+(?:he|she|my\s+partner|my\s+husband|my\s+wife)\s+come\s+back/iu,
  /(?:tell\s+me\s+about|what\s+is\s+the\s+character\s+of|what\s+are\s+the\s+(?:strengths|weaknesses)\s+of)\s+my\s+(?:partner|husband|wife|manager|colleague|friend|mother|father|child|son|daughter)/iu,
  /(?:how|why)\s+(?:does\s+)?my\s+(?:partner|husband|wife|manager|colleague|friend)\s+(?:usually\s+)?(?:react|behave|act)/iu,
  /(?:почему|как|зачем)\s+(?:(?:мо[йяи]\s+)?(?:партн[её]р|муж|жена|начальник|коллег[аи]?|коллеги|друг|подруга|друзья|родител[ьи]|дети)|он|она|они)\s+[^.!?]{0,55}?(?:не\s+)?(?:разговарива|говорит|игнорир|избега|отдаля|молчит|ценит|уважает|поддержива|доверя|обижает|критику|контролир|злится|сердится|любит|хочет|решил|решила|вед[её]т\s+себя|поступает|реагирует)/iu,
  /(?:why|how)\s+(?:(?:does|do)\s+)?(?:my\s+(?:partner|husband|wife|manager|colleague|colleagues|friend|friends|parents?|children)|he|she|they)\s+[^.!?]{0,55}?(?:not\s+)?(?:talk|speak|ignore|avoid|withdraw|stay\s+silent|value|respect|support|trust|hurt|criticize|control|get\s+angry|love|want|decide|behave|act|react)/iu,
] as const;

const COMPATIBILITY_PATTERNS = [
  /(?:совместим|подходим\s+ли\s+мы|наша\s+совместимость|что\s+жд[её]т\s+нашу\s+пару)/iu,
  /(?:compatib|are\s+we\s+(?:a\s+)?(?:match|right\s+for\s+each\s+other)|our\s+relationship\s+future)/iu,
] as const;

const VAGUE_QUESTION_PATTERNS = [
  /^(?:что\s+делать|как\s+быть|что\s+дальше|что\s+скажешь|что\s+в\s+(?:моей\s+)?(?:натальной\s+)?карт[еы]|расскажи(?:\s+мне)?|помоги|про\s+меня|обо\s+мне|про\s+отношения|про\s+работу|что[-\s]?нибудь)(?:\s+(?:по|согласно)\s+(?:моей\s+)?(?:натальной\s+)?карт[еы])?[?!.]*$/iu,
  /^(?:what\s+should\s+i\s+do|what\s+now|what\s+do\s+you\s+think|what(?:'s|\s+is)\s+in\s+my\s+(?:natal\s+|birth\s+)?chart|tell\s+me|help\s+me|about\s+me|about\s+relationships|about\s+work|anything)(?:\s+(?:from|according\s+to)\s+my\s+(?:natal\s+|birth\s+)?chart)?[?!.]*$/iu,
] as const;

const REQUEST_DIRECTIVE_START_SOURCE = String.raw`(?:(?:пожалуйста\s*,?\s*)?(?:расскажи(?:те)?|объясни(?:те)?|опиши(?:те)?|разбери(?:те)?|покажи(?:те)?|назови(?:те)?|дай(?:те)?|напиши(?:те)?|сочини(?:те)?|переведи(?:те)?|составь(?:те)?|сделай(?:те)?|приготовь(?:те)?|придумай(?:те)?|создай(?:те)?|реши(?:те)?|помоги(?:те)?|подскажи(?:те)?|посоветуй(?:те)?|выбери(?:те)?|купи(?:те)?|закажи(?:те)?|нарисуй(?:те)?|отправь(?:те)?|поставь(?:те)?|забронируй(?:те)?|спланируй(?:те)?|свари(?:те)?|испеки(?:те)?|пожарь(?:те)?)|(?:(?:please\s+)?(?:tell|explain|describe|interpret|show|name|give|write|compose|translate|make|cook|create|solve|help|suggest|recommend|choose|buy|order|draw|send|set|book|plan)))`;
const REQUEST_PART_START_SOURCE = String.raw`(?:${REQUEST_DIRECTIVE_START_SOURCE}|(?:почему|зачем|как(?:ой|ая|ое|ие)?|что|когда|где|стоит\s+ли|можно\s+ли|будет\s+ли|подходит\s+ли)|(?:why|how|what|which|when|where|should\s+i|can\s+i|will\s+i|is\s+it))`;
const CONNECTED_CLAUSE_START_SOURCE = String.raw`(?:${REQUEST_PART_START_SOURCE}|(?:я|мне|меня|мой|моя|мо[её]|мои|это|эта|этот|эти)|(?:i|me|my|it|this|that|these))`;
const REQUEST_PART_START_PATTERN = new RegExp(
  String.raw`^\s*${REQUEST_PART_START_SOURCE}(?:$|[^\p{L}])`,
  'iu',
);
const SEMANTIC_REQUEST_PART_BOUNDARY = new RegExp(
  String.raw`(?:[.!?…;]+\s*|\n+|,\s*(?=${REQUEST_DIRECTIVE_START_SOURCE}(?:$|[^\p{L}]))|,\s*(?:(?:и(?:\s+ещ[её])?|а(?:\s+ещ[её])?|но|зато|однако|затем|потом|также|плюс|после\s+этого)|(?:and|but|yet|however|also|then|plus|after\s+that))\s+|\s+(?:(?:и(?:\s+ещ[её])?|а(?:\s+ещ[её])?|но|зато|однако)|(?:and|but|yet|however))\s+(?=${CONNECTED_CLAUSE_START_SOURCE}(?:$|[^\p{L}])))`,
  'giu',
);

const CONTEXTUAL_INTERPRETATION_PATTERNS = [
  /(?:что\s+(?:это|этот|эта|эти|такое|такой|положение|аспект|связь)\s+(?:значит|означает|показывает)|как\s+(?:это|этот|эта|эти|такое|такой|положение|аспект|связь)\s+(?:влияет|проявляется|связано|работает|мешает|помогает)|почему\s+(?:это|этот|эта|эти|такое|такой|положение|аспект|связь)\s+(?:происходит|проявляется|повторяется|мешает|помогает)|(?:объясни|расскажи|опиши|разбери)(?:те)?[^.!?]{0,40}(?:его|е[её]|их|этого|этой|этих)\s+(?:влияни|значени|роль|проявлен))/iu,
  /(?:what\s+(?:does\s+)?(?:it|this|that|these|the\s+placement|the\s+aspect|the\s+connection)\s+(?:mean|show)|how\s+(?:it|this|that|these|the\s+placement|the\s+aspect|the\s+connection)\s+(?:affects?|shows?\s+up|relates?|works?|helps?|gets?\s+in\s+the\s+way)|why\s+(?:it|this|that|these|the\s+placement|the\s+aspect|the\s+connection)\s+(?:happens?|shows?\s+up|repeats?|helps?|gets?\s+in\s+the\s+way)|(?:explain|tell|describe|interpret)[^.!?]{0,40}(?:its|their|this|that)\s+(?:effect|meaning|role|influence))/iu,
] as const;

const CONTEXTUAL_PERSONAL_STATEMENT_PATTERNS = [
  /^(?:и\s+)?(?:это|такое|так|эта|этот|эти|такая\s+реакция|такой\s+сценарий)(?:$|[^\p{L}])[^.!?]{0,180}(?:повторя|проявля|меша|помога|влия|случа|работ|отношен|решен|реакц|чувств|привыч|поведен|конфликт|деньг|самооцен|страх|контрол)/iu,
  /^(?:and\s+)?(?:it|this|that|these|such\s+a\s+reaction|this\s+pattern)\b[^.!?]{0,180}(?:repeat|show\w*\s+up|affect|help|hinder|get\w*\s+in\s+the\s+way|work|relationship|decision|reaction|feeling|habit|behavio|conflict|money|confidence|fear|control)/iu,
] as const;

function matchesQuestionPolicy(
  value: string,
  patterns: readonly RegExp[],
): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasNatalQuestionContext(value: string): boolean {
  const hasPersonalSubject = matchesQuestionPolicy(value, PERSONAL_SUBJECT_PATTERNS);
  return matchesQuestionPolicy(value, NATAL_SCOPE_PATTERNS)
    || (
      hasPersonalSubject
      && (
        matchesQuestionPolicy(value, PERSONAL_PATTERN_DOMAIN_PATTERNS)
        || matchesQuestionPolicy(value, ASTROLOGY_FACTOR_PATTERNS)
      )
    );
}

function isInScopeNatalRequestPart(value: string, hasPriorNatalContext: boolean): boolean {
  const hasInterpretiveIntent = matchesQuestionPolicy(value, INTERPRETIVE_INTENT_PATTERNS);
  const hasPersonalPatternDomain = matchesQuestionPolicy(
    value,
    PERSONAL_PATTERN_DOMAIN_PATTERNS,
  );
  const hasPersonalSubject = matchesQuestionPolicy(value, PERSONAL_SUBJECT_PATTERNS);
  const hasNatalScope = matchesQuestionPolicy(value, NATAL_SCOPE_PATTERNS);
  const isExplicitNatalQuestion = hasNatalScope
    && hasPersonalSubject
    && hasInterpretiveIntent
    && (
      hasPersonalPatternDomain
      || matchesQuestionPolicy(value, ASTROLOGY_FACTOR_PATTERNS)
    );
  const isPersonalPatternQuestion = hasPersonalSubject
    && hasPersonalPatternDomain
    && hasInterpretiveIntent;
  const isTimingQuestion = matchesQuestionPolicy(value, TIMING_QUESTION_PATTERNS)
    && matchesQuestionPolicy(value, TIMING_DECISION_PATTERNS)
    && (hasPersonalSubject || hasNatalScope);
  const isContextualContinuation = hasPriorNatalContext
    && matchesQuestionPolicy(value, CONTEXTUAL_INTERPRETATION_PATTERNS);

  return isExplicitNatalQuestion
    || isPersonalPatternQuestion
    || isTimingQuestion
    || isContextualContinuation;
}

function hasOutOfScopeSemanticRequestPart(value: string): boolean {
  const parts = value
    .split(SEMANTIC_REQUEST_PART_BOUNDARY)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return false;

  let hasPriorNatalContext = false;
  for (const part of parts) {
    const isRequestPart = REQUEST_PART_START_PATTERN.test(part);
    const isInScopeRequest = isRequestPart
      && isInScopeNatalRequestPart(part, hasPriorNatalContext);
    const hasPartNatalContext = hasNatalQuestionContext(part);
    const isContextualPersonalStatement = hasPriorNatalContext
      && matchesQuestionPolicy(part, CONTEXTUAL_PERSONAL_STATEMENT_PATTERNS);
    const isContextualPersonalDomain = hasPriorNatalContext
      && !isRequestPart
      && matchesQuestionPolicy(part, PERSONAL_PATTERN_DOMAIN_PATTERNS);
    if (
      (isRequestPart && !isInScopeRequest)
      || (
        !isRequestPart
        && !hasPartNatalContext
        && !isContextualPersonalStatement
        && !isContextualPersonalDomain
      )
    ) return true;
    if (
      isInScopeRequest
      || hasPartNatalContext
      || isContextualPersonalStatement
      || isContextualPersonalDomain
    ) {
      hasPriorNatalContext = true;
    }
  }
  return false;
}

export function moderateNatalQuestion(input: {
  question: unknown;
  language: NatalReadingLanguage;
  existingQuestions?: readonly string[];
}): NatalQuestionModeration {
  const question = normalizePersonalForecastQuestionInput(input.question);
  const shared = moderatePersonalForecastCustomQuestion({
    question,
    language: input.language,
    period: 'month',
    existingCustomQuestions: input.existingQuestions,
  });
  if (matchesQuestionPolicy(question, SENSITIVE_INPUT_PATTERNS)) {
    return {
      status: 'rejected',
      reason: matchesQuestionPolicy(question, PROFESSIONAL_PRESCRIPTION_PATTERNS)
        ? 'professional_prescription'
        : 'sensitive_personal_data',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (shared.status === 'rejected' && shared.reason !== 'duplicate_catalog') {
    return {
      status: 'rejected',
      reason: shared.reason,
      normalizedQuestion: shared.normalizedQuestion,
    };
  }

  if (hasOutOfScopeSemanticRequestPart(question)) {
    return {
      status: 'rejected',
      reason: 'not_natal_question',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }

  if (matchesQuestionPolicy(question, UNIVERSAL_ASSISTANT_TASK_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'not_natal_question',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, PRESCRIPTIVE_ASSISTANT_REQUEST_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'not_natal_question',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, PROFESSIONAL_PRESCRIPTION_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'professional_prescription',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, THIRD_PARTY_INFERENCE_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'third_party_inference',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, COMPATIBILITY_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'compatibility_requires_two_charts',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, VAGUE_QUESTION_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'needs_specificity',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }

  const hasInterpretiveIntent = matchesQuestionPolicy(
    question,
    INTERPRETIVE_INTENT_PATTERNS,
  );
  const hasPersonalPatternDomain = matchesQuestionPolicy(
    question,
    PERSONAL_PATTERN_DOMAIN_PATTERNS,
  );
  const hasPersonalSubject = matchesQuestionPolicy(question, PERSONAL_SUBJECT_PATTERNS);
  const hasExplicitChartScope = matchesQuestionPolicy(question, EXPLICIT_CHART_SCOPE_PATTERNS);
  const isExplicitNatalQuestion = matchesQuestionPolicy(question, NATAL_SCOPE_PATTERNS)
    && hasInterpretiveIntent
    && (
      (hasPersonalSubject && (
        hasPersonalPatternDomain
        || matchesQuestionPolicy(question, ASTROLOGY_FACTOR_PATTERNS)
      ))
      || (hasExplicitChartScope && hasPersonalPatternDomain)
    );
  const isPersonalPatternQuestion = hasPersonalSubject && hasPersonalPatternDomain
    && hasInterpretiveIntent;
  const isTimingQuestion = matchesQuestionPolicy(question, TIMING_QUESTION_PATTERNS)
    && matchesQuestionPolicy(question, TIMING_DECISION_PATTERNS)
    && (
      hasPersonalSubject
      || matchesQuestionPolicy(question, NATAL_SCOPE_PATTERNS)
    );

  if (!isExplicitNatalQuestion && !isPersonalPatternQuestion && !isTimingQuestion) {
    return {
      status: 'rejected',
      reason: shared.status === 'pending' ? 'needs_specificity' : 'not_natal_question',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }

  return {
    status: 'approved',
    reason: 'relevant_natal_question',
    normalizedQuestion: shared.normalizedQuestion,
  };
}

export function buildNatalQuestionPromptContext(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  permanentReport: NatalPermanentPremiumReport;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
}): { built: BuiltNatalModelContext; context: NatalQuestionPromptContext } {
  const built = buildNatalModelContext(input.profile, input.chartData);
  const promptChart = buildNatalPromptContext(built);
  const narrativeEvidenceIds = getNatalNarrativeEvidenceIds(built);
  const hasNarrativeEvidence = (value: Record<string, unknown>) => (
    narrativeEvidenceIds.has(text(value.evidenceId))
  );
  const { angles: allAngles, houses: allHouses, ...chartWithoutTimeDependentFacts } = promptChart.chart;
  const positions = Object.fromEntries(
    Object.entries(promptChart.chart.positions).filter(([, value]) => hasNarrativeEvidence(value)),
  );
  const aspects = promptChart.chart.aspects.filter(hasNarrativeEvidence);
  const angles = allAngles
    ? Object.fromEntries(Object.entries(allAngles).filter(([, value]) => hasNarrativeEvidence(value)))
    : {};
  const houses = allHouses?.filter(hasNarrativeEvidence) || [];
  const questionChart: ReturnType<typeof buildNatalPromptContext> = {
    ...promptChart,
    chart: {
      ...chartWithoutTimeDependentFacts,
      positions,
      aspects,
      ...(Object.keys(angles).length > 0 ? { angles } : {}),
      ...(houses.length > 0 ? { houses } : {}),
    },
    evidence: promptChart.evidence.filter((fact) => narrativeEvidenceIds.has(fact.id)),
  };
  const chartMessages = input.history.filter((message) => message.chartId === input.chartId);
  const answersByQuestionId = new Map<number, NatalQuestionStoredMessage>();
  for (const message of chartMessages) {
    if (message.role !== 'assistant') continue;
    const questionMessageId = Number(message.payload?.questionMessageId);
    if (!Number.isInteger(questionMessageId) || questionMessageId <= 0) continue;
    const current = answersByQuestionId.get(questionMessageId);
    if (!current || current.createdAt < message.createdAt) {
      answersByQuestionId.set(questionMessageId, message);
    }
  }
  const recentMessages = chartMessages
    .filter((message) => message.role === 'user' && answersByQuestionId.has(message.id))
    .map((question) => [question, answersByQuestionId.get(question.id)!] as const)
    .sort(([left], [right]) => (
      left.createdAt.localeCompare(right.createdAt) || left.id - right.id
    ))
    .slice(-8)
    .flatMap(([question, answer]) => [question, answer])
    .map((message) => ({
      role: message.role,
      text: message.text,
      evidenceIds: evidenceIdsFromPayload(message.payload),
    }));
  return {
    built,
    context: {
      chartId: input.chartId,
      chart: questionChart,
      permanentReport: input.permanentReport,
      recentMessages,
      question: normalizePersonalForecastQuestionInput(input.question),
    },
  };
}

export function buildNatalQuestionPrompt(
  language: NatalReadingLanguage,
  context: NatalQuestionPromptContext,
  repairErrors: readonly NatalQuestionValidationCode[] = [],
): string {
  const languageRule = language === 'ru'
    ? 'Answer in Russian and address the reader as «ты».'
    : 'Answer in English and address the reader as “you”.';
  return `${languageRule}

Answer the user's question from the permanent calculated birth chart and the permanent report below.

Rules:
- Return JSON only: {"answer":"3-5 complete sentences","evidence_ids":["existing evidence id"]}.
- Give a direct answer first, then connect it to concrete chart factors.
- Translate those factors into ordinary human language. Do not name planets, signs, houses, aspects, angles, retrograde motion, orbs, or degrees in the answer; keep technical facts only in evidence_ids for the closed “Why?” layer.
- Use previous messages only for conversational continuity. They are not calculation evidence.
- Every astrological claim must be supported by one or more evidence_ids that exist in chart.evidence.
- Never recalculate or invent placements, houses, aspects, biography, trauma, diagnoses, relationship history, guaranteed events, financial outcomes, karmic facts, or professional prescriptions.
- This context is a permanent birth-chart portrait. If the user asks when something will happen, whether today/tomorrow is favorable, or requests a dated forecast, say that the natal chart alone cannot supply a date. Do not fabricate or endorse a calendar answer.
- For a Russian timing question, a safe natural boundary is: «По натальной карте нельзя определить, лучший ли сегодня день, или назвать подходящую дату». For English: “The natal chart cannot determine whether today is the best day or name a suitable date.” Then answer only what the permanent chart supports about the reader's recurring way of making this kind of choice.
- Do not change or rewrite the permanent report.

QUESTION CONTEXT:
${JSON.stringify(context, null, 2)}${repairErrors.length ? `

REPAIR REQUIRED:
- The previous candidate was rejected by server validation: ${JSON.stringify(repairErrors)}.
- Write a completely new candidate. Correct every listed issue while keeping the same chart evidence and question.
- Return only the required JSON object.` : ''}`;
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

const DIAGNOSTIC_ANSWER_EN = /\b(?:diagnos(?:e|ed|es|ing|is|tic)|disorders?|diseases?|illness(?:es)?)\b/iu;
const DIAGNOSTIC_ANSWER_RU = /(?:диагноз\w*|диагностир\w*|расстройств\w*|болезн\w*)/iu;
const PROFESSIONAL_IMPERATIVE_EN = /(?:\b(?:stop|start|change|skip|increase|decrease)\s+(?:taking\s+)?(?:medication|medicine|pills?)\b|\b(?:invest|borrow)\b)/iu;
const PROFESSIONAL_IMPERATIVE_RU = /(?:(?:прекрати|начни|измени|отмени|увеличь|снизь)\w*[^.!?\n]{0,40}(?:лекарств\w*|препарат\w*|таблет\w*)|(?:инвестируй|вложи\s+деньги|возьми\s+кредит|одолжи\s+деньги))/iu;
const GUARANTEED_OUTCOME_EN = /(?:\b(?:guaranteed?|definitely|certainly)\s+(?:will\s+)?(?:happen|occur|return|profit|win|earn|get rich)\b|\b(?:risk[- ]free|guaranteed returns?)\b)/iu;
const GUARANTEED_OUTCOME_RU = /(?:(?:гарантирован\w*|обязательно)\s+(?:случ\w*|произойд\w*|доход\w*|прибыл\w*|выигра\w*|разбогате\w*)|точно\s+произойд[её]т|безрисков\w*)/iu;
const INVENTED_KARMIC_FACT = /(?:\b(?:in (?:a|your) past life|your karma proves|destined by karma)\b|(?:в прошлой жизни|твоя карма доказывает|кармой предопределено))/iu;
const FUTURE_TIMING_EN = /(?:\b(?:today|tomorrow|tonight|next (?:week|month|year)|this (?:week|month|year)|(?:on|by|before) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|\b(?:in|within)\s+\d+\s+(?:days?|weeks?|months?|years?)\b|\b20\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:will|shall)\s+(?:happen|occur|arrive|begin)\b)/iu;
const FUTURE_TIMING_RU = /(?:(?<!\p{L})(?:сегодня|завтра)(?!\p{L})|на\s+следующ(?:ей|ую)\s+(?:недел[\p{L}-]*|месяц[\p{L}-]*)|в\s+этом\s+(?:месяц[\p{L}-]*|году)|(?:в|до)\s+(?:понедельник[\p{L}-]*|вторник[\p{L}-]*|сред[\p{L}-]*|четверг[\p{L}-]*|пятниц[\p{L}-]*|суббот[\p{L}-]*|воскресень[\p{L}-]*)|через\s+\d+\s+(?:дн[\p{L}-]*|недел[\p{L}-]*|месяц[\p{L}-]*|лет|год[\p{L}-]*)|в\s+течение\s+\d+\s+(?:дн[\p{L}-]*|недел[\p{L}-]*|месяц[\p{L}-]*)|\b20\d{2}\b|(?<!\p{L})(?:январ[\p{L}-]*|феврал[\p{L}-]*|март[\p{L}-]*|апрел[\p{L}-]*|май|мая|мае|июн[\p{L}-]*|июл[\p{L}-]*|август[\p{L}-]*|сентябр[\p{L}-]*|октябр[\p{L}-]*|ноябр[\p{L}-]*|декабр[\p{L}-]*|случится|произойд[её]т|наступит)(?!\p{L}))/iu;
const TIMING_REFUSAL_EN = /(?:natal|birth) chart[^.!?\n]{0,140}(?:(?:cannot|can't|does not|doesn't|is unable to|is not able to)\s+(?:determine|tell|say|show|predict|provide|identify|confirm|choose)?|(?:is not|isn't)\s+(?:a\s+)?(?:calendar|forecast))[^.!?\n]{0,140}(?:today|tomorrow|date|when|timing|forecast|whether|best\s+(?:day|time)|right\s+(?:day|time))/iu;
const TIMING_REFUSAL_RU = /натальн[\p{L}-]*\s+карт[\p{L}-]*[^.!?\n]{0,140}(?:(?:не\s+(?:может|способна|позволяет)\s+(?:определить|подсказать|сказать|показать|предсказать|назвать|выбрать|подтвердить)?)|(?:не\s+(?:определяет|подсказывает|говорит|показывает|предсказывает|называет|выбирает|подтверждает|да[её]т))|(?:нельзя\s+(?:определить|подсказать|сказать|показать|предсказать|назвать|выбрать|подтвердить)))[^.!?\n]{0,140}(?:сегодня|завтра|дат[\p{L}-]*|когда|тайминг[\p{L}-]*|прогноз[\p{L}-]*|лучш[\p{L}-]*\s+(?:день|врем[\p{L}-]*)|подходящ[\p{L}-]*\s+(?:день|врем[\p{L}-]*)|стоит\s+ли|получится\s+ли|случится\s+ли|произойд[её]т\s+ли)/iu;
const STRONG_GUARANTEE_EN = /(?:\b(?:you\s+)?(?:will|are going to)\s+(?:definitely|certainly)\b|\bthe chart (?:proves|guarantees)\b)/iu;
const STRONG_GUARANTEE_RU = /(?:(?:ты\s+)?обязательно\s+(?:получишь|встретишь|станешь|сможешь|добь[её]шься|разбогатеешь|выйдешь|женишься)|карт\w*\s+(?:доказывает|гарантирует))/iu;
const SPECIFIC_FUTURE_EVENT_EN = /\b(?:will|shall)\s+(?:meet\s+(?:(?:a|an|the|your)\s+)?(?:new\s+)?(?:partner|spouse|husband|wife|lover|love|person)|receive\s+(?:money|payment|an?\s+(?:offer|promotion|award|inheritance|diagnosis)|the\s+(?:offer|promotion|award|inheritance|diagnosis)))\b/iu;
const SPECIFIC_FUTURE_EVENT_RU = /(?:(?<!\p{L})(?:ты\s+)?встретишь\s+(?:нов[\p{L}-]*\s+)?(?:партн[её]р[\p{L}-]*|любов[\p{L}-]*|мужчин[\p{L}-]*|женщин[\p{L}-]*|человек[\p{L}-]*)(?!\p{L})|(?<!\p{L})(?:ты\s+)?получишь\s+(?:деньг[\p{L}-]*|выплат[\p{L}-]*|предложен[\p{L}-]*|повышен[\p{L}-]*|наград[\p{L}-]*|наследств[\p{L}-]*|диагноз[\p{L}-]*)(?!\p{L}))/iu;
const PRESCRIPTIVE_HIGH_STAKES_EN = /\b(?:quit your job|file a lawsuit|ignore (?:a|your) doctor|avoid medical care)\b/iu;
const PRESCRIPTIVE_HIGH_STAKES_RU = /(?:увольняйся\s+с\s+работы|подавай\s+в\s+суд|не\s+слушай\s+врач\w*|откажись\s+от\s+лечен\w*)/iu;

function hasUnsupportedFutureTiming(value: string): boolean {
  return value
    .split(/(?:(?<=[.!?…])\s+|\n+)/u)
    .flatMap((sentence) => sentence.split(
      /(?:,\s*(?:but|however|yet|and|но|однако|зато|а|и)\s+|[;:—–]\s*|\s+-\s+)/iu,
    ))
    .map((part) => part.trim())
    .filter(Boolean)
    .some((sentence) => {
      const hasTiming = FUTURE_TIMING_EN.test(sentence) || FUTURE_TIMING_RU.test(sentence);
      if (!hasTiming) return false;
      return !TIMING_REFUSAL_EN.test(sentence) && !TIMING_REFUSAL_RU.test(sentence);
    });
}

export function validateNatalQuestionAnswer(
  raw: RawNatalQuestionAnswer,
  allowedEvidenceIds: Set<string>,
  reliability?: BuiltNatalModelContext,
): NatalQuestionAnswer | null {
  if (getNatalQuestionAnswerValidationErrors(raw, allowedEvidenceIds, reliability).length > 0) {
    return null;
  }
  const answer = text(raw?.answer);
  const ids = Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
  return { text: answer, evidenceIds: ids };
}

export function getNatalQuestionAnswerValidationErrors(
  raw: RawNatalQuestionAnswer,
  allowedEvidenceIds: Set<string>,
  reliability?: BuiltNatalModelContext,
): NatalQuestionValidationCode[] {
  const answer = text(raw?.answer);
  const narrativeEvidenceIds = reliability
    ? getNatalNarrativeEvidenceIds(reliability)
    : allowedEvidenceIds;
  const ids = Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
  const errors = new Set<NatalQuestionValidationCode>();
  const sentences = sentenceCount(answer);

  if (answer.length < 40) errors.add('ANSWER_TOO_SHORT');
  if (answer.length > 1600) errors.add('ANSWER_TOO_LONG');
  if (sentences < 3 || sentences > 5) errors.add('SENTENCE_COUNT_INVALID');
  if (ids.length === 0) errors.add('EVIDENCE_REQUIRED');
  if (ids.some((id) => !allowedEvidenceIds.has(id) || !narrativeEvidenceIds.has(id))) {
    errors.add('EVIDENCE_UNKNOWN');
  }
  if (hasNatalPersonalityCopyViolation(answer)) errors.add('COPY_VIOLATION');
  if (DIAGNOSTIC_ANSWER_EN.test(answer) || DIAGNOSTIC_ANSWER_RU.test(answer)) {
    errors.add('DIAGNOSTIC_CLAIM');
  }
  if (PROFESSIONAL_IMPERATIVE_EN.test(answer) || PROFESSIONAL_IMPERATIVE_RU.test(answer)) {
    errors.add('PROFESSIONAL_IMPERATIVE');
  }
  if (GUARANTEED_OUTCOME_EN.test(answer) || GUARANTEED_OUTCOME_RU.test(answer)) {
    errors.add('GUARANTEED_OUTCOME');
  }
  if (INVENTED_KARMIC_FACT.test(answer)) errors.add('KARMIC_CLAIM');
  if (STRONG_GUARANTEE_EN.test(answer) || STRONG_GUARANTEE_RU.test(answer)) {
    errors.add('STRONG_GUARANTEE');
  }
  if (PRESCRIPTIVE_HIGH_STAKES_EN.test(answer) || PRESCRIPTIVE_HIGH_STAKES_RU.test(answer)) {
    errors.add('HIGH_STAKES_PRESCRIPTION');
  }
  if (hasUnsupportedFutureTiming(answer)) errors.add('UNSUPPORTED_FUTURE_TIMING');
  if (SPECIFIC_FUTURE_EVENT_EN.test(answer) || SPECIFIC_FUTURE_EVENT_RU.test(answer)) {
    errors.add('UNSUPPORTED_FUTURE_EVENT');
  }
  if (reliability != null && !isNatalReliabilityTextAllowed(answer, reliability)) {
    errors.add('RELIABILITY_VIOLATION');
  }
  return [...errors];
}

async function requestStructuredNatalQuestionAnswer(input: {
  language: NatalReadingLanguage;
  prompt: string;
}): Promise<RawNatalQuestionAnswer> {
  const response = await createLunaStructuredResponse({
    instructions: getAppSystemVoice(input.language),
    input: input.prompt,
    maxOutputTokens: 900,
    schemaName: 'natal_question_answer',
    schema: NATAL_QUESTION_RESPONSE_SCHEMA,
  });
  try {
    return JSON.parse(response.content) as RawNatalQuestionAnswer;
  } catch {
    const error = new Error('NATAL_QUESTION_INVALID_JSON') as Error & { code?: string };
    error.code = 'NATAL_QUESTION_INVALID_JSON';
    throw error;
  }
}

export async function generateNatalQuestionAnswer(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  permanentReport: NatalPermanentPremiumReport;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
  requestAnswer?: NatalQuestionAnswerRequester;
}): Promise<NatalQuestionAnswer> {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const { built, context } = buildNatalQuestionPromptContext(input);
  const allowedEvidenceIds = getNatalNarrativeEvidenceIds(built);
  const requestAnswer = input.requestAnswer || requestStructuredNatalQuestionAnswer;
  let validationCodes: NatalQuestionValidationCode[] = [];

  for (let attempt = 1; attempt <= MAX_ANSWER_ATTEMPTS; attempt += 1) {
    const raw = await requestAnswer({
      language,
      prompt: buildNatalQuestionPrompt(language, context, validationCodes),
    });
    validationCodes = getNatalQuestionAnswerValidationErrors(
      raw,
      allowedEvidenceIds,
      built,
    );
    if (validationCodes.length === 0) {
      return {
        ...validateNatalQuestionAnswer(raw, allowedEvidenceIds, built)!,
        model: OPENAI_LUNA_MODEL,
        generationAttempts: attempt as 1 | 2,
      };
    }
  }
  throw new NatalQuestionValidationError(validationCodes, MAX_ANSWER_ATTEMPTS);
}

export const NATAL_QUESTION_IDENTITY = {
  contractVersion: NATAL_QUESTION_CONTRACT_VERSION,
  permanentReportContractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  promptVersion: NATAL_QUESTION_PROMPT_VERSION,
  voiceVersion: APP_VOICE_VERSION,
} as const;
