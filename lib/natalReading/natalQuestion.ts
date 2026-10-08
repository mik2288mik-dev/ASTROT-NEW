import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { APP_VOICE_VERSION, withAppVoiceVersion } from '../appVoice';
import {
  buildNatalInterpretation,
  NATAL_INTERPRETATION_VERSION,
  type NatalInterpretation,
  type NatalMeaning,
} from '../natalInterpretation';
import { getNeboCoreVoice } from '../voice/core';
import {
  CORE_VOICE_CLICHE_PATTERNS,
  CORE_VOICE_MYSTICISM_PATTERNS,
  hasCoreVoiceViolation,
} from '../voice/validators';
import { natalPlainLanguageError } from '../natalInterpretation/plainLanguage';
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
import type {
  NatalQuestionStoredMessage,
  NatalQuestionUsage,
} from './natalQuestionStore';

const MAX_ANSWER_ATTEMPTS = 2;

export const NATAL_QUESTION_PROMPT_VERSION = withAppVoiceVersion('natal-question-v7');
export const NATAL_QUESTION_CONTRACT_VERSION = 'natal-question-v9';

const NATAL_QUESTION_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    meaning_ids: { type: 'array', items: { type: 'string' } },
    evidence_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'meaning_ids', 'evidence_ids'],
  additionalProperties: false,
};

const NATAL_QUESTION_SEMANTIC_REVIEW_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    meaning_ids: { type: 'array', items: { type: 'string' } },
    evidence_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'issues', 'meaning_ids', 'evidence_ids'],
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
    | 'third_party_inference'
    | 'compatibility_requires_two_charts';
  normalizedQuestion: string;
};

export type NatalQuestionAnswer = {
  text: string;
  meaningIds: string[];
  evidenceIds: string[];
  model?: string;
  generationAttempts?: 1 | 2;
};

export type NatalQuestionValidationCode =
  | 'ANSWER_TOO_SHORT'
  | 'ANSWER_TOO_LONG'
  | 'SENTENCE_COUNT_INVALID'
  | 'MEANING_REQUIRED'
  | 'MEANING_UNKNOWN'
  | 'MEANING_SELECTION_TOO_BROAD'
  | 'EVIDENCE_UNKNOWN'
  | 'EVIDENCE_SELECTION_TOO_BROAD'
  | 'COPY_VIOLATION'
  | 'DIAGNOSTIC_CLAIM'
  | 'PROFESSIONAL_IMPERATIVE'
  | 'GUARANTEED_OUTCOME'
  | 'KARMIC_CLAIM'
  | 'STRONG_GUARANTEE'
  | 'HIGH_STAKES_PRESCRIPTION'
  | 'UNSUPPORTED_FUTURE_TIMING'
  | 'UNSUPPORTED_FUTURE_EVENT'
  | 'SEMANTIC_MISMATCH';

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
  promptVersion: string;
  voiceVersion: string;
};

export type NatalQuestionPromptContext = {
  chartId: number;
  interpretationVersion: string;
  gender?: UserProfile['gender'];
  birthTimeQuality?: NatalInterpretation['birthTimeQuality'];
  savedChartEvidence?: NatalInterpretation['evidence'];
  approvedMeanings: Array<{
    id: string;
    scope: NatalMeaning['scope'];
    topics: NatalMeaning['topics'];
    meaning: string;
    topicMeanings?: NatalMeaning['topicText'];
    area?: string;
  }>;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    text: string;
  }>;
  question: string;
};

type RawNatalQuestionAnswer = {
  answer?: unknown;
  meaning_ids?: unknown;
  evidence_ids?: unknown;
};

type RawNatalQuestionSemanticReview = {
  ok?: unknown;
  issues?: unknown;
  meaning_ids?: unknown;
  evidence_ids?: unknown;
};

type NatalQuestionSemanticReview = {
  issues: string[];
  meaningIds: string[];
  evidenceIds: string[];
};

type NatalReadingLanguage = 'ru' | 'en';

type NatalQuestionAnswerRequester = (input: {
  language: NatalReadingLanguage;
  prompt: string;
}) => Promise<RawNatalQuestionAnswer>;

type NatalQuestionSemanticReviewer = (input: {
  language: NatalReadingLanguage;
  question: string;
  answer: string;
  meanings: Array<Pick<NatalMeaning, 'id' | 'scope' | 'text' | 'topics' | 'topicText' | 'area'>>;
  availableMeanings: NatalQuestionPromptContext['approvedMeanings'];
  savedChartEvidence: NatalInterpretation['evidence'];
  gender: UserProfile['gender'];
  recentMessages: NatalQuestionPromptContext['recentMessages'];
}) => Promise<NatalQuestionSemanticReview | string[]>;

