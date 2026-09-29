import { getNeboCoreVoice, NEBO_CORE_VOICE_VERSION } from './voice/core';
import { hasCoreVoiceCliche, hasCoreVoiceMysticism, hasCoreVoiceViolation } from './voice/validators';
/**
 * The shared runtime voice for user-facing AI content.
 * Product-specific layers may sharpen it without changing the global tone.
 */

export const APP_VOICE_VERSION = NEBO_CORE_VOICE_VERSION;
export const PERSONAL_FORECAST_VOICE_VERSION = '16';

export function getAppSystemVoice(language: 'ru' | 'en' = 'ru'): string {
  return getNeboCoreVoice(language);
}

const PERSONAL_FORECAST_VOICE_VIOLATION_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:космос\p{L}*|аур\p{L}*|судьб\p{L}*|знак\p{L}*\s+свыше)(?!\p{L})/iu,
  /(?:^|[^\p{L}])зв[её]зд\p{L}*\s+(?:обещают|говорят|подсказывают|советуют|предсказывают)(?!\p{L})/iu,
  /(?:твоя|ваша)\s+карт[аы]\s+(?:показывает|говорит|подсказывает)|по\s+(?:твоей|вашей)\s+карт[еы]/iu,
  /это\s+читается\s+через|может\s+проявляться|здесь\s+описывается|тема\s+связана\s+с|что\s+из\s+этого\s+активно\s+сейчас/iu,
  /(?:личн\p{L}*|внутренн\p{L}*|чуж\p{L}*)\s+границ\p{L}*|(?:отстаива|выстраива|обознача|защища)\p{L}*\s+границ\p{L}*/iu,
  /внутренн\p{L}*\s+(?:состояни|опор|ясност|устойчивост|ресурс|баланс)\p{L}*|самоощущени\p{L}*|самооценк\p{L}*|осознанност\p{L}*/iu,
  /(?:ищи|найди|сохраняй)\s+опор\p{L}*\s+внутри\s+себя|твоя\s+сила\s*[—–-]?\s*в\s+спокойн\p{L}*\s+присутстви\p{L}*/iu,
  /эмоциональн\p{L}*\s+(?:фон|состояни|ресурс|стабильност)\p{L}*|чувствительност\p{L}*\s+к\s+давлени\p{L}*|(?:твоя|ваша)\s+реакци\p{L}*|самочувстви\p{L}*/iu,
  /(?:бережн\p{L}*|ресурсн\p{L}*)\s+режим\p{L}*|забот\p{L}*\s+о\s+себе|слуша\p{L}*\s+тел\p{L}*|тел\p{L}*\s+(?:просит|подсказывает|сигналит)|организм\p{L}*\s+(?:заставит|сделает|остановит)/iu,
  /(?:сбав|сниз)\p{L}*\s+(?:темп|оборот)\p{L}*|спокойн\p{L}*\s+темп\p{L}*|жить\s+не\s+в\s+сво\p{L}*\s+ритм\p{L}*/iu,
  /(?:^|[^\p{L}])(?:(?:пора|нужно|стоит)\s+остановиться\s*[.!?]?$|нажать|нажимай|нажми|жми|остановись|останавливайся|выдох\p{L}*|прислушайся|не\s+распыляйся|не\s+распыляться)(?!\p{L})/iu,
  /(?:рабоч\p{L}*\s+)?(?:стратеги|траектори|систем)\p{L}*|порядок\s+действий|расстав\p{L}*\s+приоритет\p{L}*|фокус\p{L}*\s+на\s+главн\p{L}*/iu,
  /(?:эффективност|продуктивност|оптимизаци|вектор|проявленност|заземлен|экологичн)\p{L}*|зон\p{L}*\s+рост\p{L}*|(?:держи|сохраняй)\s+фокус|сфокусируйся|распредели\s+силы/iu,
  /на\s+первый\s+план\s+(?:выйд|выход)\p{L}*|текущ\p{L}*\s+дел\p{L}*|практическ\p{L}*\s+(?:мелоч|задач|вопрос)\p{L}*|следующ\p{L}*\s+шаг\p{L}*|зафиксир\p{L}*/iu,
  /согласован\p{L}*|(?:оформлен\p{L}*\s+)?статус\p{L}*|перевед\p{L}*\s+в\s+[^.!?]{0,30}статус\p{L}*|лишн\p{L}*\s+сомнени\p{L}*/iu,
  /(?:укреп|улучш|повыс)\p{L}*\s+(?:личн\p{L}*\s+)?результат\p{L}*|следующ\p{L}*\s+решени\p{L}*|пространств\p{L}*\s+для\s+(?:рост|решени|себя|чувств)\p{L}*/iu,
  /период\s+(?:станет|будет)\s+проверк\p{L}*|период\s+завершит\p{L}*\s+ощущени\p{L}*|верн\p{L}*\s+устойчивост\p{L}*|добав\p{L}*\s+уверенност\p{L}*/iu,
  /это\s+не\s+про\s+|пора\s+научит\p{L}*|ты\s+(?:снова|постоянно|привык\p{L}*)|хватит\s+(?:ныть|жалеть|винить|прятаться|оправдываться)/iu,
  /режим\s+жертв\p{L}*|саможалост\p{L}*|жалост\p{L}*\s+к\s+себе|моральн\p{L}*\s+калек\p{L}*|эмоциональн\p{L}*\s+паразит\p{L}*/iu,
  /твоя\s+реальн\p{L}*\s+стоимост\p{L}*|(?:ты|тебя|твой\p{L}*)[^.!?]{0,45}(?:идиот\p{L}*|дурак\p{L}*|бездар\p{L}*|ничтож\p{L}*|жалк\p{L}*)/iu,
  /(?:психолог\p{L}*|психотерап\p{L}*|коуч\p{L}*|травм\p{L}*|паттерн\p{L}*|триггер\p{L}*|проработк\p{L}*|личностн\p{L}*\s+рост\p{L}*)/iu,
  /\b(?:inner\s+(?:state|clarity|support|balance|resource)|personal\s+boundaries|protect\s+your\s+energy|self[- ]care|growth\s+mindset|emotional\s+resilience|workable\s+system|action\s+plan|your\s+strength\s+is\s+in\s+calm\s+presence|find\s+support\s+within\s+yourself)\b/iu,
  /\b(?:aura|fate|sign\s+from\s+above|the\s+stars\s+(?:promise|say|suggest|predict)|your\s+chart\s+(?:shows|says|suggests)|according\s+to\s+your\s+chart|this\s+may\s+manifest|the\s+theme\s+is\s+connected\s+to)\b/iu,
];

