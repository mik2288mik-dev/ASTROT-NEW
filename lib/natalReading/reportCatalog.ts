import { withAppVoiceCacheKey, withAppVoiceVersion } from '../appVoice';

export const NATAL_REPORT_CATALOG_CONTRACT_VERSION = 'natal-report-catalog-v1';
export const NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.category.v1`,
);
export const NATAL_REPORT_CATALOG_ANSWER_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_REPORT_CATALOG_CONTRACT_VERSION}.answer.v1`,
);
export const NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY = withAppVoiceCacheKey(
  'natal.report-catalog.category.v1',
);
export const NATAL_REPORT_CATALOG_ANSWER_CACHE_KEY = withAppVoiceCacheKey(
  'natal.report-catalog.answer.v1',
);

export const NATAL_REPORT_CATEGORY_KEYS = [
  'main',
  'character',
  'love',
  'communication',
  'work',
  'money',
] as const;

export type NatalReportCategoryKey = (typeof NATAL_REPORT_CATEGORY_KEYS)[number];

export const NATAL_REPORT_ANSWER_KEYS = [
  'main_how_people_see_you',
  'main_not_seen_at_once',
  'character_decisions',
  'character_change_mind',
  'character_irritation',
  'character_boredom',
  'character_stand_ground',
  'character_plan_breaks',
  'character_best_at',
  'character_unusual_mix',
  'love_people_you_like',
  'love_show_interest',
  'love_attachment_speed',
  'love_turnoffs',
  'love_lose_interest',
  'love_need_freedom',
  'love_nonnegotiables',
  'love_relationship_you_want',
  'love_right_person',
  'communication_new_people',
  'communication_direct_or_unsaid',
  'communication_texting',
  'communication_misunderstood',
  'communication_criticism',
  'communication_arguments',
  'communication_after_fight',
  'communication_close_people',
  'communication_ask_for_help',
  'work_start_new',
  'work_routine',
  'work_team_or_solo',
  'work_leadership',
  'work_authority',
  'work_deadlines',
  'work_interest_killers',
  'work_own_business',
  'work_clients',
  'work_best_at',
  'money_save_or_spend',
  'money_big_decisions',
  'money_risk',
  'money_name_price',
  'money_unnoticed_spending',
  'money_independence',
  'money_income_stability_freedom',
  'money_shared',
  'money_status_things',
] as const;

export type NatalReportAnswerKey = (typeof NATAL_REPORT_ANSWER_KEYS)[number];
export type NatalReportAccess = 'free' | 'premium';

export const NATAL_REPORT_MAIN_PREVIEW_KEYS = [
  'main_how_people_see_you',
  'main_not_seen_at_once',
  'love_people_you_like',
  'communication_arguments',
  'work_routine',
  'money_save_or_spend',
] as const satisfies readonly NatalReportAnswerKey[];

type LocalizedText = Readonly<{ ru: string; en: string }>;
type LocalizedList = Readonly<{ ru: readonly string[]; en: readonly string[] }>;

export type NatalReportAnswerDefinition = Readonly<{
  key: NatalReportAnswerKey;
  categoryKey: NatalReportCategoryKey;
  title: LocalizedText;
  access: NatalReportAccess;
  related: readonly NatalReportAnswerKey[];
  fullAnswerIncludes: LocalizedList;
}>;

export type NatalReportCategoryDefinition = Readonly<{
  key: NatalReportCategoryKey;
  title: LocalizedText;
  answerKeys: readonly NatalReportAnswerKey[];
}>;

export type NatalReportStatement = {
  text: string;
  evidenceIds: string[];
};

export type NatalReportPreview = {
  answerKey: NatalReportAnswerKey;
  title: string;
  preview: string;
  evidenceIds: string[];
  access: NatalReportAccess;
  related: readonly NatalReportAnswerKey[];
  fullAnswerIncludes: string[];
};

export type NatalReportAnswer = {
  schemaVersion: 'natal-report-answer-v1';
  contractVersion: typeof NATAL_REPORT_CATALOG_CONTRACT_VERSION;
  answerKey: NatalReportAnswerKey;
  categoryKey: NatalReportCategoryKey;
  title: string;
  access: NatalReportAccess;
  paragraphs: NatalReportStatement[];
  evidenceIds: string[];
  related: readonly NatalReportAnswerKey[];
  fullAnswerIncludes: string[];
};

export type NatalReportCategoryPack = {
  schemaVersion: 'natal-report-category-v1';
  contractVersion: typeof NATAL_REPORT_CATALOG_CONTRACT_VERSION;
  categoryKey: NatalReportCategoryKey;
  title: string;
  summary: NatalReportStatement[];
  observations: NatalReportStatement[];
  previews: NatalReportPreview[];
  freeAnswers: NatalReportAnswer[];
};

function details(ru: readonly string[], en: readonly string[]): LocalizedList {
  return { ru, en };
}

