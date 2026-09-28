import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { APP_VOICE_VERSION, withAppVoiceVersion } from '../appVoice';
import {
  buildNatalInterpretation,
  NATAL_INTERPRETATION_VERSION,
  type NatalInterpretation,
  type NatalMeaning,
} from '../natalInterpretation';
import { getNatalStorySystemPrompt } from '../voice/contracts/natal';
import { hasCoreVoiceViolation } from '../voice/validators';
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

export const NATAL_QUESTION_PROMPT_VERSION = withAppVoiceVersion('natal-question-v5');
export const NATAL_QUESTION_CONTRACT_VERSION = 'natal-question-v7';

const NATAL_QUESTION_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    meaning_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'meaning_ids'],
  additionalProperties: false,
};

const NATAL_QUESTION_SEMANTIC_REVIEW_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'issues'],
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
  approvedMeanings: Array<{
    id: string;
    scope: NatalMeaning['scope'];
    topics: NatalMeaning['topics'];
    meaning: string;
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
};

type RawNatalQuestionSemanticReview = {
  ok?: unknown;
  issues?: unknown;
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
  meanings: Array<Pick<NatalMeaning, 'id' | 'scope' | 'text'>>;
}) => Promise<string[]>;

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
      approvedMeanings: interpretation.meanings.map((meaning) => ({
        id: meaning.id,
        scope: meaning.scope,
        topics: meaning.topics,
        meaning: meaning.text,
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
): string {
  const rules = language === 'ru'
    ? `## КОНТРАКТ ФУНКЦИИ: ВОПРОС ПО НАТАЛЬНОЙ КАРТЕ

Отвечай по-русски и обращайся к человеку на «ты».

Ты отвечаешь только по уже готовым смыслам единого натального интерпретатора. Ты НЕ астрологический интерпретатор и не имеешь права заново трактовать сырые данные карты.

ЖЁСТКИЕ ПРАВИЛА:
- Во входе APPROVED_MEANINGS уже содержится весь разрешённый смысл.
- Верни только JSON: {"answer":"3-5 законченных предложений","meaning_ids":["существующий meaning id"]}.
- Сначала ответь на вопрос по делу. Используй только те meaning_ids, которые реально нужны для ответа: обычно 1–4, максимум 6.
- Каждое личное утверждение в answer должно быть прямым пересказом выбранных approved meanings. Нельзя добавлять новую причину, мотив, биографию, событие или психологический ярлык.
- Если готовые смыслы не подтверждают предпосылку вопроса, так и скажи простыми словами. Не подгоняй карту под вопрос.
- Не называй в answer планеты, знаки, дома, аспекты, углы, ретроградность, орбы или градусы. Технические основания приложение покажет отдельно.
- Не превращай ответ в коучинг: не давай человеку советы, инструкции, задания или «правильный путь».
- Не пиши служебным языком вроде «в этой теме», «динамика», «сфера», «функция», «карта показывает», «астрологическая трактовка».
- Не придумывай прошлое, травмы, страхи, диагнозы, отношения, профессию, доход, мысли других людей или гарантированные события.
- previous messages нужны только для связности разговора. Они не являются доказательством и не расширяют APPROVED_MEANINGS.
- Натальная карта не даёт календарных прогнозов. Если вопрос про сегодня/завтра/дату/когда случится, коротко обозначь эту границу и отвечай только о повторяющемся способе действия, который действительно есть в APPROVED_MEANINGS.
- Для timing-вопроса допустимая граница: «По натальной карте нельзя определить, лучший ли сегодня день, или назвать подходящую дату».
- Не приветствуй, не благодари за вопрос и не рассказывай, что сейчас будешь делать.`
    : `## CONTENT CONTRACT: NATAL QUESTION

Answer in English and address the reader as “you”.

You answer only from the already approved meanings produced by the unified natal interpreter. You are NOT allowed to reinterpret raw chart data.

STRICT RULES:
- APPROVED_MEANINGS contains the entire allowed interpretation.
- Return JSON only: {"answer":"3-5 complete sentences","meaning_ids":["existing meaning id"]}.
- Answer the question directly. Use only the meaning_ids actually needed for the answer: normally 1–4, maximum 6.
- Every personal claim in answer must be a direct paraphrase of the selected approved meanings. Add no new cause, motive, biography, event, or psychological label.
- If the approved meanings do not support the premise of the question, say so plainly. Do not force the chart to fit the question.
- Do not name planets, signs, houses, aspects, angles, retrograde motion, orbs, or degrees in answer. The app shows technical evidence separately.
- Do not coach, advise, prescribe, or give the reader tasks or a “right path”.
- Avoid meta/report language such as “this theme”, “dynamic”, “sphere”, “function”, “the chart shows”, or “astrological interpretation”.
- Do not invent past events, trauma, fears, diagnoses, relationship history, profession, income, third-party thoughts, or guaranteed events.
- previous messages are only for conversational continuity. They are not evidence and do not expand APPROVED_MEANINGS.
- A natal chart does not provide calendar forecasts. For today/tomorrow/date/when questions, briefly state that boundary and answer only from a recurring way of acting that is actually present in APPROVED_MEANINGS.
- A safe timing boundary is: “The natal chart cannot determine whether today is the best day or name a suitable date.”
- No greeting, thanks, or setup paragraph.`;

  return `${rules}

APPROVED CONTEXT:
${JSON.stringify(context, null, 2)}${repairErrors.length ? `

PREVIOUS OUTPUT WAS REJECTED:
${repairErrors.join(', ')}
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
const QUESTION_ADVICE_LANGUAGE = /(?:тебе\s+(?:нужно|стоит|следует|важно)(?!\p{L})|(?:попробуй|старайся|помни|сохраняй|проверь|сверь|выбирай|держи|не\s+бойся|позволь\s+себе)(?!\p{L})|\b(?:you\s+should|you\s+need\s+to|try\s+to|remember\s+to|make\s+sure\s+to|check\s+that|choose\s+based)\b)/iu;

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
  if (getNatalQuestionAnswerValidationErrors(raw, allowedMeaningIds).length > 0) return null;
  const meaningIds = answerMeaningIds(raw);
  return {
    text: text(raw?.answer),
    meaningIds,
    evidenceIds: interpretation ? evidenceIdsForMeanings(interpretation, meaningIds) : [],
  };
}

export function getNatalQuestionAnswerValidationErrors(
  raw: RawNatalQuestionAnswer,
  allowedMeaningIds: Set<string>,
): NatalQuestionValidationCode[] {
  const answer = text(raw?.answer);
  const ids = answerMeaningIds(raw);
  const errors = new Set<NatalQuestionValidationCode>();
  const sentences = sentenceCount(answer);

  if (answer.length < 40) errors.add('ANSWER_TOO_SHORT');
  if (answer.length > 1600) errors.add('ANSWER_TOO_LONG');
  if (sentences < 3 || sentences > 5) errors.add('SENTENCE_COUNT_INVALID');
  if (ids.length === 0) errors.add('MEANING_REQUIRED');
  if (ids.some((id) => !allowedMeaningIds.has(id))) errors.add('MEANING_UNKNOWN');
  if (ids.length > 6) errors.add('MEANING_SELECTION_TOO_BROAD');
  if (
    hasCoreVoiceViolation(answer)
    || QUESTION_VISIBLE_ASTROLOGY.test(answer)
    || QUESTION_PSEUDO_PSYCHOLOGY.test(answer)
    || QUESTION_META_LANGUAGE.test(answer)
    || QUESTION_ADVICE_LANGUAGE.test(answer)
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
  meanings: Array<Pick<NatalMeaning, 'id' | 'scope' | 'text'>>;
}): Promise<string[]> {
  const instructions = input.language === 'ru'
    ? `Проверь только соответствие ответа уже утверждённым смыслам.
Не трактуй астрологию заново.
ok=true только если candidate прямо отвечает на question, выбранные selected_meanings действительно относятся к question, все личные утверждения прямо поддерживаются selected_meanings и candidate не добавляет новую причину, мотив, биографию, событие, психологический ярлык или совет.
Если selected_meanings не дают прямого ответа на предпосылку вопроса, candidate должен честно ограничить вывод, а не переключиться на случайную черту.
Короткая фраза о том, что натальная карта не определяет дату или событие по календарю, допустима как граница продукта и не требует отдельного meaning.
Если вопрос содержит предпосылку, которой нет в selected_meanings, ответ не должен выдавать её за доказанный факт.`
    : `Check only whether the candidate is faithful to the selected approved meanings.
Do not reinterpret astrology.
ok=true only if the candidate directly addresses question, the selected_meanings are genuinely relevant to question, every personal claim is directly supported by selected_meanings, and the candidate adds no new cause, motive, biography, event, psychological label, or advice.
If selected_meanings do not support the premise of the question, the candidate must state that limitation instead of switching to an unrelated trait.
A brief boundary saying a natal chart cannot determine a calendar date or event is allowed without a separate meaning.`;

  const response = await createLunaStructuredResponse({
    instructions,
    input: JSON.stringify({
      question: input.question,
      selected_meanings: input.meanings.map((meaning) => ({
        id: meaning.id,
        scope: meaning.scope,
        meaning: meaning.text,
      })),
      candidate: input.answer,
    }),
    maxOutputTokens: 500,
    reasoningEffort: 'low',
    verbosity: 'low',
    store: false,
    schemaName: 'natal_question_semantic_review',
    schema: NATAL_QUESTION_SEMANTIC_REVIEW_SCHEMA,
  });
  let raw: RawNatalQuestionSemanticReview;
  try {
    raw = JSON.parse(response.content) as RawNatalQuestionSemanticReview;
  } catch {
    return ['semantic review returned invalid JSON'];
  }
  if (raw.ok === true) return [];
  return Array.isArray(raw.issues)
    ? raw.issues.map(text).filter(Boolean)
    : ['semantic mismatch'];
}

async function requestStructuredNatalQuestionAnswer(input: {
  language: NatalReadingLanguage;
  prompt: string;
}): Promise<RawNatalQuestionAnswer> {
  const response = await createLunaStructuredResponse({
    instructions: getNatalStorySystemPrompt(input.language),
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
  history: readonly NatalQuestionStoredMessage[];
  question: string;
  requestAnswer?: NatalQuestionAnswerRequester;
  reviewAnswer?: NatalQuestionSemanticReviewer;
}): Promise<NatalQuestionAnswer> {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const { interpretation, context } = buildNatalQuestionPromptContext(input);
  const byId = new Map(interpretation.meanings.map((meaning) => [meaning.id, meaning]));
  const allowedMeaningIds = new Set(byId.keys());
  const requestAnswer = input.requestAnswer || requestStructuredNatalQuestionAnswer;
  const reviewAnswer = input.reviewAnswer || reviewNatalQuestionSemanticFidelity;
  let validationCodes: NatalQuestionValidationCode[] = [];

  for (let attempt = 1; attempt <= MAX_ANSWER_ATTEMPTS; attempt += 1) {
    const raw = await requestAnswer({
      language,
      prompt: buildNatalQuestionPrompt(language, context, validationCodes),
    });
    validationCodes = getNatalQuestionAnswerValidationErrors(raw, allowedMeaningIds);
    if (validationCodes.length > 0) continue;

    const meaningIds = answerMeaningIds(raw);
    const selectedMeanings = meaningIds
      .map((id) => byId.get(id))
      .filter((meaning): meaning is NatalMeaning => !!meaning);
    const semanticIssues = await reviewAnswer({
      language,
      question: context.question,
      answer: text(raw.answer),
      meanings: selectedMeanings,
    });
    if (semanticIssues.length > 0) {
      validationCodes = ['SEMANTIC_MISMATCH'];
      continue;
    }

    return {
      ...validateNatalQuestionAnswer(raw, allowedMeaningIds, interpretation)!,
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