function text(value: unknown): string {
  return String(value ?? '').trim();
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
  /(?:богат|бога[тс]ств|финанс|заработ|успех|предприним|бизнес|призвани|предназначен|счаст|одиноч|ревност|брак|женить|замуж|самореализац|жизн|переезд|интим|сексуальн)/iu,
  /(?:wealth|rich|financ|earn|success|business|entrepreneur|calling|purpose|happiness|loneliness|jealous|marriage|marry|life|relocation|intimacy|sexual)/iu,
  /(?:характер|черт[\p{L}-]*|сильн[\p{L}-]*\s+сторон|слаб[\p{L}-]*\s+сторон|талант|способност|реакц|реагир|эмоц|чувств|привыч|поведен|решен|выбор|сомнен|риск|общен|разговор|говор|конфликт|спор|границ|довер|помощ|отношен|любов|близост|симпати|семь|родител|друз|муж|жен|супруг|работ|карьер|профес|коллег|руковод|деньг|доход|трат|накоп|самооцен|уверен|страх|контрол|ответствен|мотивац|цел[ьи]|темп|ритм|инициатив|лидер|партн[её]р|прокраст|откладыв|дисциплин|организ|довож|начина|заметн|веду\s+себя|настаив|насто|мысл|разноглас|прийти\s+в\s+себя|комфорт|пространств|домашн|уклад|восстанав|восстанов|уч[её]б|учусь|учиться|обучен|разбира|понять|теори|отдых|нагруз|рутин|пауз|переключ)/iu,
  /(?:character|trait|strength|weakness|talent|abilit|reaction|react|emotion|feeling|habit|behavio|decision|choice|doubt|risk|communicat|conversation|speak|conflict|argument|boundar|trust|help|relationship|love|intimacy|attraction|interest|family|parent|friend|husband|wife|spouse|work|career|profession|colleague|manager|money|income|spend|saving|confidence|fear|control|responsibilit|motivation|goal|pace|rhythm|initiative|leader|partner|procrastinat|put\w*\s+off|disciplin|organi[sz]|follow\w*\s+through|start\w*|notice|stand\s+my\s+ground|explain|thought|what\s+i\s+mean|disagreement|comfort|personal\s+space|home|recover|routine|learn|understand|theory|rest|workload|break|switch\w*\s+off)/iu,
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
  /(?:приготов|свари|испек|пожарь|рецепт|составь\s+меню|посчитай\s+калори|борщ|суп(?!\p{L}))/iu,
  /(?:(?:купи|закажи|подбери|посоветуй|выбери)(?!\p{L})[^.!?]{0,100}(?:телефон|ноутбук|товар|одежд|подарок|отел|ресторан|курс)|какой\s+(?:телефон|ноутбук|товар)\s+(?:купить|выбрать))/iu,
  /(?:напиши|сочини|расскажи|придумай|переведи|перевод|исправь|отладь|запрограммируй|реши|сделай)(?!\p{L})[^.!?]{0,100}(?:анекдот|шутк|истори|стих|песн|письм|пост|резюме|код|программ|скрипт|домашн|задач|контрольн|экзамен|презентац)/iu,
  /(?:прогноз\s+погоды|температура\s+на\s+улице|сч[её]т\s+(?:матча|игры)|новост|курс\s+валют|столица\s+какой|кто\s+(?:президент|выиграл))/iu,
  /(?:нарисуй|создай\s+(?:картин|изображен|видео)|поставь\s+напоминан|отправь\s+(?:письм|сообщен)|забронируй)/iu,
  /(?:составь|построй|проложи|спланируй)(?!\p{L})[^.!?]{0,100}(?:маршрут|поездк|путешеств|расписан|трениров|диет|бюджет)/iu,
  /(?:cook|recipe|boil|bake|fry|make\s+(?:me\s+)?(?:dinner|lunch|breakfast)|calories)/iu,
  /(?:(?:buy|order|pick|recommend|choose)\b[^.!?]{0,100}(?:phone|laptop|product|clothes|gift|hotel|restaurant|course)|which\s+(?:phone|laptop|product)\s+should\s+i\s+buy)/iu,
  /(?:write|compose|tell|make|translate|fix|debug|program|solve|do)\b[^.!?]{0,100}(?:joke|story|poem|song|email|post|resume|code|program|script|homework|exam|presentation)/iu,
  /(?:weather\s+forecast|temperature\s+outside|match\s+score|game\s+score|news|exchange\s+rate|who\s+(?:is\s+the\s+president|won))/iu,
  /(?:draw|create\s+(?:an?\s+)?(?:image|picture|video)|set\s+(?:a\s+)?reminder|send\s+(?:an?\s+)?(?:email|message)|book\s+(?:a\s+)?(?:hotel|table|flight))/iu,
  /(?:build|make|plan)\b[^.!?]{0,100}(?:route|trip|travel|schedule|workout|diet|budget)/iu,
] as const;

const FACTUAL_LOOKUP_PATTERNS = [
  /(?:столиц\p{L}*|в\s+какой\s+стране\s+париж)/iu,
  /(?:capital\s+of|which\s+country\s+is\s+paris\s+in)/iu,
] as const;

const GENERIC_FACT_LOOKUP_PATTERNS = [
  /(?:когда\s+родил\p{L}*\s+(?!я\b))/iu,
  /(?:when\s+was\s+(?!i\b)[^?!.]{1,80}\s+born)/iu,
] as const;

const CONTENT_RECOMMENDATION_PATTERNS = [
  /(?:како(?:й|ю|е|ие)\s+(?:фильм|сериал|книг\p{L}*|музык\p{L}*|игр\p{L}*)[^.!?]{0,80}(?:посмотреть|почитать|послушать|выбрать|скачать|купить)|что\s+мне\s+(?:посмотреть|почитать|послушать|поиграть))/iu,
  /(?:what|which)\s+(?:movie|film|series|show|book|music|game)[^.!?]{0,80}(?:should\s+i|to)\s+(?:watch|read|listen|play|choose|buy)|what\s+should\s+i\s+(?:watch|read|listen\s+to|play)/iu,
] as const;