const PERSONAL_FORECAST_MACHINE_LANGUAGE_PATTERN = /(?:^|[^\p{L}])(?:процесс\p{L}*|формат\p{L}*|вклад\p{L}*|реализац\p{L}*|взаимодействи\p{L}*|инициатив\p{L}*|активност\p{L}*|обсуждени\p{L}*|оформлени\p{L}*|согласован\p{L}*|формулировк\p{L}*|уточнени\p{L}*|фиксир\p{L}*|участник\p{L}*|разночтени\p{L}*|первоначальн\p{L}*|предварительн\p{L}*|окончательн\p{L}*|облегчени\p{L}*|объ[её]м\p{L}*|дополнительн\p{L}*\s+объ[её]м\p{L}*|вариант\p{L}*\s+действи\p{L}*|потребу\p{L}*\s+внимани\p{L}*|более\s+удобн\p{L}*\s+(?:вариант\p{L}*|способ\p{L}*)|договор[её]нност\p{L}*\s+(?:закреп|фиксир)\p{L}*|(?:обычн\p{L}*|важн\p{L}*|денежн\p{L}*|текущ\p{L}*|привычн\p{L}*)\s+(?:дел\p{L}*|вопрос\p{L}*|план\p{L}*|ситуаци\p{L}*)|нужн\p{L}*\s+вещ\p{L}*|появ\p{L}*\s+возможност\p{L}*|причин\p{L}*\s+для\s+дальнейш\p{L}*|дальнейш\p{L}*\s+(?:перенос\p{L}*|задерж\p{L}*|путаниц\p{L}*)|не\s+красив\p{L}*\s+и\s+сразу|закры\p{L}*\s+(?:стар\p{L}*\s+)?(?:бытов\p{L}*\s+)?расход\p{L}*|вопрос\p{L}*\s+закро\p{L}*|апгрейд\p{L}*|дедлайн\p{L}*|кейс\p{L}*|фидбек\p{L}*|инсайт\p{L}*|майндсет\p{L}*|ресет\p{L}*|чекн\p{L}*|текущ\p{L}*\s+(?:договор[её]нност\p{L}*|вопрос\p{L}*|процесс\p{L}*)|перевед\p{L}*\s+(?:дел\p{L}*|вопрос\p{L}*|запис\p{L}*|разговор\p{L}*)\s+(?:к|в)\s+[^.!?]{0,30}(?:решени\p{L}*|статус\p{L}*)|результат\p{L}*\s+[^.!?]{0,12}продолж\p{L}*|(?:человек|люди)\s+или\s+команд\p{L}*|команд\p{L}*\s+рядом|общ\p{L}*\s+папк\p{L}*\s+материал\p{L}*|вопрос\p{L}*\s+[^.!?]{0,14}(?:примут|принят\p{L}*)|довед\p{L}*\s+[^.!?]{0,28}до\s+результат\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_REPORT_NOUN_PATTERN = /(?:^|[^\p{L}])(?:процесс\p{L}*|формат\p{L}*|вклад\p{L}*|реализац\p{L}*|взаимодействи\p{L}*|инициатив\p{L}*|активност\p{L}*|обсуждени\p{L}*|оформлени\p{L}*|согласован\p{L}*|формулировк\p{L}*|уточнени\p{L}*|фиксир\p{L}*|участник\p{L}*|разночтени\p{L}*|объ[её]м\p{L}*)(?!\p{L})/iu;
const PERSONAL_FORECAST_BOOKISH_WORD_PATTERN = /(?:^|[^\p{L}])(?:первоначальн\p{L}*|предварительн\p{L}*|окончательн\p{L}*|облегчени\p{L}*|дальнейш\p{L}*)(?!\p{L})/iu;
const PERSONAL_FORECAST_VAGUE_PLACEHOLDER_PATTERN = /(?:^|[^\p{L}])(?:(?:обычн\p{L}*|важн\p{L}*|денежн\p{L}*|текущ\p{L}*|привычн\p{L}*)\s+(?:дел\p{L}*|вопрос\p{L}*|план\p{L}*|ситуаци\p{L}*)|(?:главн\p{L}*|нов\p{L}*|запланированн\p{L}*)\s+дел\p{L}*|ясн\p{L}*\s+услови\p{L}*|нужн\p{L}*\s+вещ\p{L}*|появ\p{L}*\s+возможност\p{L}*|вариант\p{L}*\s+действи\p{L}*|потребу\p{L}*\s+внимани\p{L}*|более\s+удобн\p{L}*\s+(?:вариант\p{L}*|способ\p{L}*)|городск\p{L}*\s+вариант\p{L}*)(?!\p{L})/iu;
const PERSONAL_FORECAST_BAD_COLLOCATION_PATTERN = /(?:^|[^\p{L}])(?:договор[её]нност\p{L}*\s+(?:закреп|фиксир)\p{L}*|договор[её]нност\p{L}*\s+о\s+(?:разговор\p{L}*|встреч\p{L}*|поездк\p{L}*|покупк\p{L}*|цен\p{L}*|выезд\p{L}*)|из-за\s+нов\p{L}*\s+обстоятельств\p{L}*|причин\p{L}*\s+для\s+дальнейш\p{L}*|не\s*красив\p{L}*\s+и\s+сразу|закры\p{L}*\s+(?:стар\p{L}*\s+)?(?:бытов\p{L}*\s+)?расход\p{L}*|вопрос\p{L}*\s+закро\p{L}*|перевед\p{L}*\s+(?:дел\p{L}*|вопрос\p{L}*|запис\p{L}*|разговор\p{L}*)\s+(?:к|в)\s+[^.!?]{0,30}(?:решени\p{L}*|статус\p{L}*)|результат\p{L}*\s+[^.!?]{0,12}продолж\p{L}*|(?:человек|люди)\s+или\s+команд\p{L}*|команд\p{L}*\s+рядом|общ\p{L}*\s+папк\p{L}*\s+материал\p{L}*|вопрос\p{L}*\s+[^.!?]{0,14}(?:примут|принят\p{L}*)|довед\p{L}*\s+[^.!?]{0,28}до\s+результат\p{L}*)(?!\p{L})/iu;
const PERSONAL_FORECAST_FAKE_SLANG_PATTERN = /(?:^|[^\p{L}])(?:апгрейд\p{L}*|дедлайн\p{L}*|кейс\p{L}*|фидбек\p{L}*|инсайт\p{L}*|майндсет\p{L}*|ресет\p{L}*|чекн\p{L}*)(?!\p{L})/iu;

/**
 * Grammatically correct phrases can still sound like a notice, bank statement,
 * or route planner. These constructions came from real provider drafts and are
 * deliberately narrower than a general vocabulary blacklist.
 */
const PERSONAL_FORECAST_FORMAL_EVENT_PATTERN = /(?:^|[^\p{L}])(?:при\s+подготовк\p{L}*\s+к|в\s+назначенн\p{L}*\s+(?:время|дат\p{L}*|час\p{L}*)|запланированн\p{L}*\s+(?:встреч\p{L}*|разговор\p{L}*|поездк\p{L}*|звонок\p{L}*|дел\p{L}*)|вместо\s+прежн\p{L}*|входящ\p{L}*\s+перевод\p{L}*|пункт\p{L}*\s+пересадк\p{L}*|на\s+экран\p{L}*\s+маршрут\p{L}*|расход\p{L}*\s+[^.!?]{0,24}(?:будут|оказал\p{L}*)\s+закрыт\p{L}*|законч\p{L}*\s+договор[её]нност\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_IMPERSONAL_DISCOVERY_PATTERN = /(?:^|[^\p{L}])(?:(?:может|могут|вероятно|скорее\s+всего)\s+)?обнаруж(?:иться|ится|атся|илось|илась|ился|ились)(?!\p{L})/iu;

const PERSONAL_FORECAST_FORMAL_CONNECTOR_PATTERN = /(?:^|[^\p{L}])(?:(?:получ|обрет)\p{L}*\s+(?:дальнейш\p{L}*\s+)?продолжени\p{L}*|стан\p{L}*\s+основани\p{L}*\s+для)(?!\p{L})/iu;

const PERSONAL_FORECAST_EDITED_PROSE_PATTERN = /(?:^|[^\p{L}])(?:перейд\p{L}*\s+к\s+конкретик\p{L}*|верн\p{L}*\s+(?:бесед\p{L}*|разговор\p{L}*)\s+к\s+сути|нужн\p{L}*\s+ответ\p{L}*\s+прозвуч\p{L}*|появ\p{L}*\s+конкретн\p{L}*\s+договор[её]нност\p{L}*|честн\p{L}*\s+результат\p{L}*|готов\p{L}*\s+работ\p{L}*\s+сам\p{L}*\s+объясн\p{L}*|недосказанност\p{L}*\s+выйд\p{L}*\s+наружу|догадк\p{L}*\s+потеря\p{L}*\s+смысл|поддержива\p{L}*\s+прежн\p{L}*\s+видимост\p{L}*|за\s+кажд\p{L}*\s+будет\s+стоя\p{L}*\s+настоящ\p{L}*\s+дел\p{L}*|коротк\p{L}*\s+отказ\p{L}*\s+[^.!?]{0,20}спас\p{L}*\s+недел\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_BANK_NOTICE_PATTERN = /(?:^|[^\p{L}])(?:истори\p{L}*\s+операци\p{L}*|(?:входящ\p{L}*\s+)?операци\p{L}*\s+по\s+сч[её]т\p{L}*|появ\p{L}*\s+(?:две|три|\d+)\s+строк\p{L}*|расход\p{L}*(?:\s+(?:дня|недели|месяца))?\s+(?:закро\p{L}*|покро\p{L}*))(?!\p{L})/iu;

const PERSONAL_FORECAST_WRITTEN_TIME_PATTERN = /(?:^|[^\p{L}])(?:намеченн\p{L}*\s+(?:встреч\p{L}*|поездк\p{L}*|разговор\p{L}*|дел\p{L}*)|освободивш\p{L}*\s+врем\p{L}*|отправ\p{L}*\s+ещ[её]\s+засветло)(?!\p{L})/iu;

const PERSONAL_FORECAST_IMPOSSIBLE_COLLOCATION_PATTERN = /(?:^|[^\p{L}])(?:ехать\s+окаж\p{L}*|дорожн\p{L}*\s+возн\p{L}*\s+[^.!?]{0,24}сэконом\p{L}*\s+врем\p{L}*|обстановк\p{L}*\s+[^.!?]{0,18}собер\p{L}*\s+вокруг|свободн\p{L}*\s+мест\p{L}*\s+[^.!?]{0,18}не\s+просто\p{L}*|(?:его|её|их)\s+получится\s+пройти\s+проще|спокойн\p{L}*\s+пройт\p{L}*\s+по\s+вопрос\p{L}*|ответ\p{L}*\s+на\s+предложенн\p{L}*\s+способ\p{L}*|реш\p{L}*\s+вопрос\p{L}*\s+о\s+покупк\p{L}*\s+одн\p{L}*\s+ответ\p{L}*|пересчит\p{L}*\s+сумм\p{L}*\s+за\s+[^.!?]{0,24}покупк\p{L}*|покупк\p{L}*\s+не\s+измен\p{L}*|обычн\p{L}*\s+встреч\p{L}*\s+[^.!?]{0,24}продолж\p{L}*\s+[^.!?]{0,20}поездк\p{L}*|сумм\p{L}*[^.!?]{0,80}[.!?]\s+она\s+окаж\p{L}*\s+удобн\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_ABSTRACT_INTEREST_PATTERN = /(?:^|[^\p{L}])(?:(?:выраст|повыс)\p{L}*\s+интерес\p{L}*\s+к|интерес\p{L}*\s+к\s+[^.!?]{0,28}(?:выраст|повыс)\p{L}*|вариант\p{L}*\s+времени\s+для\s+разговор\p{L}*|совместн\p{L}*\s+договор[её]нност\p{L}*|иде\p{L}*\s+[^.!?]{0,24}(?:перейд|преврат)\p{L}*\s+в\s+[^.!?]{0,18}договор[её]нност\p{L}*|присоедин\p{L}*\s+к\s+уже\s+начат\p{L}*\s+дел\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_WRITTEN_EVENT_PATTERN = /(?:^|[^\p{L}])(?:на\s+телефон\p{L}*\s+[^.!?]{0,22}прийти\s+[^.!?]{0,12}сообщени\p{L}*|обмен\p{L}*\s+детал\p{L}*|переписк\p{L}*\s+[^.!?]{0,24}привед\p{L}*\s+к\s+[^.!?]{0,18}встреч\p{L}*|приятн\p{L}*\s+встреч\p{L}*\s+вне\s+дома|работ\p{L}*\s+с\s+капающ\p{L}*\s+кран\p{L}*|мастер\p{L}*\s+верн\p{L}*\s+в\s+ванн\p{L}*|за\s+предел\p{L}*\s+привычн\p{L}*\s+круг\p{L}*|расшир\p{L}*\s+круг\p{L}*\s+заказчик\p{L}*|в\s+обсуждени\p{L}*\s+появ\p{L}*\s+(?:нов\p{L}*\s+)?(?:цифр\p{L}*|сумм\p{L}*)|человек\p{L}*\s+с\s+друг\p{L}*\s+сторон\p{L}*|появ\p{L}*\s+предложени\p{L}*\s+встрет\p{L}*\s+нескольк\p{L}*\s+люд\p{L}*|неприятн\p{L}*\s+добав\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_FORCED_IMAGE_PATTERN = /(?:^|[^\p{L}])(?:дорожн\p{L}*\s+интриг\p{L}*|маленьк\p{L}*\s+водян\p{L}*\s+драм\p{L}*|пересадк\p{L}*\s+сбеж\p{L}*|календар\p{L}*\s+переигра\p{L}*|маршрут\p{L}*\s+сда\p{L}*|встреч\p{L}*\s+(?:передум\p{L}*|сбеж\p{L}*)|чек\p{L}*\s+[^.!?]{0,18}приятн\p{L}*|деньг\p{L}*\s+разобь\p{L}*\s+надвое|договор[её]нност\p{L}*\s+(?:вышл\p{L}*|пришл\p{L}*)\s+на\s+сцен\p{L}*)(?!\p{L})/iu;

const PERSONAL_FORECAST_EMOTION_COMMAND_PATTERN = /(?:^|[^\p{L}])(?:не\s+(?:нервничай|переживай|волнуйся|накручивай\s+себя)|успокойся|расслабься)(?!\p{L})/iu;
const PERSONAL_FORECAST_GENERIC_ADVICE_PATTERN = /(?:^|[^\p{L}])потрат\p{L}*\s+[^.!?]{0,24}\s+с\s+польз\p{L}*(?!\p{L})/iu;

const PERSONAL_FORECAST_VOICE_DIAGNOSTICS: ReadonlyArray<{
  code: string;
  pattern: RegExp;
}> = [
  { code: 'REPORT_NEXT_STEP', pattern: /следующ\p{L}*\s+шаг\p{L}*/iu },
  { code: 'REPORT_FOREGROUND', pattern: /на\s+первый\s+план\s+(?:выйд|выход)\p{L}*/iu },
  { code: 'REPORT_CURRENT_MATTER', pattern: /текущ\p{L}*\s+дел\p{L}*/iu },
  { code: 'REPORT_PRACTICAL_NOUN', pattern: /практическ\p{L}*\s+(?:мелоч|задач|вопрос)\p{L}*/iu },
  { code: 'REPORT_FIXATE', pattern: /зафиксир\p{L}*/iu },
  { code: 'REPORT_APPROVAL', pattern: /согласован\p{L}*/iu },
  { code: 'REPORT_STATUS', pattern: /(?:оформлен\p{L}*\s+)?статус\p{L}*|перевед\p{L}*\s+в\s+[^.!?]{0,30}статус\p{L}*/iu },
  { code: 'COACHING_DOUBT', pattern: /лишн\p{L}*\s+сомнени\p{L}*/iu },
  { code: 'REPORT_ABSTRACT_NOUN', pattern: PERSONAL_FORECAST_REPORT_NOUN_PATTERN },
  { code: 'REPORT_BOOKISH_WORD', pattern: PERSONAL_FORECAST_BOOKISH_WORD_PATTERN },
  { code: 'REPORT_VAGUE_PLACEHOLDER', pattern: PERSONAL_FORECAST_VAGUE_PLACEHOLDER_PATTERN },
  { code: 'REPORT_BAD_COLLOCATION', pattern: PERSONAL_FORECAST_BAD_COLLOCATION_PATTERN },
  { code: 'REPORT_FAKE_SLANG', pattern: PERSONAL_FORECAST_FAKE_SLANG_PATTERN },
  { code: 'REPORT_FORMAL_EVENT', pattern: PERSONAL_FORECAST_FORMAL_EVENT_PATTERN },
  { code: 'REPORT_IMPERSONAL_DISCOVERY', pattern: PERSONAL_FORECAST_IMPERSONAL_DISCOVERY_PATTERN },
  { code: 'REPORT_FORMAL_CONNECTOR', pattern: PERSONAL_FORECAST_FORMAL_CONNECTOR_PATTERN },
  { code: 'REPORT_EDITED_PROSE', pattern: PERSONAL_FORECAST_EDITED_PROSE_PATTERN },
  { code: 'REPORT_BANK_NOTICE', pattern: PERSONAL_FORECAST_BANK_NOTICE_PATTERN },
  { code: 'REPORT_WRITTEN_TIME', pattern: PERSONAL_FORECAST_WRITTEN_TIME_PATTERN },
  { code: 'REPORT_IMPOSSIBLE_COLLOCATION', pattern: PERSONAL_FORECAST_IMPOSSIBLE_COLLOCATION_PATTERN },
  { code: 'REPORT_ABSTRACT_INTEREST', pattern: PERSONAL_FORECAST_ABSTRACT_INTEREST_PATTERN },
  { code: 'REPORT_WRITTEN_EVENT', pattern: PERSONAL_FORECAST_WRITTEN_EVENT_PATTERN },
  { code: 'REPORT_FORCED_IMAGE', pattern: PERSONAL_FORECAST_FORCED_IMAGE_PATTERN },
  { code: 'REPORT_MACHINE_LANGUAGE', pattern: PERSONAL_FORECAST_MACHINE_LANGUAGE_PATTERN },
  { code: 'COACHING_EMOTION_COMMAND', pattern: PERSONAL_FORECAST_EMOTION_COMMAND_PATTERN },
  { code: 'COACHING_GENERIC_ADVICE', pattern: PERSONAL_FORECAST_GENERIC_ADVICE_PATTERN },
];

export function hasAppVoiceMysticism(text: string): boolean {
  return hasCoreVoiceMysticism(text);
}

export function hasAppVoiceCliche(text: string): boolean {
  return hasCoreVoiceCliche(text);
}

export function hasAppVoiceViolation(text: string): boolean {
  return hasCoreVoiceViolation(text);
}

export function hasPersonalForecastVoiceViolation(text: string): boolean {
  return getPersonalForecastVoiceViolationCodes(text).length > 0;
}

export function hasPersonalForecastMachineLanguageViolation(text: string): boolean {
  // The hidden brief is source material, not user-facing copy. Reject only
  // wording that cannot be translated safely; the full spoken-Russian filter
  // still runs against title, forecast, and closing below.
  return PERSONAL_FORECAST_BAD_COLLOCATION_PATTERN.test(text)
    || PERSONAL_FORECAST_REPORT_NOUN_PATTERN.test(text)
    || PERSONAL_FORECAST_FAKE_SLANG_PATTERN.test(text)
    || PERSONAL_FORECAST_FORMAL_CONNECTOR_PATTERN.test(text)
    || /(?:следующ\p{L}*\s+шаг\p{L}*|на\s+первый\s+план\s+(?:выйд|выход)\p{L}*|текущ\p{L}*\s+дел\p{L}*)/iu.test(text);
}

export function getPersonalForecastVoiceViolationCodes(text: string): string[] {
  return [
    ...(hasAppVoiceMysticism(text) ? ['APP_MYSTICISM'] : []),
    ...(hasAppVoiceCliche(text) ? ['APP_CLICHE'] : []),
    ...PERSONAL_FORECAST_VOICE_VIOLATION_PATTERNS.flatMap((pattern, index) => (
      pattern.test(text) ? [`PERSONAL_${index + 1}`] : []
    )),
    ...PERSONAL_FORECAST_VOICE_DIAGNOSTICS.flatMap(({ code, pattern }) => (
      pattern.test(text) ? [code] : []
    )),
  ];
}

export function withAppVoiceVersion(baseVersion: string): string {
  return `${baseVersion}+voice.${APP_VOICE_VERSION}`;
}

export function withPersonalForecastVoiceVersion(baseVersion: string): string {
  return `${baseVersion}+forecast-voice.${PERSONAL_FORECAST_VOICE_VERSION}`;
}

export function withAppVoiceCacheKey(baseKey: string): string {
  return `${baseKey}:voice:${APP_VOICE_VERSION}`;
}