const ANSWERS: Record<NatalReportAnswerKey, NatalReportAnswerDefinition> = {
  main_how_people_see_you: {
    key: 'main_how_people_see_you', categoryKey: 'main', access: 'free',
    title: { ru: 'Как тебя видят', en: 'How people see you' },
    related: ['main_not_seen_at_once', 'communication_new_people', 'character_decisions'],
    fullAnswerIncludes: details(
      ['что замечают при знакомстве', 'какое впечатление остаётся после разговора', 'что люди понимают правильно', 'в чём первое впечатление ошибается'],
      ['what people notice at first', 'what remains after a conversation', 'what they read correctly', 'where the first impression misses'],
    ),
  },
  main_not_seen_at_once: {
    key: 'main_not_seen_at_once', categoryKey: 'main', access: 'free',
    title: { ru: 'Что в тебе не сразу замечают', en: 'What people do not notice at once' },
    related: ['main_how_people_see_you', 'character_unusual_mix', 'love_show_interest'],
    fullAnswerIncludes: details(
      ['что остаётся за первым впечатлением', 'когда это становится заметно', 'кто видит это быстрее', 'почему другие могут ошибиться'],
      ['what sits behind the first impression', 'when it becomes visible', 'who sees it sooner', 'why others can get it wrong'],
    ),
  },
  character_decisions: {
    key: 'character_decisions', categoryKey: 'character', access: 'free',
    title: { ru: 'Как ты принимаешь решения', en: 'How you make decisions' },
    related: ['character_change_mind', 'character_stand_ground', 'money_big_decisions'],
    fullAnswerIncludes: details(
      ['что проверяешь первым', 'когда решаешь быстро', 'что заставляет тянуть', 'после чего решение уже не меняется'],
      ['what you check first', 'when you decide quickly', 'what slows the choice', 'when the decision stops changing'],
    ),
  },
  character_change_mind: {
    key: 'character_change_mind', categoryKey: 'character', access: 'premium',
    title: { ru: 'Быстро ли ты меняешь мнение', en: 'How quickly you change your mind' },
    related: ['character_decisions', 'character_stand_ground', 'communication_criticism'],
    fullAnswerIncludes: details(
      ['что способно тебя переубедить', 'какие доводы не работают', 'когда ты признаёшь ошибку', 'почему со стороны это выглядит упрямством'],
      ['what can change your mind', 'which arguments do not work', 'when you admit a mistake', 'why this can look stubborn'],
    ),
  },
  character_irritation: {
    key: 'character_irritation', categoryKey: 'character', access: 'premium',
    title: { ru: 'Что тебя раздражает', en: 'What irritates you' },
    related: ['character_plan_breaks', 'communication_arguments', 'love_turnoffs'],
    fullAnswerIncludes: details(
      ['что цепляет первым', 'как долго ты терпишь', 'когда говоришь прямо', 'что быстро возвращает разговор к делу'],
      ['what gets to you first', 'how long you put up with it', 'when you speak directly', 'what brings the talk back to the point'],
    ),
  },
  character_boredom: {
    key: 'character_boredom', categoryKey: 'character', access: 'premium',
    title: { ru: 'Что тебе быстро надоедает', en: 'What bores you quickly' },
    related: ['work_routine', 'work_interest_killers', 'love_lose_interest'],
    fullAnswerIncludes: details(
      ['какой повтор утомляет', 'что ещё держит интерес', 'когда ты начинаешь искать другое', 'почему не всякая стабильность скучна'],
      ['which repetition drains you', 'what keeps your interest', 'when you start looking elsewhere', 'why not every routine is boring'],
    ),
  },
  character_stand_ground: {
    key: 'character_stand_ground', categoryKey: 'character', access: 'premium',
    title: { ru: 'Где ты стоишь до конца', en: 'Where you stand your ground' },
    related: ['character_decisions', 'communication_arguments', 'work_authority'],
    fullAnswerIncludes: details(
      ['что для тебя не обсуждается', 'где возможен компромисс', 'как ты защищаешь решение', 'когда всё-таки отступаешь'],
      ['what is not negotiable for you', 'where compromise is possible', 'how you defend a decision', 'when you still step back'],
    ),
  },
  character_plan_breaks: {
    key: 'character_plan_breaks', categoryKey: 'character', access: 'premium',
    title: { ru: 'Что ты делаешь, когда всё идёт не так', en: 'What you do when things go wrong' },
    related: ['work_deadlines', 'character_irritation', 'communication_misunderstood'],
    fullAnswerIncludes: details(
      ['твоя первая реакция', 'что делаешь сразу после', 'когда меняешь план', 'что сильнее всего мешает собраться'],
      ['your first reaction', 'what you do next', 'when you change the plan', 'what makes recovery harder'],
    ),
  },
  character_best_at: {
    key: 'character_best_at', categoryKey: 'character', access: 'premium',
    title: { ru: 'Что у тебя получается лучше других', en: 'What you do better than most' },
    related: ['work_best_at', 'work_leadership', 'character_unusual_mix'],
    fullAnswerIncludes: details(
      ['где ты быстрее видишь суть', 'какие задачи тебе даются легче', 'что замечают другие', 'где сильная сторона перестаёт помогать'],
      ['where you see the point sooner', 'which tasks come easier', 'what others notice', 'when the strength stops helping'],
    ),
  },
  character_unusual_mix: {
    key: 'character_unusual_mix', categoryKey: 'character', access: 'premium',
    title: { ru: 'Что в тебе странно сочетается', en: 'What combines unexpectedly in you' },
    related: ['main_not_seen_at_once', 'character_change_mind', 'love_need_freedom'],
    fullAnswerIncludes: details(
      ['какие две реакции живут рядом', 'когда включается каждая', 'почему люди видят только одну', 'как это выглядит в обычном деле'],
      ['which two reactions sit side by side', 'when each one appears', 'why people see only one', 'how it looks in an ordinary situation'],
    ),
  },
  love_people_you_like: {
    key: 'love_people_you_like', categoryKey: 'love', access: 'premium',
    title: { ru: 'Какие люди тебе нравятся', en: 'Which people attract you' },
    related: ['love_show_interest', 'love_right_person', 'love_turnoffs'],
    fullAnswerIncludes: details(
      ['что замечаешь первым', 'какой разговор держит интерес', 'что важнее внешнего впечатления', 'почему симпатия не всегда продолжается'],
      ['what you notice first', 'which conversation holds your interest', 'what matters beyond appearance', 'why attraction does not always last'],
    ),
  },
  love_show_interest: {
    key: 'love_show_interest', categoryKey: 'love', access: 'free',
    title: { ru: 'Как ты показываешь интерес', en: 'How you show interest' },
    related: ['love_people_you_like', 'love_attachment_speed', 'main_not_seen_at_once'],
    fullAnswerIncludes: details(
      ['какие мелочи тебя выдают', 'когда делаешь первый шаг', 'почему симпатию можно не заметить', 'что меняется при ответном интересе'],
      ['which details give you away', 'when you make the first move', 'why your interest can be missed', 'what changes when interest is mutual'],
    ),
  },
  love_attachment_speed: {
    key: 'love_attachment_speed', categoryKey: 'love', access: 'premium',
    title: { ru: 'Как быстро ты привязываешься', en: 'How quickly you get attached' },
    related: ['love_show_interest', 'love_need_freedom', 'love_relationship_you_want'],
    fullAnswerIncludes: details(
      ['когда человек становится важным', 'что ускоряет сближение', 'что заставляет держать дистанцию', 'когда ты признаёшь привязанность'],
      ['when someone becomes important', 'what speeds up closeness', 'what keeps distance', 'when you admit attachment'],
    ),
  },
  love_turnoffs: {
    key: 'love_turnoffs', categoryKey: 'love', access: 'premium',
    title: { ru: 'Что тебя сразу отталкивает', en: 'What puts you off at once' },
    related: ['love_people_you_like', 'love_lose_interest', 'character_irritation'],
    fullAnswerIncludes: details(
      ['какой сигнал замечаешь сразу', 'что ещё готов простить', 'когда интерес обрывается', 'что выглядит хуже обычной ошибки'],
      ['which signal you notice at once', 'what you can still forgive', 'when interest ends', 'what looks worse than an ordinary mistake'],
    ),
  },
  love_lose_interest: {
    key: 'love_lose_interest', categoryKey: 'love', access: 'premium',
    title: { ru: 'Почему ты можешь быстро остыть', en: 'Why you can lose interest quickly' },
    related: ['love_turnoffs', 'love_people_you_like', 'character_boredom'],
    fullAnswerIncludes: details(
      ['что сначала цепляет', 'что удерживает внимание', 'когда становится скучно', 'почему дело не всегда в другом человеке'],
      ['what catches you first', 'what holds attention', 'when it turns dull', 'why it is not always about the other person'],
    ),
  },
  love_need_freedom: {
    key: 'love_need_freedom', categoryKey: 'love', access: 'premium',
    title: { ru: 'Насколько тебе нужна свобода', en: 'How much freedom you need' },
    related: ['love_nonnegotiables', 'love_attachment_speed', 'character_unusual_mix'],
    fullAnswerIncludes: details(
      ['какое пространство тебе нужно', 'что не похоже на контроль', 'когда близость начинает давить', 'как ты соблюдаешь договорённости'],
      ['what space you need', 'what does not feel controlling', 'when closeness starts to press', 'how you keep agreements'],
    ),
  },
  love_nonnegotiables: {
    key: 'love_nonnegotiables', categoryKey: 'love', access: 'premium',
    title: { ru: 'Что обязательно должно быть в отношениях', en: 'What a relationship must have for you' },
    related: ['love_relationship_you_want', 'love_need_freedom', 'love_right_person'],
    fullAnswerIncludes: details(
      ['без чего отношения не держатся', 'что можно обсуждать', 'что ты ждёшь в ответ', 'какая мелочь для тебя совсем не мелочь'],
      ['what a relationship cannot do without', 'what can be discussed', 'what you expect in return', 'which small thing is not small to you'],
    ),
  },
  love_relationship_you_want: {
    key: 'love_relationship_you_want', categoryKey: 'love', access: 'premium',
    title: { ru: 'Каких отношений ты хочешь', en: 'What kind of relationship you want' },
    related: ['love_nonnegotiables', 'love_right_person', 'love_attachment_speed'],
    fullAnswerIncludes: details(
      ['какой темп тебе подходит', 'сколько близости тебе нужно', 'как должны решаться разногласия', 'что делает отношения живыми'],
      ['which pace suits you', 'how much closeness you need', 'how disagreements should be handled', 'what keeps a relationship alive'],
    ),
  },
  love_right_person: {
    key: 'love_right_person', categoryKey: 'love', access: 'premium',
    title: { ru: 'Какой человек тебе подходит', en: 'Which person suits you' },
    related: ['love_people_you_like', 'love_relationship_you_want', 'love_nonnegotiables'],
    fullAnswerIncludes: details(
      ['с кем легко начать', 'с кем интересно продолжать', 'какая разница не мешает', 'что должно совпасть обязательно'],
      ['who is easy to start with', 'who stays interesting', 'which difference is workable', 'what must match'],
    ),
  },
  communication_new_people: {
    key: 'communication_new_people', categoryKey: 'communication', access: 'free',
    title: { ru: 'Как ты ведёшь себя с новыми людьми', en: 'How you act with new people' },
    related: ['main_how_people_see_you', 'communication_direct_or_unsaid', 'communication_texting'],
    fullAnswerIncludes: details(
      ['как начинаешь разговор', 'что замечаешь в человеке', 'когда становишься свободнее', 'почему первое впечатление меняется'],
      ['how you start a conversation', 'what you notice in a person', 'when you loosen up', 'why the first impression changes'],
    ),
  },
  communication_direct_or_unsaid: {
    key: 'communication_direct_or_unsaid', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Говоришь прямо или оставляешь недосказанность', en: 'Whether you speak directly or leave things unsaid' },
    related: ['communication_new_people', 'communication_arguments', 'communication_close_people'],
    fullAnswerIncludes: details(
      ['что говоришь сразу', 'что оставляешь при себе', 'когда переходишь к сути', 'почему намёк могут не понять'],
      ['what you say at once', 'what you keep back', 'when you get to the point', 'why a hint can be missed'],
    ),
  },
  communication_texting: {
    key: 'communication_texting', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Как ты переписываешься', en: 'How you text' },
    related: ['communication_direct_or_unsaid', 'love_show_interest', 'communication_misunderstood'],
    fullAnswerIncludes: details(
      ['как быстро отвечаешь', 'насколько подробно пишешь', 'что выдаёт твой интерес', 'из-за чего тон могут понять неверно'],
      ['how quickly you reply', 'how much detail you use', 'what shows your interest', 'why your tone can be misread'],
    ),
  },
  communication_misunderstood: {
    key: 'communication_misunderstood', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Что ты делаешь, когда тебя не поняли', en: 'What you do when people misunderstand you' },
    related: ['communication_criticism', 'communication_arguments', 'character_plan_breaks'],
    fullAnswerIncludes: details(
      ['пытаешься ли объяснить ещё раз', 'когда меняешь формулировку', 'когда прекращаешь разговор', 'что раздражает сильнее ошибки'],
      ['whether you explain again', 'when you change the wording', 'when you end the talk', 'what is worse than a simple mistake'],
    ),
  },
  communication_criticism: {
    key: 'communication_criticism', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Как ты реагируешь на критику', en: 'How you react to criticism' },
    related: ['character_change_mind', 'communication_misunderstood', 'communication_arguments'],
    fullAnswerIncludes: details(
      ['что слышишь первым', 'какую критику принимаешь', 'что вызывает спор', 'когда возвращаешься к замечанию позже'],
      ['what you hear first', 'which criticism you accept', 'what starts an argument', 'when you revisit the comment later'],
    ),
  },
  communication_arguments: {
    key: 'communication_arguments', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Как ты споришь', en: 'How you argue' },
    related: ['communication_after_fight', 'communication_criticism', 'character_stand_ground'],
    fullAnswerIncludes: details(
      ['за что цепляешься первым', 'как меняется твой тон', 'когда спор ещё имеет смысл', 'когда ты ставишь точку'],
      ['what you seize on first', 'how your tone changes', 'when the argument is still useful', 'when you end it'],
    ),
  },
  communication_after_fight: {
    key: 'communication_after_fight', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Что ты делаешь после ссоры', en: 'What you do after a fight' },
    related: ['communication_arguments', 'communication_close_people', 'love_nonnegotiables'],
    fullAnswerIncludes: details(
      ['нужна ли тебе пауза', 'кто должен начать разговор', 'что помогает вернуться', 'что оставляет вопрос незакрытым'],
      ['whether you need a pause', 'who should restart the talk', 'what helps you return', 'what leaves the issue unfinished'],
    ),
  },
  communication_close_people: {
    key: 'communication_close_people', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Как ты ведёшь себя с близкими', en: 'How you speak with people close to you' },
    related: ['communication_after_fight', 'communication_ask_for_help', 'love_relationship_you_want'],
    fullAnswerIncludes: details(
      ['чем этот разговор отличается', 'что говоришь без фильтра', 'чего ждёшь от близких', 'когда замолкаешь вместо объяснения'],
      ['how this talk differs', 'what you say without a filter', 'what you expect from close people', 'when you go quiet instead of explaining'],
    ),
  },
  communication_ask_for_help: {
    key: 'communication_ask_for_help', categoryKey: 'communication', access: 'premium',
    title: { ru: 'Легко ли тебе просить о чём-то', en: 'How easy it is for you to ask for something' },
    related: ['communication_close_people', 'work_team_or_solo', 'money_shared'],
    fullAnswerIncludes: details(
      ['когда просишь прямо', 'что предпочитаешь сделать сам', 'как формулируешь просьбу', 'почему другой может не понять её важность'],
      ['when you ask directly', 'what you prefer to do alone', 'how you phrase a request', 'why others can miss its importance'],
    ),
  },
  work_start_new: {
    key: 'work_start_new', categoryKey: 'work', access: 'free',
    title: { ru: 'Как ты начинаешь новое дело', en: 'How you start something new' },
    related: ['work_deadlines', 'work_interest_killers', 'character_decisions'],
    fullAnswerIncludes: details(
      ['что нужно понять до старта', 'как быстро включаешься', 'что делаешь первым', 'из-за чего начало откладывается'],
      ['what you need before starting', 'how quickly you engage', 'what you do first', 'what delays the start'],
    ),
  },
  work_routine: {
    key: 'work_routine', categoryKey: 'work', access: 'premium',
    title: { ru: 'Долго ли ты выдерживаешь однообразие', en: 'How long you handle routine' },
    related: ['character_boredom', 'work_interest_killers', 'work_team_or_solo'],
    fullAnswerIncludes: details(
      ['какой повтор переносишь спокойно', 'что начинает утомлять', 'как поддерживаешь темп', 'когда ищешь другую задачу'],
      ['which repetition is fine', 'what starts to drain you', 'how you keep pace', 'when you seek another task'],
    ),
  },
  work_team_or_solo: {
    key: 'work_team_or_solo', categoryKey: 'work', access: 'premium',
    title: { ru: 'Команда или самостоятельная работа', en: 'Teamwork or working alone' },
    related: ['work_leadership', 'work_authority', 'communication_ask_for_help'],
    fullAnswerIncludes: details(
      ['что легче делать самому', 'где команда ускоряет дело', 'какая роль тебе подходит', 'что мешает совместной работе'],
      ['what is easier alone', 'where a team speeds things up', 'which role suits you', 'what gets in the way of teamwork'],
    ),
  },
  work_leadership: {
    key: 'work_leadership', categoryKey: 'work', access: 'premium',
    title: { ru: 'Можешь ли ты руководить', en: 'Whether you can lead' },
    related: ['work_team_or_solo', 'work_authority', 'work_clients'],
    fullAnswerIncludes: details(
      ['как ставишь задачу', 'что контролируешь лично', 'как реагируешь на ошибку', 'какой сотрудник с тобой сработается'],
      ['how you set a task', 'what you check yourself', 'how you handle a mistake', 'which employee works well with you'],
    ),
  },
  work_authority: {
    key: 'work_authority', categoryKey: 'work', access: 'premium',
    title: { ru: 'Как ты относишься к начальству', en: 'How you deal with authority' },
    related: ['work_leadership', 'character_stand_ground', 'work_team_or_solo'],
    fullAnswerIncludes: details(
      ['какие требования принимаешь', 'что должно быть объяснено', 'когда начинаешь спорить', 'какого руководителя уважаешь'],
      ['which demands you accept', 'what must be explained', 'when you start arguing', 'which manager earns your respect'],
    ),
  },
  work_deadlines: {
    key: 'work_deadlines', categoryKey: 'work', access: 'premium',
    title: { ru: 'Как ты работаешь, когда сроки поджимают', en: 'How you work under a deadline' },
    related: ['work_start_new', 'character_plan_breaks', 'work_interest_killers'],
    fullAnswerIncludes: details(
      ['что ускоряется первым', 'что рискуешь пропустить', 'когда давление помогает', 'когда срок начинает мешать'],
      ['what speeds up first', 'what you may miss', 'when pressure helps', 'when the deadline gets in the way'],
    ),
  },
  work_interest_killers: {
    key: 'work_interest_killers', categoryKey: 'work', access: 'premium',
    title: { ru: 'Что быстро убивает интерес к работе', en: 'What kills your interest in work' },
    related: ['work_routine', 'character_boredom', 'work_own_business'],
    fullAnswerIncludes: details(
      ['что раздражает в задаче', 'что утомляет в порядке работы', 'когда ещё можно вернуть интерес', 'после чего ты уже смотришь в сторону'],
      ['what annoys you in a task', 'what drains you in the process', 'when interest can return', 'when you start looking elsewhere'],
    ),
  },
  work_own_business: {
    key: 'work_own_business', categoryKey: 'work', access: 'premium',
    title: { ru: 'Подходит ли тебе своё дело', en: 'Whether running your own business suits you' },
    related: ['work_leadership', 'work_clients', 'money_risk'],
    fullAnswerIncludes: details(
      ['что нравится в самостоятельности', 'какая ответственность не пугает', 'где нужен партнёр', 'что может быстро вымотать'],
      ['what you like about independence', 'which responsibility is manageable', 'where a partner helps', 'what can drain you quickly'],
    ),
  },
  work_clients: {
    key: 'work_clients', categoryKey: 'work', access: 'premium',
    title: { ru: 'Как ты ведёшь себя с клиентами', en: 'How you work with clients' },
    related: ['work_leadership', 'communication_direct_or_unsaid', 'money_name_price'],
    fullAnswerIncludes: details(
      ['как выясняешь запрос', 'что объясняешь сразу', 'как отвечаешь на давление', 'какой клиент с тобой сработается'],
      ['how you clarify the request', 'what you explain at once', 'how you answer pressure', 'which client works well with you'],
    ),
  },
  work_best_at: {
    key: 'work_best_at', categoryKey: 'work', access: 'premium',
    title: { ru: 'Что у тебя получается лучше всего', en: 'What you do best at work' },
    related: ['character_best_at', 'work_leadership', 'work_start_new'],
    fullAnswerIncludes: details(
      ['какие задачи твои', 'где ты быстрее других', 'какой результат заметен', 'что мешает использовать это чаще'],
      ['which tasks fit you', 'where you move faster than others', 'which result stands out', 'what keeps you from using it more often'],
    ),
  },
  money_save_or_spend: {
    key: 'money_save_or_spend', categoryKey: 'money', access: 'free',
    title: { ru: 'Тебе легче копить или тратить', en: 'Whether saving or spending is easier for you' },
    related: ['money_unnoticed_spending', 'money_big_decisions', 'money_income_stability_freedom'],
    fullAnswerIncludes: details(
      ['что хочется купить сразу', 'ради чего копишь спокойно', 'когда трата кажется оправданной', 'что сбивает план'],
      ['what you want to buy at once', 'what makes saving easy', 'when spending feels justified', 'what knocks the plan off course'],
    ),
  },
  money_big_decisions: {
    key: 'money_big_decisions', categoryKey: 'money', access: 'premium',
    title: { ru: 'Как ты принимаешь крупные денежные решения', en: 'How you make big money decisions' },
    related: ['character_decisions', 'money_risk', 'money_save_or_spend'],
    fullAnswerIncludes: details(
      ['что проверяешь первым', 'сколько времени нужно', 'чьё мнение учитываешь', 'когда решение становится окончательным'],
      ['what you check first', 'how much time you need', 'whose opinion matters', 'when the decision becomes final'],
    ),
  },
  money_risk: {
    key: 'money_risk', categoryKey: 'money', access: 'premium',
    title: { ru: 'Насколько ты готов рисковать', en: 'How willing you are to take financial risks' },
    related: ['money_big_decisions', 'work_own_business', 'money_income_stability_freedom'],
    fullAnswerIncludes: details(
      ['какой риск выглядит разумным', 'что должно быть известно заранее', 'когда азарт мешает', 'после чего ты отказываешься'],
      ['which risk looks reasonable', 'what must be known first', 'when excitement gets in the way', 'what makes you walk away'],
    ),
  },
  money_name_price: {
    key: 'money_name_price', categoryKey: 'money', access: 'premium',
    title: { ru: 'Легко ли тебе называть цену', en: 'How easily you name your price' },
    related: ['work_clients', 'money_independence', 'communication_direct_or_unsaid'],
    fullAnswerIncludes: details(
      ['как оцениваешь свою работу', 'когда называешь сумму прямо', 'что заставляет уступить', 'какой разговор о цене раздражает'],
      ['how you value your work', 'when you name the amount directly', 'what makes you concede', 'which price conversation annoys you'],
    ),
  },
  money_unnoticed_spending: {
    key: 'money_unnoticed_spending', categoryKey: 'money', access: 'premium',
    title: { ru: 'На что деньги уходят незаметно', en: 'Where money slips away unnoticed' },
    related: ['money_save_or_spend', 'money_status_things', 'money_shared'],
    fullAnswerIncludes: details(
      ['какие траты кажутся мелкими', 'что покупаешь ради удобства', 'когда сумма набегает быстро', 'что ты замечаешь только после'],
      ['which expenses look small', 'what you buy for convenience', 'when the total grows quickly', 'what you notice only afterwards'],
    ),
  },
  money_independence: {
    key: 'money_independence', categoryKey: 'money', access: 'premium',
    title: { ru: 'Насколько тебе важна самостоятельность', en: 'How important financial independence is to you' },
    related: ['money_income_stability_freedom', 'money_shared', 'work_own_business'],
    fullAnswerIncludes: details(
      ['что хочешь решать сам', 'когда принимаешь помощь', 'что похоже на зависимость', 'как самостоятельность влияет на выбор'],
      ['what you want to decide yourself', 'when you accept help', 'what feels dependent', 'how independence shapes your choice'],
    ),
  },
  money_income_stability_freedom: {
    key: 'money_income_stability_freedom', categoryKey: 'money', access: 'premium',
    title: { ru: 'Что важнее: доход, стабильность или свобода', en: 'What matters more: income, stability, or freedom' },
    related: ['money_independence', 'money_risk', 'work_interest_killers'],
    fullAnswerIncludes: details(
      ['что выбираешь первым', 'какой обмен готов принять', 'когда доход перестаёт решать всё', 'что должно остаться под твоим контролем'],
      ['what you choose first', 'which tradeoff you accept', 'when income stops deciding everything', 'what must stay under your control'],
    ),
  },
  money_shared: {
    key: 'money_shared', categoryKey: 'money', access: 'premium',
    title: { ru: 'Как ты ведёшь общие деньги', en: 'How you handle shared money' },
    related: ['money_independence', 'money_big_decisions', 'communication_ask_for_help'],
    fullAnswerIncludes: details(
      ['о чём договариваешься заранее', 'что считаешь общим', 'где нужен отдельный бюджет', 'из-за чего начинается спор'],
      ['what you agree in advance', 'what you consider shared', 'where separate money helps', 'what starts an argument'],
    ),
  },
  money_status_things: {
    key: 'money_status_things', categoryKey: 'money', access: 'premium',
    title: { ru: 'Насколько тебе важны дорогие вещи и статус', en: 'How much expensive things and status matter to you' },
    related: ['money_unnoticed_spending', 'money_save_or_spend', 'money_income_stability_freedom'],
    fullAnswerIncludes: details(
      ['за что готов платить больше', 'что выглядит пустой тратой', 'когда качество важнее цены', 'какое впечатление покупки для тебя имеет значение'],
      ['what you pay more for', 'what looks like wasted money', 'when quality matters more than price', 'which impression of a purchase matters to you'],
    ),
  },
};

