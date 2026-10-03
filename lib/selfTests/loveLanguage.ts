import type { SelfTestDefinition } from './types';

/** Five ways people feel loved: words, time, gifts, help, touch. */
export const LOVE_LANGUAGE_TEST: SelfTestDefinition = {
  id: 'love_language',
  title: { ru: 'Твой язык любви', en: 'Your love language' },
  subtitle: { ru: 'Что для тебя по-настоящему значит «меня любят»', en: 'What "I am loved" really means to you' },
  minutes: 3,
  questions: [
    {
      id: 'l1',
      text: { ru: 'Близкий человек хочет тебя порадовать. Что сработает лучше всего?', en: 'Someone close wants to make you happy. What works best?' },
      options: [
        { text: { ru: 'Сказать, как гордится мной', en: 'Telling me how proud they are of me' }, to: ['words'] },
        { text: { ru: 'Провести со мной целый день без телефона', en: 'Spending a whole day with me, no phone' }, to: ['time'] },
        { text: { ru: 'Принести то, что мне когда-то понравилось в витрине', en: 'Bringing something I once mentioned in passing' }, to: ['gifts'] },
        { text: { ru: 'Взять на себя дело, которое меня давно тяготит', en: 'Taking over a chore that has been weighing on me' }, to: ['acts'] },
        { text: { ru: 'Просто обнять и не отпускать', en: 'Just hugging me and not letting go' }, to: ['touch'] },
      ],
    },
    {
      id: 'l2',
      text: { ru: 'Что обиднее всего?', en: 'What hurts the most?' },
      options: [
        { text: { ru: 'Резкие слова и критика', en: 'Harsh words and criticism' }, to: ['words'] },
        { text: { ru: 'Когда рядом, но всё время в телефоне', en: 'When they are near but always on the phone' }, to: ['time'] },
        { text: { ru: 'Забытый день рождения', en: 'A forgotten birthday' }, to: ['gifts'] },
        { text: { ru: 'Обещание помочь — и тишина', en: 'Promised to help — and did not' }, to: ['acts'] },
        { text: { ru: 'Холодность: ни обнять, ни взять за руку', en: 'Coldness: no hugs, no holding hands' }, to: ['touch'] },
      ],
    },
    {
      id: 'l3',
      text: { ru: 'Идеальный вечер вдвоём — это…', en: 'A perfect evening for two is…' },
      options: [
        { text: { ru: 'Долгий разговор обо всём на свете', en: 'A long talk about everything' }, to: ['words', 'time'] },
        { text: { ru: 'Прогулка без цели, только вы двое', en: 'An aimless walk, just the two of you' }, to: ['time'] },
        { text: { ru: 'Маленький сюрприз, приготовленный заранее', en: 'A small surprise prepared in advance' }, to: ['gifts'] },
        { text: { ru: 'Ужин и посуда — сегодня не на мне', en: 'They cooked dinner and did the dishes' }, to: ['acts'] },
        { text: { ru: 'Фильм в обнимку под одним пледом', en: 'A film cuddled under one blanket' }, to: ['touch'] },
      ],
    },
    {
      id: 'l4',
      text: { ru: 'Как ты обычно показываешь любовь?', en: 'How do you most often show love?' },
      options: [
        { text: { ru: 'Говорю тёплые слова и пишу длинные сообщения', en: 'Say warm words and write long messages' }, to: ['words'] },
        { text: { ru: 'Освобождаю время, отменяю дела ради встречи', en: 'Free up time and cancel plans to meet' }, to: ['time'] },
        { text: { ru: 'Дарю подарки, долго выбираю', en: 'Give gifts and choose them carefully' }, to: ['gifts'] },
        { text: { ru: 'Помогаю делом: починить, отвезти, решить', en: 'Help with things: fix, drive, sort out' }, to: ['acts'] },
        { text: { ru: 'Обнимаю, держу за руку, сажусь поближе', en: 'Hug, hold hands, sit closer' }, to: ['touch'] },
      ],
    },
    {
      id: 'l5',
      text: { ru: 'После тяжёлого дня тебе больше всего нужно…', en: 'After a hard day you most need…' },
      options: [
        { text: { ru: 'Услышать: «ты молодец, ты справишься»', en: 'To hear: "you did great, you will manage"' }, to: ['words'] },
        { text: { ru: 'Чтобы человек просто был рядом весь вечер', en: 'For them to simply be there all evening' }, to: ['time'] },
        { text: { ru: 'Любимую шоколадку, купленную без повода', en: 'My favourite chocolate bought for no reason' }, to: ['gifts'] },
        { text: { ru: 'Чтобы ужин уже был готов', en: 'For dinner to be ready already' }, to: ['acts'] },
        { text: { ru: 'Массаж плеч или просто обнять', en: 'A shoulder rub or just a hug' }, to: ['touch'] },
      ],
    },
    {
      id: 'l6',
      text: { ru: 'Какой подарок тронет сильнее?', en: 'Which gift would touch you more?' },
      options: [
        { text: { ru: 'Письмо от руки', en: 'A handwritten letter' }, to: ['words'] },
        { text: { ru: 'Поездка вдвоём на выходные', en: 'A weekend trip for two' }, to: ['time'] },
        { text: { ru: 'Вещь, о которой давно мечтаю, но молчу', en: 'Something I dreamed of and never said' }, to: ['gifts'] },
        { text: { ru: 'Наконец-то доделанный балкон', en: 'They finally fixed up the balcony' }, to: ['acts'] },
        { text: { ru: 'Поход на массаж вместе', en: 'Going for a massage together' }, to: ['touch'] },
      ],
    },
    {
      id: 'l7',
      text: { ru: 'Ты понимаешь, что человек к тебе остыл, когда…', en: 'You realise someone has cooled towards you when…' },
      options: [
        { text: { ru: 'Приятных слов больше не слышно', en: 'They stop saying kind words' }, to: ['words'] },
        { text: { ru: 'На тебя больше нет времени', en: 'They no longer have time for you' }, to: ['time'] },
        { text: { ru: 'Мелочи без повода исчезли', en: 'They stop bringing little things for no reason' }, to: ['gifts'] },
        { text: { ru: 'Помощи нет, даже если попросить', en: 'They stop helping, even when asked' }, to: ['acts'] },
        { text: { ru: 'Отстраняется, когда тянешься обнять', en: 'They pull away when you reach for a hug' }, to: ['touch'] },
      ],
    },
    {
      id: 'l8',
      text: { ru: 'В разлуке больше всего не хватает…', en: 'When apart, you miss most…' },
      options: [
        { text: { ru: 'Голосовых и долгих переписок', en: 'Voice notes and long chats' }, to: ['words'] },
        { text: { ru: 'Совместных дел и вечеров', en: 'Doing things and evenings together' }, to: ['time'] },
        { text: { ru: 'Маленьких знаков внимания', en: 'Small tokens of attention' }, to: ['gifts'] },
        { text: { ru: 'Помощи в быту', en: 'Their help around the house' }, to: ['acts'] },
        { text: { ru: 'Обнимашек — их не передать по видео', en: 'Hugs — you cannot send them by video' }, to: ['touch'] },
      ],
    },
    {
      id: 'l9',
      text: { ru: 'Какая фраза звучит для тебя как «люблю»?', en: 'Which line sounds like "I love you" to you?' },
      options: [
        { text: { ru: '«Я так тобой горжусь»', en: '"I am so proud of you"' }, to: ['words'] },
        { text: { ru: '«Давай сегодня только вдвоём»', en: '"Let us keep today just for us"' }, to: ['time'] },
        { text: { ru: '«Это тебе — просто так»', en: '"Saw this and thought of you"' }, to: ['gifts'] },
        { text: { ru: '«Не переживай, всё уже сделано»', en: '"Do not worry, I already took care of it"' }, to: ['acts'] },
        { text: { ru: '«Иди сюда»', en: '"Come here"' }, to: ['touch'] },
      ],
    },
    {
      id: 'l10',
      text: { ru: 'После ссоры тебя быстрее всего отпускает, если…', en: 'After a fight you calm down fastest if…' },
      options: [
        { text: { ru: 'Человек искренне признает ошибку', en: 'They sincerely say they were wrong' }, to: ['words'] },
        { text: { ru: 'Человек остаётся рядом, а не уходит', en: 'They stay near instead of leaving' }, to: ['time'] },
        { text: { ru: 'Появится маленький подарок со смыслом', en: 'They bring something meaningful' }, to: ['gifts'] },
        { text: { ru: 'Причину ссоры молча исправят', en: 'They quietly fix what the fight was about' }, to: ['acts'] },
        { text: { ru: 'Обнимут — и слова уже не нужны', en: 'They hug you — and words are not needed' }, to: ['touch'] },
      ],
    },
  ],
  results: [
    {
      key: 'words',
      title: { ru: 'Слова', en: 'Words' },
      lead: { ru: 'Для тебя любовь звучит. Тёплое слово, похвала, длинное сообщение — и ты чувствуешь, что тебя видят и ценят.', en: 'For you love is something you hear. A warm word, praise, a long message — and you feel seen and valued.' },
      strengths: [
        { ru: 'Умеешь поддержать словом в нужный момент', en: 'You know how to support with a word at the right time' },
        { ru: 'Замечаешь и называешь хорошее в людях', en: 'You notice and name the good in people' },
        { ru: 'С тобой легко говорить о чувствах', en: 'It is easy to talk about feelings with you' },
      ],
      watch: [
        { ru: 'Резкое слово ранит тебя сильнее, чем другого', en: 'A harsh word hurts you more than others' },
        { ru: 'Не все умеют говорить — некоторые любят делами', en: 'Not everyone is good with words — some love with actions' },
      ],
      tip: { ru: 'Скажи близким прямо: «Мне важно слышать, что всё хорошо». Это не каприз, а подсказка, как сделать тебя счастливым человеком.', en: 'Tell people close to you directly: "I need to hear that things are good." It is not a whim, it is a hint.' },
    },
    {
      key: 'time',
      title: { ru: 'Время вместе', en: 'Time together' },
      lead: { ru: 'Для тебя любовь — это внимание без отвлечений. Не подарки и не слова, а когда человек целиком здесь, с тобой.', en: 'For you love is undistracted attention. Not gifts, not words — when the person is fully here with you.' },
      strengths: [
        { ru: 'Умеешь быть по-настоящему рядом', en: 'You know how to truly be there' },
        { ru: 'Создаёшь общие традиции и воспоминания', en: 'You create shared traditions and memories' },
        { ru: 'Слушаешь, а не ждёшь своей очереди говорить', en: 'You listen instead of waiting to speak' },
      ],
      watch: [
        { ru: 'Телефон в руках у собеседника выбивает тебя из колеи', en: 'A phone in the other person’s hand throws you off' },
        { ru: 'Отменённая встреча ощущается как отказ', en: 'A cancelled meeting feels like rejection' },
      ],
      tip: { ru: 'Договоритесь о времени без экранов — хотя бы полчаса вечером. Мелочь, а для тебя это и есть любовь.', en: 'Agree on screen-free time — even half an hour in the evening. A small thing, but for you it is love.' },
    },
    {
      key: 'gifts',
      title: { ru: 'Подарки', en: 'Gifts' },
      lead: { ru: 'Для тебя важна не цена, а то, что о тебе подумали. Маленькая вещь «увидел и вспомнил» значит больше дорогого букета по графику.', en: 'For you it is not the price but the thought. A small "saw this and thought of you" means more than a scheduled bouquet.' },
      strengths: [
        { ru: 'Помнишь, кто что любит', en: 'You remember what people like' },
        { ru: 'Умеешь удивлять', en: 'You know how to surprise' },
        { ru: 'Ценишь внимание к мелочам', en: 'You value attention to detail' },
      ],
      watch: [
        { ru: 'Забытая дата бьёт сильнее, чем кажется со стороны', en: 'A forgotten date hurts more than it looks' },
        { ru: 'Это не меркантильность — объясняй это близким', en: 'It is not materialism — explain that to people close to you' },
      ],
      tip: { ru: 'Заведи общий список «хочу» с близкими. И тебе проще намекать, и им — радовать.', en: 'Start a shared wishlist with people close to you. Easier to hint for you, easier to please for them.' },
    },
    {
      key: 'acts',
      title: { ru: 'Помощь делом', en: 'Acts of help' },
      lead: { ru: 'Для тебя любовь — это когда помогают. Помыть посуду, починить кран, забрать из аэропорта — громче любых признаний.', en: 'For you love is help. Doing the dishes, fixing the tap, picking you up from the airport — louder than any confession.' },
      strengths: [
        { ru: 'Ты надёжный: на тебя можно положиться', en: 'You are reliable: people can count on you' },
        { ru: 'Замечаешь, где нужна помощь, без просьб', en: 'You notice where help is needed without being asked' },
        { ru: 'Твоя забота всегда конкретная', en: 'Your care is always concrete' },
      ],
      watch: [
        { ru: 'Обещание без дела для тебя хуже, чем отказ', en: 'A promise without action is worse than a no for you' },
        { ru: 'Не все видят в помощи любовь — иногда скажи словами', en: 'Not everyone sees love in help — sometimes say it' },
      ],
      tip: { ru: 'Проси конкретно: не «помоги мне», а «забери, пожалуйста, посылку в четверг». Так близким проще попасть в точку.', en: 'Ask specifically: not "help me" but "please pick up the parcel on Thursday". It helps them hit the mark.' },
    },
    {
      key: 'touch',
      title: { ru: 'Прикосновения', en: 'Touch' },
      lead: { ru: 'Для тебя любовь — это тепло рядом: обнять, взять за руку, сесть плечом к плечу. Без этого даже хорошие слова кажутся далёкими.', en: 'For you love is warmth nearby: a hug, a hand, sitting shoulder to shoulder. Without it, even good words feel distant.' },
      strengths: [
        { ru: 'Умеешь успокоить без слов', en: 'You can comfort without words' },
        { ru: 'С тобой тепло и спокойно', en: 'People feel warm and safe with you' },
        { ru: 'Быстро миришься — объятием', en: 'You make up fast — with a hug' },
      ],
      watch: [
        { ru: 'Холодность ощущается как отвержение', en: 'Coldness feels like rejection' },
        { ru: 'Расстояние и переписка даются тяжелее, чем другим', en: 'Distance and texting are harder for you than for others' },
      ],
      tip: { ru: 'Утро и вечер — самые важные моменты: обними, прежде чем расходиться, и когда снова встретились. Две секунды — и день другой.', en: 'Morning and evening matter most: hug before parting and when you meet again. Two seconds — and the day changes.' },
    },
  ],
  chart: {
    factor: 'venus',
    byElement: {
      fire: { key: 'time', text: { ru: 'Венера в твоей карте стоит в огненном знаке: любовь для тебя — это яркие моменты вместе, приключения и внимание.', en: 'Venus in your chart is in a fire sign: love means bright moments together, adventures and attention.' } },
      earth: { key: 'acts', text: { ru: 'Венера в твоей карте стоит в земном знаке: ты веришь делам, заботе в быту и надёжности.', en: 'Venus in your chart is in an earth sign: you trust actions, everyday care and reliability.' } },
      air: { key: 'words', text: { ru: 'Венера в твоей карте стоит в воздушном знаке: тебе важны разговоры, слова и лёгкость в общении.', en: 'Venus in your chart is in an air sign: talks, words and ease in communication matter to you.' } },
      water: { key: 'touch', text: { ru: 'Венера в твоей карте стоит в водном знаке: тебе важны близость, тепло и тихая нежность.', en: 'Venus in your chart is in a water sign: closeness, warmth and quiet tenderness matter to you.' } },
    },
  },
};