const PROFESSIONAL_PRESCRIPTION_PATTERNS = [
  /(?:диагноз|диагност|болезн|заболеван|лечен|лекарств|препарат|таблет|дозировк)/iu,
  /(?:как\s+выиграть\s+суд|подавать\s+ли\s+в\s+суд|юридическ\w*\s+(?:совет|стратег)|как\s+уйти\s+от\s+налог)/iu,
  /(?:куда\s+вложить\s+деньги|какие\s+акци\w*\s+купить|инвестировать\s+ли|брать\s+ли\s+кредит|оформлять\s+ли\s+ипотек)/iu,
  /(?:diagnos|disease|illness|treat(?:ment)?|medicine|medication|pills?|dosage)/iu,
  /(?:how\s+to\s+win\s+(?:a\s+)?lawsuit|should\s+i\s+sue|legal\s+(?:advice|strategy)|evade\s+tax)/iu,
  /(?:where\s+should\s+i\s+invest|which\s+stocks?\s+should\s+i\s+buy|should\s+i\s+invest|should\s+i\s+take\s+(?:a\s+)?loan|should\s+i\s+get\s+(?:a\s+)?mortgage)/iu,
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
  /^(?:что\s+делать|как\s+быть|что\s+дальше|что\s+скажешь|расскажи(?:\s+мне)?|помоги|что[-\s]?нибудь)[?!.]*$/iu,
  /^(?:what\s+should\s+i\s+do|what\s+now|what\s+do\s+you\s+think|tell\s+me|help\s+me|anything)[?!.]*$/iu,
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
  /^(?:а\s+|и\s+)?(?:почему(?:\s+так)?|как\s+так|объясни(?:\s+подробнее)?|расскажи(?:\s+подробнее)?|подробнее|что\s+это\s+значит|что\s+с\s+этим\s+делать|а\s+дальше)[?!.]*$/iu,
  /^(?:and\s+|but\s+)?(?:why(?:\s+is\s+that)?|how\s+so|explain(?:\s+more)?|tell\s+me\s+more|more\s+details|what\s+does\s+that\s+mean|what\s+can\s+i\s+do\s+about\s+that)[?!.]*$/iu,
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
  return matchesQuestionPolicy(value, NATAL_SCOPE_PATTERNS)
    || matchesQuestionPolicy(value, PERSONAL_SUBJECT_PATTERNS);
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
  const isFollowUp = Boolean(input.existingQuestions?.length)
    && matchesQuestionPolicy(question, CONTEXTUAL_INTERPRETATION_PATTERNS);
  const shared = moderatePersonalForecastCustomQuestion({
    question,
    language: input.language,
    period: 'month',
    // Conversation follow-ups may revisit the same topic. The store still
    // enforces the daily allowance and reuses unanswered requests on retry.
  });
  if (shared.status === 'rejected' && shared.reason !== 'duplicate_catalog'
    && !(shared.reason === 'too_short' && isFollowUp)) {
    return {
      status: 'rejected',
      reason: shared.reason,
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
  if (matchesQuestionPolicy(question, FACTUAL_LOOKUP_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'not_natal_question',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, GENERIC_FACT_LOOKUP_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'needs_specificity',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  if (matchesQuestionPolicy(question, CONTENT_RECOMMENDATION_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'needs_specificity',
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
  if (!isFollowUp && matchesQuestionPolicy(question, VAGUE_QUESTION_PATTERNS)) {
    return {
      status: 'rejected',
      reason: 'needs_specificity',
      normalizedQuestion: shared.normalizedQuestion,
    };
  }

  const hasPersonalSubject = matchesQuestionPolicy(question, PERSONAL_SUBJECT_PATTERNS);
  const hasNatalScope = matchesQuestionPolicy(question, NATAL_SCOPE_PATTERNS);
  const hasExplicitChartScope = matchesQuestionPolicy(question, EXPLICIT_CHART_SCOPE_PATTERNS);
  const hasInterpretiveIntent = matchesQuestionPolicy(question, INTERPRETIVE_INTENT_PATTERNS);
  const hasPersonalPatternDomain = matchesQuestionPolicy(
    question,
    PERSONAL_PATTERN_DOMAIN_PATTERNS,
  );
  const isTimingQuestion = matchesQuestionPolicy(question, TIMING_QUESTION_PATTERNS)
    && matchesQuestionPolicy(question, TIMING_DECISION_PATTERNS)
    && (hasPersonalSubject || hasNatalScope);
  const isImplicitSelfChartQuestion = hasExplicitChartScope
    && hasInterpretiveIntent
    && hasPersonalPatternDomain;

  // This field already supplies the self-chart context: a life-area question
  // such as "Какая профессия подходит?" does not need another "я" or "мне".
  if (!hasPersonalSubject && !hasPersonalPatternDomain && !hasNatalScope
    && !isImplicitSelfChartQuestion && !isTimingQuestion && !isFollowUp) {
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

function canonicalNatalQuestionChart(
  chartData: NatalChartData | NatalChartDataV2,
): NatalChartDataV2 {
  const chart = chartData as unknown as NatalChartDataV2;
  if (chart?.schemaVersion !== 'natal-chart-data-v2') {
    const error = new Error('NATAL_QUESTION_CANONICAL_CHART_REQUIRED') as Error & { code?: string };
    error.code = 'NATAL_QUESTION_CANONICAL_CHART_REQUIRED';
    throw error;
  }
  return chart;
}

function pairedRecentMessages(
  chartId: number,
  history: readonly NatalQuestionStoredMessage[],
): NatalQuestionPromptContext['recentMessages'] {
  const chartMessages = history.filter((message) => message.chartId === chartId);
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
  return chartMessages
    .filter((message) => message.role === 'user' && answersByQuestionId.has(message.id))
    .map((question) => [question, answersByQuestionId.get(question.id)!] as const)
    .sort(([left], [right]) => (
      left.createdAt.localeCompare(right.createdAt) || left.id - right.id
    ))
    .slice(-8)
    .flatMap(([question, answer]) => [question, answer])
    .map((message) => ({ role: message.role, text: message.text }));
}

export function buildNatalQuestionPromptContext(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
}): { interpretation: NatalInterpretation; context: NatalQuestionPromptContext } {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const chart = canonicalNatalQuestionChart(input.chartData);
  const interpretation = buildNatalInterpretation(chart, language);
  return {
    interpretation,
    context: {
      chartId: input.chartId,
      interpretationVersion: interpretation.schemaVersion,
      gender: input.profile.gender || 'unspecified',
      birthTimeQuality: interpretation.birthTimeQuality,
      savedChartEvidence: interpretation.evidence,
      approvedMeanings: interpretation.meanings.map((meaning) => ({
        id: meaning.id,
        scope: meaning.scope,
        topics: meaning.topics,
        meaning: meaning.text,
        ...(meaning.topicText ? { topicMeanings: meaning.topicText } : {}),
        ...(meaning.area ? { area: meaning.area } : {}),
      })),
      recentMessages: pairedRecentMessages(input.chartId, input.history),
      question: normalizePersonalForecastQuestionInput(input.question),
    },
  };
}

export function buildNatalQuestionPrompt(
  language: NatalReadingLanguage,
  context: NatalQuestionPromptContext,
  repairErrors: readonly NatalQuestionValidationCode[] = [],
  repairDetails: readonly string[] = [],
  previousOutput?: RawNatalQuestionAnswer,
): string {
  const rules = language === 'ru'
    ? `## КОНТРАКТ ФУНКЦИИ: ВОПРОС ПО НАТАЛЬНОЙ КАРТЕ

Отвечай по-русски и обращайся к человеку на «ты».

Это ответ на конкретный вопрос человека, а не новый общий рассказ о всей его карте. Пойми смысл вопроса целиком, даже если он написан коротко, разговорно или с опечатками. Для продолжения разговора восстанови тему из recentMessages.

Основа ответа: достоверные положения и связи из сохранённой карты именно этого человека, savedChartEvidence. approvedMeanings дают уже проверенные наблюдения, но не ограничивают ответ набором коротких готовых фраз. Разбирай по карте именно заданный вопрос.

ЖЁСТКИЕ ПРАВИЛА:
- savedChartEvidence содержит только достоверные основания. Используй положения, жизненные области и связи между ними в совокупности. Не вычисляй новую карту, не меняй знак, дом, тип связи или положение объекта и не дополняй отсутствующие основания. Если время рождения неточное, не восстанавливай исключённые из входа дома и углы.
- Верни только JSON: {"answer":"цельный подробный ответ с абзацами","meaning_ids":["использованный approved meaning id"],"evidence_ids":["основание из savedChartEvidence"]}. meaning_ids может быть пустым, если готовые фразы не использованы; evidence_ids должны точно объяснять основания ответа.
- Сначала прямо ответь на то, что человек спросил. Затем раскрой относящиеся к вопросу подробности: что именно подтверждено, как связаны наблюдения, в каких обстоятельствах каждое из них имеет значение. Если вопрос состоит из нескольких частей, ответь на каждую.
- Обычно это 4–7 связанных абзацев, примерно 200–400 слов. Это ориентир для полноценного объяснения, а не обязательная квота. Не растягивай скудный материал повторениями и не обрезай богатый материал до пары фраз. Каждый абзац добавляет отдельную существенную мысль и продолжает предыдущий.
- До написания ответа выбери существенные основания по вопросу из всей карты: относящиеся к нему жизненные области, положения объектов и их связи. Объясни, что они дают вместе, где поддерживают друг друга и где расходятся. Используй topics, area и topicMeanings как помощь, а не как запрет раскрыть вопрос подробнее. Не подменяй вопрос случайной чертой из другой области.
- Все личные выводы должны опираться на конкретные savedChartEvidence или approvedMeanings. После написания проверь основания для каждого вывода. Укажи максимум 24 meaning_ids и 40 evidence_ids, только реально использованные существующие ID.
- Разрешены подробное объяснение и связная интерпретация подтверждённых положений по вопросу. Пиши о склонностях и возможных условиях, не объявляй интерпретацию доказанным фактом биографии. Не придумывай жизненные события, причины из прошлого, мотивы или психологические ярлыки.
- Смыслы scope=background описывают общий фон и не могут быть единственным основанием для личного вывода. Не превращай общий фон в индивидуальный факт.
- Пиши как один связный ответ человеку, который впервые читает о своей карте. Не выдавай перечень характеристик, отдельные обрывки, таблицу, подзаголовки или универсальный шаблон. Меняй начала и длину предложений, не повторяй одну мысль другими словами.
- Если человек спрашивает иначе о прежней теме, раскрой именно новую сторону вопроса. Не копируй предыдущий ответ. На «почему?» объясни уже названное, на «подробнее» добавь подтверждённые подробности, а не повтори вводные.
- Если карта не подтверждает предпосылку вопроса, так и скажи простыми словами. Не подгоняй карту под вопрос.
- Не называй в answer планеты, знаки, дома, аспекты, углы, ретроградность, орбы или градусы. Технические основания приложение покажет отдельно.
- Не превращай ответ в коучинг: не давай человеку советы, инструкции, задания или «правильный путь».
- Не пиши служебным языком вроде «в этой теме», «динамика», «сфера», «функция», «карта показывает», «астрологическая трактовка».
- Не обсуждай «готовые смыслы», «выбранные наблюдения», «разрешённые данные» и сам процесс генерации. Человек читает ответ о себе, а не описание входных данных. Учитывай gender; при unspecified используй нейтральные по роду формулировки: «ты выбираешь», «тебе легче», «тебе важно». Не угадывай пол человека.
- Не придумывай прошлое, травмы, страхи, диагнозы, отношения, профессию, доход, мысли других людей или гарантированные события.
- previous messages нужны только для связности разговора. Они не являются доказательством и не расширяют savedChartEvidence.
- Натальная карта не даёт календарных прогнозов. Если вопрос про сегодня/завтра/дату/когда случится, коротко обозначь эту границу и подробно раскрой доступные наблюдения по теме самого вопроса. Не заканчивай ответ одним отказом и не придумывай дату.
- Для timing-вопроса допустимая граница: «По натальной карте нельзя определить, лучший ли сегодня день, или назвать подходящую дату».
- Не приветствуй, не благодари за вопрос и не рассказывай, что сейчас будешь делать.`
    : `## CONTENT CONTRACT: NATAL QUESTION

Answer in English and address the reader as “you”.

This is an answer to the person's specific question, not a new general portrait of their entire chart. Understand the whole question, including informal wording or typos. Resolve follow-ups from recentMessages.

Use the reliable placements and connections from this person's saved chart in savedChartEvidence. approvedMeanings supply previously checked observations, but do not limit the answer to a few short prepared phrases. Interpret the chart specifically for the question.

STRICT RULES:
- savedChartEvidence contains reliable evidence only. Consider placements, life areas and connections together. Do not recalculate the chart, change signs, houses, connection types or object placements, or invent missing evidence. Do not reconstruct excluded houses or angles for uncertain birth times.
- Return JSON only: {"answer":"a full connected answer with paragraphs","meaning_ids":["used approved meaning id"],"evidence_ids":["existing savedChartEvidence id"]}. meaning_ids may be empty when prepared observations are not used; evidence_ids must accurately support the answer.
- Answer the actual question directly, then explain the relevant details, connections between supported observations and the circumstances each observation concerns. Address every part of a multi-part question.
- Normally use 4–7 connected paragraphs, roughly 200–400 words. This is guidance for a complete explanation, not a mandatory quota. Do not pad sparse material or reduce rich material to two generic sentences. Each paragraph adds a distinct relevant point and continues the previous one.
- Before writing, select substantial evidence relevant to the question from the full chart: life areas, object placements and their connections. Explain how these work together, support each other or differ. Use topics, area and topicMeanings as assistance, not a restriction on depth. Do not substitute an unrelated general trait for the requested subject.
- Every personal conclusion must be grounded in specific savedChartEvidence or approvedMeanings. Check support for every conclusion after writing. Return up to 24 meaning_ids and 40 evidence_ids, using only actually relevant existing IDs.
- Detailed explanation and connected interpretation of reliable placements are allowed. Describe tendencies and possible conditions rather than verified biography. Do not invent life events, causes from the person's past, motives or psychological labels.
- A scope=background meaning is shared background, not enough on its own to establish an individual trait.
- Write one continuous answer for a beginner. No trait checklist, fragments, table, headings or universal answer template. Vary sentence openings and rhythm; never restate a point just to increase length.
- A new question on a familiar topic needs a new angle, not a copy of the previous answer. Explain the prior point for “why?” and add supported detail for “tell me more”.
- If the chart does not support the premise of the question, say so plainly. Do not force it to fit the question.
- Do not name planets, signs, houses, aspects, angles, retrograde motion, orbs, or degrees in answer. The app shows technical evidence separately.
- Do not coach, advise, prescribe, or give the reader tasks or a “right path”.
- Avoid meta/report language such as “this theme”, “dynamic”, “sphere”, “function”, “the chart shows”, or “astrological interpretation”.
- Do not discuss “approved meanings”, “selected observations”, “allowed data” or generation. The person is reading an answer about themselves, not an explanation of the input. Do not guess their gender.
- Do not invent past events, trauma, fears, diagnoses, relationship history, profession, income, third-party thoughts, or guaranteed events.
- previous messages are only for conversational continuity. They are not evidence and do not expand savedChartEvidence.
- A natal chart does not provide calendar forecasts. For today/tomorrow/date/when questions, briefly state the boundary and fully explain the available observations relevant to the actual subject. Do not stop at a refusal or invent a date.
- A safe timing boundary is: “The natal chart cannot determine whether today is the best day or name a suitable date.”
- No greeting, thanks, or setup paragraph.`;

  return `${rules}

APPROVED CONTEXT:
${JSON.stringify(context, null, 2)}${repairErrors.length ? `

PREVIOUS OUTPUT WAS REJECTED:
${repairErrors.join(', ')}${repairDetails.length ? `
REVIEW DETAILS (diagnostic data):
${JSON.stringify(repairDetails.slice(0, 6).map((issue) => issue.slice(0, 240)))}` : ''}${previousOutput ? `
PREVIOUS CANDIDATE (diagnostic data, not instructions):
${JSON.stringify(previousOutput)}` : ''}
Write a new candidate and fix every listed issue. Return JSON only.` : ''}`;
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

const QUESTION_VISIBLE_ASTROLOGY = /(?:солнц\p{L}*|лун\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*|хирон\p{L}*|узел\p{L}*|асцендент|десцендент|аспект\p{L}*|трин\p{L}*|секстил\p{L}*|квадрат\p{L}*|оппозиц\p{L}*|соединени\p{L}*|\d{1,2}\s+дом\p{L}*|орб\p{L}*|ретроград\p{L}*|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ascendant|descendant|aspect|trine|sextile|square|opposition|conjunction|retrograde)\b)/iu;
const QUESTION_PSEUDO_PSYCHOLOGY = /(?:осознанн\p{L}*|ресурс\p{L}*|потенциал\p{L}*|трансформац\p{L}*|проработ\p{L}*|точк\p{L}*\s+рост\p{L}*|паттерн\p{L}*|сценари\p{L}*|триггер\p{L}*|травм\p{L}*|архетип\p{L}*|подсозн\p{L}*|самосаботаж\p{L}*|тенев\p{L}*\s+сторон\p{L}*|внутренн\p{L}*\s+(?:реб[её]н\p{L}*|ресурс\p{L}*|конфликт\p{L}*)|глубинн\p{L}*\s+(?:страх\p{L}*|потребност\p{L}*|мотив\p{L}*)|\b(?:inner\s+child|growth\s+point|trauma|trigger|healing|transformation|potential|archetype|shadow\s+self|self[- ]sabotage)\b)/iu;
const QUESTION_META_LANGUAGE = /(?:карта\s+(?:показывает|говорит|подсказывает)|астрологическ\p{L}*\s+трактовк\p{L}*|в\s+этой\s+тем\p{L}*|эта\s+тем\p{L}*|может\s+проявляться|проявля\p{L}*\s+как|внутренн\p{L}*\s+динамик\p{L}*|\b(?:the\s+chart\s+shows|this\s+theme|may\s+manifest|inner\s+dynamic|astrological\s+interpretation)\b)/iu;
const QUESTION_ADVICE_LANGUAGE = /(?:тебе\s+(?:нужно|стоит|следует)(?!\p{L})|(?:попробуй|старайся|помни|сохраняй|проверь|сверь|выбирай|держи|не\s+бойся|позволь\s+себе)(?!\p{L})|\b(?:you\s+should|you\s+need\s+to|try\s+to|remember\s+to|make\s+sure\s+to|check\s+that|choose\s+based)\b)/iu;

function natalQuestionCopyRepairDetails(answer: string): string[] {
  const phrases = [
    ...CORE_VOICE_CLICHE_PATTERNS,
    ...CORE_VOICE_MYSTICISM_PATTERNS,
    QUESTION_VISIBLE_ASTROLOGY,
    QUESTION_PSEUDO_PSYCHOLOGY,
    QUESTION_META_LANGUAGE,
    QUESTION_ADVICE_LANGUAGE,
  ].flatMap((pattern) => {
    const match = answer.match(pattern)?.[0];
    return match ? [match] : [];
  });
  const plainLanguageError = natalPlainLanguageError(answer);
  return [
    ...new Set(phrases.map((phrase) => `Переформулируй обычными словами без этой запрещённой формулировки: ${JSON.stringify(phrase)}. Сохрани смысл и полноту.`)),
    ...(plainLanguageError ? [`Исправь построение текста: ${plainLanguageError}.`] : []),
  ];
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

function answerMeaningIds(raw: RawNatalQuestionAnswer): string[] {
  return Array.isArray(raw?.meaning_ids)
    ? [...new Set(raw.meaning_ids.map(text).filter(Boolean))]
    : [];
}

function answerEvidenceIds(raw: RawNatalQuestionAnswer): string[] {
  return Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
}

function evidenceIdsForMeanings(
  interpretation: NatalInterpretation,
  meaningIds: readonly string[],
): string[] {
  const byId = new Map(interpretation.meanings.map((meaning) => [meaning.id, meaning]));
  return [...new Set(meaningIds.flatMap((id) => byId.get(id)?.evidenceIds || []))];
}

export function validateNatalQuestionAnswer(
  raw: RawNatalQuestionAnswer,
  allowedMeaningIds: Set<string>,
  interpretation?: NatalInterpretation,
): NatalQuestionAnswer | null {
  const allowedEvidenceIds = interpretation
    ? new Set(interpretation.evidence.map((evidence) => evidence.id))
    : undefined;
  if (getNatalQuestionAnswerValidationErrors(raw, allowedMeaningIds, allowedEvidenceIds).length > 0) return null;
  const meaningIds = answerMeaningIds(raw);
  return {
    text: text(raw?.answer),
    meaningIds,
    evidenceIds: [...new Set([
      ...(interpretation ? evidenceIdsForMeanings(interpretation, meaningIds) : []),
      ...answerEvidenceIds(raw),
    ])],
  };
}

export function getNatalQuestionAnswerValidationErrors(
  raw: RawNatalQuestionAnswer,
  allowedMeaningIds: Set<string>,
  allowedEvidenceIds?: Set<string>,
): NatalQuestionValidationCode[] {
  const answer = text(raw?.answer);
  const ids = answerMeaningIds(raw);
  const evidenceIds = answerEvidenceIds(raw);
  const errors = new Set<NatalQuestionValidationCode>();
  const sentences = sentenceCount(answer);

  if (answer.length < 240) errors.add('ANSWER_TOO_SHORT');
  if (answer.length > 9000) errors.add('ANSWER_TOO_LONG');
  if (sentences < 1 || sentences > 50) errors.add('SENTENCE_COUNT_INVALID');
  if (ids.length === 0 && (evidenceIds.length === 0 || !allowedEvidenceIds)) errors.add('MEANING_REQUIRED');
  if (ids.some((id) => !allowedMeaningIds.has(id))) errors.add('MEANING_UNKNOWN');
  if (ids.length > 24) errors.add('MEANING_SELECTION_TOO_BROAD');
  if (evidenceIds.some((id) => !allowedEvidenceIds?.has(id))) errors.add('EVIDENCE_UNKNOWN');
  if (evidenceIds.length > 40) errors.add('EVIDENCE_SELECTION_TOO_BROAD');
  if (
    hasCoreVoiceViolation(answer)
    || QUESTION_VISIBLE_ASTROLOGY.test(answer)
    || QUESTION_PSEUDO_PSYCHOLOGY.test(answer)
    || QUESTION_META_LANGUAGE.test(answer)
    || QUESTION_ADVICE_LANGUAGE.test(answer)
    || natalPlainLanguageError(answer)
  ) errors.add('COPY_VIOLATION');
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
  return [...errors];
}

async function reviewNatalQuestionSemanticFidelity(input: {
  language: NatalReadingLanguage;
  question: string;
  answer: string;
  meanings: Array<Pick<NatalMeaning, 'id' | 'scope' | 'text' | 'topics' | 'topicText' | 'area'>>;
  availableMeanings: NatalQuestionPromptContext['approvedMeanings'];
  savedChartEvidence: NatalInterpretation['evidence'];
  gender: UserProfile['gender'];
  recentMessages: NatalQuestionPromptContext['recentMessages'];
}): Promise<NatalQuestionSemanticReview> {
  const instructions = input.language === 'ru'
    ? `Проверь ответ на конкретный вопрос по достоверным основаниям сохранённой карты.
ok=true только если candidate полно и связно отвечает на question и его выводы обоснованно следуют из saved_chart_evidence или available_meanings. Подробная интерпретация положений и их сочетаний по вопросу допустима, но не изменение фактов карты или выдумывание биографии.
Верни evidence_ids из saved_chart_evidence для всех реально использованных оснований, максимум 40, и meaning_ids для использованных готовых наблюдений, максимум 24. meaning_ids может быть пустым, если ответ основан на самостоятельной интерпретации достоверных положений. Исправь неточный или неполный выбор автора: подтверждённая фраза не становится выдумкой из-за пропущенного ID. Если вывод не поддерживается ни картой, ни готовыми наблюдениями, отклони его.
Проверь знаки, дома, объекты и типы связей: они должны точно соответствовать переданным данным. Отсутствующие или исключённые недостоверные основания использовать нельзя. Положение одной медленной планеты само по себе не доказывает индивидуальную особенность.
Связное объяснение и осторожный синтез подтверждённых наблюдений допустимы. Используй topics, area и topicMeanings для проверки контекста. Общий фон scope=background не доказывает индивидуальную черту сам по себе.
Проверь полноту по available_meanings: раскрыты части вопроса, объяснены важные связи, абзацы добавляют разные подробности. Если ответ игнорирует существенную сторону вопроса и ограничивается двумя общими чертами, это ошибка. Не требуй отдельного пересказа каждого похожего смысла: несколько оснований могут быть раскрыты одной связной мыслью. Две общие фразы вместо содержательного ответа или повторение одной мысли считаются ошибкой. Если доступные смыслы действительно скудные, не требуй выдумок ради объёма.
Понятное пояснение и интерпретация сочетания достоверных положений допустимы и не обязаны дословно повторять готовые фразы. Отличай объяснение склонностей и возможных условий от утверждения о случившемся личном факте. Не допускай выдуманную биографию, точные события, причины из прошлого или пол, не соответствующий gender. При gender=unspecified нужны нейтральные формулировки.
recentMessages помогают понять продолжение разговора. Ответ на новый вопрос не должен копировать прежний ответ или заново выдавать общий портрет. Отметь конкретно, какая часть вопроса не раскрыта или какое утверждение не подтверждено.
Если данные карты не дают ответа на предпосылку вопроса, candidate должен честно ограничить вывод, а не переключиться на случайную черту.
Короткая фраза о том, что натальная карта не определяет дату или событие по календарю, допустима как граница продукта и не требует отдельного meaning.
Если вопрос содержит предпосылку, которой карта не подтверждает, ответ не должен выдавать её за доказанный факт.`
    : `Check the answer to the specific question against reliable evidence from the saved chart.
ok=true only if the candidate answers question fully and coherently, and conclusions reasonably follow from saved_chart_evidence or available_meanings. Detailed interpretation of placements and their combinations is allowed; changing chart facts or inventing biography is not.
Return evidence_ids from saved_chart_evidence for all actually used support, up to 40, and meaning_ids for used prepared observations, up to 24. meaning_ids may be empty for an interpretation grounded directly in reliable placements. Correct inaccurate or incomplete author selection: a supported statement is not invented because of an omitted ID. Reject claims unsupported by chart evidence or approved observations.
Check signs, houses, objects and connection types against the supplied facts. Missing or excluded unreliable evidence must not be used. One slow-moving planet alone does not establish an individual trait.
Clear explanation and careful synthesis of supported observations are allowed. Use topics, area and topicMeanings to check context. Shared scope=background alone does not establish an individual trait.
Check depth against available_meanings: the answer addresses each part of the question, explains important connections and adds distinct relevant details across paragraphs. Ignoring a substantial part of the question and falling back to two general traits is an error. Do not demand a separate paraphrase of every similar meaning: several supporting observations may be covered by one connected point. Two generic sentences or repeated points instead of a substantive answer are errors. Do not demand invented details when source material is genuinely sparse.
Clear explanation and interpretation of combinations of reliable placements need not copy prepared observations. Distinguish tendencies and possible conditions from claims of actual personal events. Do not allow invented biography, exact events, causes from the person's past or gender inconsistent with gender. Use neutral wording for unspecified gender.
Use recentMessages to understand follow-ups. A new answer must not copy a previous answer or restart an unrelated general portrait. Identify the exact omitted question part or unsupported claim.
If chart data do not support the premise of the question, the candidate must state that limitation instead of switching to an unrelated trait.
A brief boundary saying a natal chart cannot determine a calendar date or event is allowed without a separate meaning.`;

  const response = await createLunaStructuredResponse({
    instructions,
    input: JSON.stringify({
      question: input.question,
      recentMessages: input.recentMessages,
      gender: input.gender,
      saved_chart_evidence: input.savedChartEvidence,
      available_meanings: input.availableMeanings,
      selected_meanings: input.meanings.map((meaning) => ({
        id: meaning.id,
        scope: meaning.scope,
        meaning: meaning.text,
        topics: meaning.topics,
        ...(meaning.topicText ? { topicMeanings: meaning.topicText } : {}),
        ...(meaning.area ? { area: meaning.area } : {}),
      })),
      candidate: input.answer,
    }),
    maxOutputTokens: 2000,
    reasoningEffort: 'medium',
    verbosity: 'low',
    store: false,
    schemaName: 'natal_question_semantic_review',
    schema: NATAL_QUESTION_SEMANTIC_REVIEW_SCHEMA,
  });
  let raw: RawNatalQuestionSemanticReview;
  try {
    raw = JSON.parse(response.content) as RawNatalQuestionSemanticReview;
  } catch {
    return { issues: ['semantic review returned invalid JSON'], meaningIds: [], evidenceIds: [] };
  }
  const meaningIds = answerMeaningIds(raw);
  const evidenceIds = answerEvidenceIds(raw);
  if (raw.ok === true) return { issues: [], meaningIds, evidenceIds };
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map(text).filter(Boolean)
    : [];
  return { issues: issues.length ? issues : ['semantic mismatch'], meaningIds, evidenceIds };
}

async function requestStructuredNatalQuestionAnswer(input: {
  language: NatalReadingLanguage;
  prompt: string;
}): Promise<RawNatalQuestionAnswer> {
  const response = await createLunaStructuredResponse({
    instructions: getNeboCoreVoice(input.language),
    input: input.prompt,
    maxOutputTokens: 4500,
    reasoningEffort: 'medium',
    verbosity: 'medium',
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
  history: readonly NatalQuestionStoredMessage[];
  question: string;
  requestAnswer?: NatalQuestionAnswerRequester;
  reviewAnswer?: NatalQuestionSemanticReviewer;
}): Promise<NatalQuestionAnswer> {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const { interpretation, context } = buildNatalQuestionPromptContext(input);
  const byId = new Map(interpretation.meanings.map((meaning) => [meaning.id, meaning]));
  const allowedMeaningIds = new Set(byId.keys());
  const allowedEvidenceIds = new Set(interpretation.evidence.map((evidence) => evidence.id));
  const requestAnswer = input.requestAnswer || requestStructuredNatalQuestionAnswer;
  const reviewAnswer = input.reviewAnswer || reviewNatalQuestionSemanticFidelity;
  let validationCodes: NatalQuestionValidationCode[] = [];
  let semanticIssues: string[] = [];
  let previousOutput: RawNatalQuestionAnswer | undefined;

  for (let attempt = 1; attempt <= MAX_ANSWER_ATTEMPTS; attempt += 1) {
    const raw = await requestAnswer({
      language,
      prompt: buildNatalQuestionPrompt(language, context, validationCodes, semanticIssues, previousOutput),
    });
    previousOutput = raw;
    validationCodes = getNatalQuestionAnswerValidationErrors(raw, allowedMeaningIds, allowedEvidenceIds);
    if (validationCodes.length > 0) {
      semanticIssues = validationCodes.includes('COPY_VIOLATION')
        ? natalQuestionCopyRepairDetails(text(raw.answer))
        : [];
      continue;
    }

    const meaningIds = answerMeaningIds(raw);
    const selectedMeanings = meaningIds
      .map((id) => byId.get(id))
      .filter((meaning): meaning is NatalMeaning => !!meaning);
    const review = await reviewAnswer({
      language,
      question: context.question,
      answer: text(raw.answer),
      meanings: selectedMeanings,
      availableMeanings: context.approvedMeanings,
      savedChartEvidence: interpretation.evidence,
      gender: context.gender || 'unspecified',
      recentMessages: context.recentMessages,
    });
    semanticIssues = Array.isArray(review) ? review : review.issues;
    if (semanticIssues.length > 0) {
      validationCodes = ['SEMANTIC_MISMATCH'];
      continue;
    }

    const reviewedRaw = {
      ...raw,
      meaning_ids: Array.isArray(review) ? meaningIds : review.meaningIds,
      evidence_ids: Array.isArray(review) ? answerEvidenceIds(raw) : review.evidenceIds,
    };
    validationCodes = getNatalQuestionAnswerValidationErrors(reviewedRaw, allowedMeaningIds, allowedEvidenceIds);
    if (validationCodes.length > 0) continue;

    return {
      ...validateNatalQuestionAnswer(reviewedRaw, allowedMeaningIds, interpretation)!,
      model: OPENAI_LUNA_MODEL,
      generationAttempts: attempt as 1 | 2,
    };
  }
  throw new NatalQuestionValidationError(validationCodes, MAX_ANSWER_ATTEMPTS);
}

export const NATAL_QUESTION_IDENTITY = {
  contractVersion: NATAL_QUESTION_CONTRACT_VERSION,
  interpretationVersion: NATAL_INTERPRETATION_VERSION,
  promptVersion: NATAL_QUESTION_PROMPT_VERSION,
  voiceVersion: APP_VOICE_VERSION,
} as const;