const CATEGORY_ANSWER_KEYS: Record<NatalReportCategoryKey, readonly NatalReportAnswerKey[]> = {
  main: ['main_how_people_see_you', 'main_not_seen_at_once'],
  character: [
    'character_decisions', 'character_change_mind', 'character_irritation', 'character_boredom',
    'character_stand_ground', 'character_plan_breaks', 'character_best_at', 'character_unusual_mix',
  ],
  love: [
    'love_people_you_like', 'love_show_interest', 'love_attachment_speed', 'love_turnoffs',
    'love_lose_interest', 'love_need_freedom', 'love_nonnegotiables',
    'love_relationship_you_want', 'love_right_person',
  ],
  communication: [
    'communication_new_people', 'communication_direct_or_unsaid', 'communication_texting',
    'communication_misunderstood', 'communication_criticism', 'communication_arguments',
    'communication_after_fight', 'communication_close_people', 'communication_ask_for_help',
  ],
  work: [
    'work_start_new', 'work_routine', 'work_team_or_solo', 'work_leadership', 'work_authority',
    'work_deadlines', 'work_interest_killers', 'work_own_business', 'work_clients', 'work_best_at',
  ],
  money: [
    'money_save_or_spend', 'money_big_decisions', 'money_risk', 'money_name_price',
    'money_unnoticed_spending', 'money_independence', 'money_income_stability_freedom',
    'money_shared', 'money_status_things',
  ],
};

