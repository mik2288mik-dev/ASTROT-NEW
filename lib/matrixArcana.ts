/**
 * Матрица судьбы — библиотека 22 старших арканов (контент в нашей базе, без ИИ).
 * Короткие описания возможных предпочтений: без прогнозов, наставлений и диагнозов.
 */

export const MATRIX_TITLE = { ru: 'Матрица судьбы', en: 'Destiny Matrix' };
export const MATRIX_SUBTITLE = {
  ru: 'Расчёт по дате рождения — без времени и места',
  en: 'From your birth date — no time or place needed',
};
export const MATRIX_HOME_LABEL = { ru: 'Матрица судьбы — она только твоя', en: 'Destiny Matrix — yours alone' };
export const MATRIX_HOME_SUB = { ru: 'Бесплатно, по твоей дате рождения', en: 'Free, from your birth date' };

export type Arcana = {
  n: number;
  name: string;
  nameEn: string;
  keyword: string;
  keywordEn: string;
  essence: string;
  essenceEn: string;
};

export const ARCANA: Record<number, Arcana> = {
  1: { n: 1, name: 'Маг', nameEn: 'Magician', keyword: 'воля и действие', keywordEn: 'will & action',
    essence: "Начать новое дело тебе проще, чем долго обсуждать его. Когда появляется понятная идея, хочется попробовать её самостоятельно и увидеть, что получится.",
    essenceEn: "Trying a new idea can appeal to you more than discussing it for ages. You want to see what happens when you put it into practice." },
  2: { n: 2, name: 'Жрица', nameEn: 'High Priestess', keyword: 'интуиция и знание', keywordEn: 'intuition',
    essence: "Ты замечаешь мелочи и не торопишься высказывать первое впечатление. Прежде чем согласиться, тебе бывает интересно послушать, понаблюдать и задать ещё один вопрос.",
    essenceEn: "You notice small details and take time before sharing a first impression. Listening and asking another question can matter more to you than agreeing quickly." },
  3: { n: 3, name: 'Императрица', nameEn: 'Empress', keyword: 'забота и творчество', keywordEn: 'care & creation',
    essence: "Забота для тебя часто начинается с простого: приготовить что-то вкусное, выбрать подарок, сделать комнату уютнее. Тебе нравится, когда красота пригодна для обычной жизни.",
    essenceEn: "Care can start with something simple for you: cooking a meal, choosing a gift, or making a room comfortable. You enjoy beauty that belongs in everyday life." },
  4: { n: 4, name: 'Император', nameEn: 'Emperor', keyword: 'порядок и надёжность', keywordEn: 'structure',
    essence: "Тебе спокойнее, когда понятно, кто за что отвечает и когда закончится дело. Ты охотно берёшься организовать работу, особенно если можешь выбрать её порядок.",
    essenceEn: "You feel more comfortable when responsibilities and deadlines are clear. Organising a task can appeal to you, especially when you can choose how it is done." },
  5: { n: 5, name: 'Иерофант', nameEn: 'Hierophant', keyword: 'смысл и наставничество', keywordEn: 'meaning',
    essence: "Тебе интересно разобраться в предмете так, чтобы суметь объяснить его другому. Хороший ответ для тебя содержит понятную причину, а не только ссылку на чужой авторитет.",
    essenceEn: "You like understanding a subject well enough to explain it to someone else. A good answer gives you a clear reason, rather than just quoting an authority." },
  6: { n: 6, name: 'Влюблённые', nameEn: 'Lovers', keyword: 'выбор и отношения', keywordEn: 'choice & love',
    essence: "При выборе тебе важно собственное желание. Даже удобный вариант может не понравиться, если за тебя уже всё решили. В отношениях ты ценишь согласие, которое не приходится выпрашивать.",
    essenceEn: "Your own preference matters when you choose. Even a convenient option can lose its appeal when someone decides for you. You value agreement that does not have to be coaxed." },
  7: { n: 7, name: 'Колесница', nameEn: 'Chariot', keyword: 'движение к цели', keywordEn: 'drive',
    essence: "Тебя увлекает дело, в котором можно увидеть продвижение: закончить часть работы, проверить результат, взяться за следующую. Долгое ожидание без понятной причины быстро надоедает.",
    essenceEn: "You enjoy work where progress is visible: finishing one part, checking it, then starting the next. Waiting without a clear reason can quickly become tedious." },
  8: { n: 8, name: 'Справедливость', nameEn: 'Justice', keyword: 'честность и баланс', keywordEn: 'fairness',
    essence: "Ты замечаешь, когда к одинаковым поступкам относятся по-разному. Перед выводом тебе хочется услышать обе стороны. Договорённость важна, пока её соблюдают все участники.",
    essenceEn: "You notice when the same actions are treated differently. You prefer hearing both sides before deciding. An agreement matters when everyone involved follows it." },
  9: { n: 9, name: 'Отшельник', nameEn: 'Hermit', keyword: 'глубина и зрелость', keywordEn: 'depth',
    essence: "Некоторые вопросы тебе проще обдумать без чужих подсказок. Одиночное занятие не обязательно скучно: можно долго разбираться в интересной детали и не подстраиваться под чужой темп.",
    essenceEn: "Some questions are easier for you to consider without other people's suggestions. Working alone can be absorbing when you can examine an interesting detail at your own pace." },
  10: { n: 10, name: 'Колесо Фортуны', nameEn: 'Wheel of Fortune', keyword: 'перемены и шанс', keywordEn: 'change',
    essence: "Если привычный способ перестал работать, тебе бывает интересно попробовать другой. Новые обстоятельства дают повод пересмотреть решение, которое раньше казалось единственным.",
    essenceEn: "When a familiar approach stops working, you may enjoy trying another. New circumstances can help you reconsider a choice that once seemed like the only option." },
  11: { n: 11, name: 'Сила', nameEn: 'Strength', keyword: 'самообладание', keywordEn: 'inner strength',
    essence: "Ты можешь долго заниматься непростым делом, если видишь в нём смысл. Тебе не обязательно громко спорить, чтобы отказаться от чужого предложения или настоять на своём.",
    essenceEn: "You can stay with a difficult task when it matters to you. You do not need to argue loudly to decline an offer or stand by your decision." },
  12: { n: 12, name: 'Повешенный', nameEn: 'Hanged Man', keyword: 'иной взгляд', keywordEn: 'new angle',
    essence: "Ты умеешь задержаться на вопросе, на который остальные уже ответили. Иногда другая точка зрения находится благодаря простой паузе: появляется время заметить пропущенную подробность.",
    essenceEn: "You can stay with a question that others have already answered. A pause sometimes gives you time to notice a detail that changes how you see it." },
  13: { n: 13, name: 'Смерть', nameEn: 'Death', keyword: 'обновление', keywordEn: 'renewal',
    essence: "Ты можешь отказаться от привычного занятия, если оно больше тебя не интересует. Закончить один этап для тебя иногда проще, чем бесконечно чинить то, что давно хочется поменять.",
    essenceEn: "You can leave a familiar activity when it no longer interests you. Sometimes finishing a chapter feels easier than endlessly repairing something you want to change." },
  14: { n: 14, name: 'Умеренность', nameEn: 'Temperance', keyword: 'мера и гармония', keywordEn: 'balance',
    essence: "Тебе подходит постепенная работа: попробовать немного, посмотреть на результат и поправить. В споре ты нередко ищешь вариант, который можно обсудить без соревнования в громкости.",
    essenceEn: "You may prefer working gradually: trying a little, reviewing the result, and adjusting it. In a disagreement, you look for an option that can be discussed without shouting." },
  15: { n: 15, name: 'Дьявол', nameEn: 'Devil', keyword: 'желания и удовольствие', keywordEn: 'desire & enjoyment',
    essence: "Ты хорошо замечаешь, чего хочешь: приятных вещей, удобства, внимания, удовольствия. Чем конкретнее желание, тем проще понять, стоит ли оно времени и денег, которые на него уйдут.",
    essenceEn: "You notice what you want: comfort, attention, enjoyment, or things you like. A specific desire makes it easier to decide whether it is worth the time and money." },
  16: { n: 16, name: 'Башня', nameEn: 'Tower', keyword: 'прорыв и правда', keywordEn: 'breakthrough',
    essence: "Если объяснение не сходится с тем, что ты видишь, тебе трудно сделать вид, что всё нормально. Иногда ты предпочитаешь переделать основу дела, а не ещё раз исправлять одну и ту же ошибку.",
    essenceEn: "When an explanation does not match what you see, it is hard for you to ignore the difference. You may prefer changing the approach to repeatedly fixing the same mistake." },
  17: { n: 17, name: 'Звезда', nameEn: 'Star', keyword: 'надежда и талант', keywordEn: 'hope & talent',
    essence: "Тебе нравится представлять, что ещё можно придумать или сделать. Чужая хорошая идея может увлечь тебя так же, как собственная. Особенно приятно увидеть первый результат того, что раньше существовало только в голове.",
    essenceEn: "You enjoy imagining what else could be made or tried. Someone else's good idea can interest you as much as your own. Seeing an imagined idea take shape is especially satisfying." },
  18: { n: 18, name: 'Луна', nameEn: 'Moon', keyword: 'чувства и воображение', keywordEn: 'feeling & imagination',
    essence: "Ты легко представляешь несколько объяснений одной ситуации. Это помогает сочинять и придумывать, но в обычном разговоре догадку иногда хочется проверить прямым вопросом.",
    essenceEn: "You can imagine several explanations for the same situation. That helps with creating and inventing; in an ordinary conversation, you may want to check a guess by asking directly." },
  19: { n: 19, name: 'Солнце', nameEn: 'Sun', keyword: 'радость и ясность', keywordEn: 'joy & clarity',
    essence: "Тебе нравится делиться хорошей новостью, интересной находкой или удачной шуткой. Радость становится заметнее, когда её есть с кем разделить. Открытый отклик тебе обычно приятнее сдержанной похвалы.",
    essenceEn: "You enjoy sharing good news, an interesting find, or a good joke. Enjoyment becomes more noticeable when someone shares it. An open response can mean more than restrained praise." },
  20: { n: 20, name: 'Суд', nameEn: 'Judgement', keyword: 'опыт и переоценка', keywordEn: 'experience & reconsideration',
    essence: "Ты можешь вернуться к старому решению и честно признать, что теперь думаешь иначе. Прошлый опыт тебе интересен, когда помогает понять конкретную ошибку или выбрать другой способ действия.",
    essenceEn: "You can revisit an old decision and admit that you now think differently. Past experience interests you when it explains a mistake or suggests a different way to act." },
  21: { n: 21, name: 'Мир', nameEn: 'World', keyword: 'целостность и масштаб', keywordEn: 'wholeness',
    essence: "Тебе приятно довести дело до состояния, когда им уже можно пользоваться. Ты замечаешь, как отдельные части соединяются, и можешь найти недостающую деталь в почти готовой работе.",
    essenceEn: "You enjoy bringing work to a point where it can actually be used. You notice how the parts fit together and can spot what is missing from an almost finished project." },
  22: { n: 22, name: 'Шут', nameEn: 'Fool', keyword: 'свобода и начало', keywordEn: 'freedom & new start',
    essence: "Новое место, занятие или знакомство может заинтересовать тебя ещё до того, как появился подробный план. Тебе нравится оставлять возможность передумать и попробовать что-то другое.",
    essenceEn: "A new place, activity, or acquaintance can interest you before you have a detailed plan. You enjoy keeping the option to change your mind and try something else." },
};

export function getArcana(n: number): Arcana {
  return ARCANA[n] || ARCANA[22];
}