export const NATAL_REPORT_CATEGORIES: readonly NatalReportCategoryDefinition[] = [
  { key: 'main', title: { ru: 'Главное', en: 'Main' }, answerKeys: CATEGORY_ANSWER_KEYS.main },
  { key: 'character', title: { ru: 'Характер', en: 'Character' }, answerKeys: CATEGORY_ANSWER_KEYS.character },
  { key: 'love', title: { ru: 'Любовь', en: 'Love' }, answerKeys: CATEGORY_ANSWER_KEYS.love },
  { key: 'communication', title: { ru: 'Общение', en: 'Communication' }, answerKeys: CATEGORY_ANSWER_KEYS.communication },
  { key: 'work', title: { ru: 'Работа', en: 'Work' }, answerKeys: CATEGORY_ANSWER_KEYS.work },
  { key: 'money', title: { ru: 'Деньги', en: 'Money' }, answerKeys: CATEGORY_ANSWER_KEYS.money },
];

export const NATAL_REPORT_ANSWER_COUNT = NATAL_REPORT_ANSWER_KEYS.length;

const ANSWER_KEY_SET = new Set<string>(NATAL_REPORT_ANSWER_KEYS);
const CATEGORY_KEY_SET = new Set<string>(NATAL_REPORT_CATEGORY_KEYS);
const MAIN_PREVIEW_KEY_SET = new Set<NatalReportAnswerKey>(NATAL_REPORT_MAIN_PREVIEW_KEYS);

export function isNatalReportAnswerKey(value: unknown): value is NatalReportAnswerKey {
  return typeof value === 'string' && ANSWER_KEY_SET.has(value);
}

export function isNatalReportCategoryKey(value: unknown): value is NatalReportCategoryKey {
  return typeof value === 'string' && CATEGORY_KEY_SET.has(value);
}

export function getNatalReportCategory(
  key: NatalReportCategoryKey,
): NatalReportCategoryDefinition | null {
  return NATAL_REPORT_CATEGORIES.find((category) => category.key === key) || null;
}

export function getNatalReportAnswer(
  key: NatalReportAnswerKey,
): NatalReportAnswerDefinition | null {
  return ANSWERS[key] || null;
}

export function isNatalReportAnswerFree(key: NatalReportAnswerKey): boolean {
  return ANSWERS[key]?.access === 'free';
}

export function localizeNatalReportText(
  value: LocalizedText,
  language: 'ru' | 'en',
): string {
  return value[language];
}

export function localizeNatalReportList(
  value: LocalizedList,
  language: 'ru' | 'en',
): string[] {
  return [...value[language]];
}

export function isNatalReportAnswer(value: unknown): value is NatalReportAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Partial<NatalReportAnswer>;
  const definition = isNatalReportAnswerKey(answer.answerKey)
    ? getNatalReportAnswer(answer.answerKey)
    : null;
  return answer.schemaVersion === 'natal-report-answer-v1'
    && answer.contractVersion === NATAL_REPORT_CATALOG_CONTRACT_VERSION
    && !!definition
    && answer.categoryKey === definition.categoryKey
    && answer.access === definition.access
    && typeof answer.title === 'string'
    && answer.title.length > 0
    && Array.isArray(answer.paragraphs)
    && answer.paragraphs.length >= 3
    && answer.paragraphs.length <= 5
    && answer.paragraphs.every((paragraph) => (
      !!paragraph
      && typeof paragraph.text === 'string'
      && paragraph.text.trim().length > 0
      && Array.isArray(paragraph.evidenceIds)
      && paragraph.evidenceIds.length > 0
      && paragraph.evidenceIds.every((id) => typeof id === 'string' && id.length > 0)
    ))
    && Array.isArray(answer.evidenceIds)
    && answer.evidenceIds.length > 0
    && Array.isArray(answer.related)
    && answer.related.every(isNatalReportAnswerKey)
    && Array.isArray(answer.fullAnswerIncludes)
    && answer.fullAnswerIncludes.length >= 4;
}

export function isNatalReportCategoryPack(value: unknown): value is NatalReportCategoryPack {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<NatalReportCategoryPack>;
  const category = isNatalReportCategoryKey(pack.categoryKey)
    ? getNatalReportCategory(pack.categoryKey)
    : null;
  if (
    pack.schemaVersion !== 'natal-report-category-v1'
    || pack.contractVersion !== NATAL_REPORT_CATALOG_CONTRACT_VERSION
    || !category
    || typeof pack.title !== 'string'
    || !Array.isArray(pack.summary)
    || !Array.isArray(pack.observations)
    || !Array.isArray(pack.previews)
    || !Array.isArray(pack.freeAnswers)
  ) return false;
  const expectedPreviewKeys: readonly NatalReportAnswerKey[] = category.key === 'main'
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  const expectedFree = category.answerKeys.filter(isNatalReportAnswerFree);
  return pack.previews.length === expectedPreviewKeys.length
    && new Set(pack.previews.map((preview) => preview.answerKey)).size === expectedPreviewKeys.length
    && expectedPreviewKeys.every((key) => pack.previews?.some((preview) => preview.answerKey === key))
    && pack.previews.every((preview) => {
      const definition = isNatalReportAnswerKey(preview.answerKey)
        ? getNatalReportAnswer(preview.answerKey)
        : null;
      return !!definition
        && (category.key === 'main'
          ? MAIN_PREVIEW_KEY_SET.has(definition.key)
          : definition.categoryKey === category.key)
        && preview.access === definition.access
        && typeof preview.title === 'string'
        && typeof preview.preview === 'string'
        && preview.preview.trim().length > 0
        && Array.isArray(preview.evidenceIds)
        && preview.evidenceIds.length > 0
        && Array.isArray(preview.related)
        && preview.related.every(isNatalReportAnswerKey)
        && Array.isArray(preview.fullAnswerIncludes)
        && preview.fullAnswerIncludes.length >= 4;
    })
    && pack.freeAnswers.length === expectedFree.length
    && expectedFree.every((key) => pack.freeAnswers?.some((answer) => answer.answerKey === key))
    && pack.freeAnswers.every(isNatalReportAnswer)
    && (category.key === 'main'
      ? pack.summary.length >= 3 && pack.summary.length <= 5 && pack.observations.length === 5
      : pack.summary.length === 0 && pack.observations.length === 0);
}
