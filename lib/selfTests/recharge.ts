import type { SelfTestDefinition } from './types';

/** What really restores you: people, quiet, the body or new impressions. */
export const RECHARGE_TEST: SelfTestDefinition = {
  id: 'recharge',
  title: { ru: 'Что тебя заряжает', en: 'What recharges you' },
  subtitle: { ru: 'Люди, тишина, тело или новое, где ты на самом деле отдыхаешь', en: 'People, quiet, the body or something new, where you truly rest' },
  minutes: 2,
  questions: [
    {
      id: 'r1',
      text: { ru: 'Пятница, вечер, сил ноль. Что тебя вернёт к жизни?', en: 'Friday night, zero strength. What brings you back to life?' },
      options: [
        { text: { ru: 'Бар или кухня с друзьями', en: 'A bar or a kitchen with friends' }, to: ['people'] },
        { text: { ru: 'Выключить телефон и побыть в тишине', en: 'Switch off the phone and be in silence' }, to: ['quiet'] },
        { text: { ru: 'Горячий душ, вкусная еда и рано спать', en: 'A hot shower, good food and an early night' }, to: ['body'] },
        { text: { ru: 'Новое место, кафе, выставка, куда угодно', en: 'A new place, a café, an exhibition, anywhere' }, to: ['new'] },
      ],
    },
    {
      id: 'r2',
      text: { ru: 'Идеальный выходной день, это…', en: 'A perfect day off is…' },
      options: [
        { text: { ru: 'Встречи с теми, по кому скучаю', en: 'Seeing people I have missed' }, to: ['people'] },
        { text: { ru: 'День, когда никто ничего от тебя не хочет', en: 'A day when nobody wants anything from me' }, to: ['quiet'] },
        { text: { ru: 'Прогулка, баня или спорт, чтобы тело гудело', en: 'A walk, sauna or sport, so the body hums' }, to: ['body'] },
        { text: { ru: 'Поездка в незнакомый город', en: 'A trip to a town I have never been to' }, to: ['new'] },
      ],
    },
    {
      id: 'r3',
      text: { ru: 'После долгой вечеринки ты обычно…', en: 'After a long party you usually…' },
      options: [
        { text: { ru: 'Сил полно, хочется продолжения', en: 'Full of energy and want more' }, to: ['people'] },
        { text: { ru: 'Хочу день ни с кем не разговаривать', en: 'Want a day of talking to nobody' }, to: ['quiet'] },
        { text: { ru: 'Нормально, если выспаться', en: 'Fine, if I get some sleep' }, to: ['body'] },
        { text: { ru: 'Зависит от того, было ли что-то новое и интересное', en: 'Depends on whether there was something new' }, to: ['new'] },
      ],
    },
    {
      id: 'r4',
      text: { ru: 'Что быстрее всего поднимает настроение?', en: 'What lifts your mood fastest?' },
      options: [
        { text: { ru: 'Позвонить другу и поболтать', en: 'Calling a friend for a chat' }, to: ['people'] },
        { text: { ru: 'Час с книгой или любимой музыкой', en: 'An hour with a book or favourite music' }, to: ['quiet'] },
        { text: { ru: 'Пробежка, танцы, любая нагрузка', en: 'A run, dancing, any workout' }, to: ['body'] },
        { text: { ru: 'Узнать что-то новое, видео, лекция, идея', en: 'Learning something new, a video, a talk, an idea' }, to: ['new'] },
      ],
    },
    {
      id: 'r5',
      text: { ru: 'В отпуске тебе важнее всего…', en: 'On holiday what matters most is…' },
      options: [
        { text: { ru: 'Хорошая компания', en: 'Good company' }, to: ['people'] },
        { text: { ru: 'Тихое место без толп', en: 'A quiet place without crowds' }, to: ['quiet'] },
        { text: { ru: 'Море, солнце, массаж и сон', en: 'Sea, sun, massage and sleep' }, to: ['body'] },
        { text: { ru: 'Много новых мест и впечатлений', en: 'Lots of new places and impressions' }, to: ['new'] },
      ],
    },
    {
      id: 'r6',
      text: { ru: 'Что выматывает тебя сильнее всего?', en: 'What drains you the most?' },
      options: [
        { text: { ru: 'Долго быть без людей', en: 'Being alone for a long time' }, to: ['people'] },
        { text: { ru: 'Шум и люди без перерыва', en: 'Non-stop noise and people' }, to: ['quiet'] },
        { text: { ru: 'Весь день сидеть, не двигаясь', en: 'Sitting still all day' }, to: ['body'] },
        { text: { ru: 'Одно и то же каждый день', en: 'The same thing every day' }, to: ['new'] },
      ],
    },
    {
      id: 'r7',
      text: { ru: 'Когда тебе плохо, ты…', en: 'When you feel bad, you…' },
      options: [
        { text: { ru: 'Ищу, с кем поговорить', en: 'Look for someone to talk to' }, to: ['people'] },
        { text: { ru: 'Прячусь под одеяло, и чтоб никто не трогал', en: 'Hide under the blanket, do not touch me' }, to: ['quiet'] },
        { text: { ru: 'Иду гулять или готовлю что-то вкусное', en: 'Go for a walk or cook something tasty' }, to: ['body'] },
        { text: { ru: 'Отвлекаюсь на что-то совсем новое', en: 'Distract myself with something completely new' }, to: ['new'] },
      ],
    },
    {
      id: 'r8',
      text: { ru: 'Какое утро тебе ближе?', en: 'Which morning would you choose?' },
      options: [
        { text: { ru: 'Завтрак с близкими и разговоры', en: 'Breakfast with family and chatting' }, to: ['people'] },
        { text: { ru: 'Кофе в одиночестве, пока все спят', en: 'Coffee alone while everyone sleeps' }, to: ['quiet'] },
        { text: { ru: 'Зарядка или пробежка до завтрака', en: 'Exercise or a run before breakfast' }, to: ['body'] },
        { text: { ru: 'Дорога в незнакомое место', en: 'On the road somewhere new' }, to: ['new'] },
      ],
    },
    {
      id: 'r9',
      text: { ru: 'Хобби, в котором ты отдыхаешь душой…', en: 'A hobby where you truly rest…' },
      options: [
        { text: { ru: 'Настолки, клубы, любые встречи', en: 'Board games, clubs, any meetups' }, to: ['people'] },
        { text: { ru: 'Рисовать, читать, вязать, в своём углу', en: 'Drawing, reading, knitting, in my corner' }, to: ['quiet'] },
        { text: { ru: 'Спорт, сад, ремонт, руками и ногами', en: 'Sport, garden, DIY, hands and feet' }, to: ['body'] },
        { text: { ru: 'Языки, путешествия, новые навыки', en: 'Languages, travel, new skills' }, to: ['new'] },
      ],
    },
    {
      id: 'r10',
      text: { ru: 'Какая фраза про тебя?', en: 'Which line is you?' },
      options: [
        { text: { ru: 'Люди, моя батарейка', en: 'People are my battery' }, to: ['people'] },
        { text: { ru: 'Тишина, лучший отдых', en: 'Silence is the best rest' }, to: ['quiet'] },
        { text: { ru: 'В здоровом теле, нормальное настроение', en: 'Healthy body, decent mood' }, to: ['body'] },
        { text: { ru: 'Скука, мой главный враг', en: 'Boredom is my worst enemy' }, to: ['new'] },
      ],
    },
  ],
  results: [
    {
      key: 'people',
      title: { ru: 'Люди', en: 'People' },
      lead: { ru: 'Тебя заряжает общение. Разговор с близким человеком действует лучше любого сна, а одиночество быстро сажает батарейку.', en: 'Talking with people recharges you. A chat with someone close works better than any sleep, and being alone drains you fast.' },
      strengths: [
        { ru: 'Быстро восстанавливаешься рядом с людьми', en: 'You recover fast around people' },
        { ru: 'Легко просишь поддержки', en: 'You easily ask for support' },
        { ru: 'Заряжаешь других, с тобой весело', en: 'You lift others, it is fun with you' },
      ],
      watch: [
        { ru: 'Не все встречи заряжают, некоторые люди, наоборот, забирают силы', en: 'Not every meeting recharges, some people take it away' },
        { ru: 'Без планов на вечер может накрыть тоской', en: 'An evening without plans may get gloomy' },
      ],
      tip: { ru: 'Держи в неделе хотя бы одну встречу с человеком, после которого легко. Не «надо», а «хочу».', en: 'Keep at least one meeting a week with someone who makes it easy. Not "should", but "want".' },
    },
    {
      key: 'quiet',
      title: { ru: 'Тишина', en: 'Quiet' },
      lead: { ru: 'Ты отдыхаешь в тишине и в своём пространстве. Это не замкнутость: просто твоя батарейка заряжается, когда никто ничего не просит.', en: 'You rest in silence and your own space. It is not being withdrawn: your battery charges when nobody asks for anything.' },
      strengths: [
        { ru: 'Умеешь восстанавливаться без чужой помощи', en: 'You know how to restore yourself' },
        { ru: 'Хорошо думаешь и замечаешь важное', en: 'You think well and notice what matters' },
        { ru: 'Не зависишь от чужого настроения', en: 'You do not depend on others’ moods' },
      ],
      watch: [
        { ru: 'Близкие могут принять паузу на свой счёт, предупреди их', en: 'People close may take your pause personally, tell them' },
        { ru: 'Без тишины неделями с людьми становится трудно', en: 'Weeks without quiet make you prickly' },
      ],
      tip: { ru: 'Поставь в календарь «час для себя» так же серьёзно, как встречу. И не отменяй его ради других.', en: 'Put "an hour for me" in the calendar as seriously as a meeting. And do not cancel it for others.' },
    },
    {
      key: 'body',
      title: { ru: 'Тело', en: 'The body' },
      lead: { ru: 'Тебя возвращает к жизни простое: движение, сон, вкусная еда, тёплый душ. Голова отдыхает, когда отдыхает тело.', en: 'Simple things bring you back: movement, sleep, good food, a warm shower. Your head rests when your body does.' },
      strengths: [
        { ru: 'Знаешь проверенные способы прийти в себя', en: 'You know proven ways to recover' },
        { ru: 'Умеешь радоваться простым вещам', en: 'You enjoy simple things' },
        { ru: 'Быстро снимаешь стресс движением', en: 'You shake off stress by moving' },
      ],
      watch: [
        { ru: 'Недосып сразу бьёт по настроению, это не каприз', en: 'Lack of sleep hits your mood right away, it is not a whim' },
        { ru: 'Сидячий день делает тебя раздражительным', en: 'A day sitting still makes you irritable' },
      ],
      tip: { ru: 'Когда всё бесит, сначала проверь три вещи: сон, еда, движение. Часто дело в одной из них.', en: 'When everything annoys you, check three things first: sleep, food, movement. It is often one of them.' },
    },
    {
      key: 'new',
      title: { ru: 'Новое', en: 'Something new' },
      lead: { ru: 'Тебя заряжают впечатления: новые места, идеи, люди, навыки. Рутина сажает тебя быстрее любой работы.', en: 'Impressions recharge you: new places, ideas, people, skills. Routine drains you faster than any work.' },
      strengths: [
        { ru: 'Легко пробуешь и не боишься перемен', en: 'You try things easily and do not fear change' },
        { ru: 'Приносишь в жизнь близких что-то свежее', en: 'You bring something fresh to people close to you' },
        { ru: 'Быстро учишься', en: 'You learn fast' },
      ],
      watch: [
        { ru: 'Можно бросать дела, когда пропадает новизна', en: 'You may drop things once the novelty fades' },
        { ru: 'Скучная неделя ощущается как наказание', en: 'A boring week feels like punishment' },
      ],
      tip: { ru: 'Добавь новизну в привычное: новый маршрут, новое блюдо, новый плейлист. Не обязательно лететь в другую страну.', en: 'Add novelty to the routine: a new route, a new dish, a new playlist. No need to fly abroad.' },
    },
  ],
  chart: {
    factor: 'moon',
    byElement: {
      fire: { key: 'new', text: { ru: 'Луна в твоей карте стоит в огненном знаке: тебе нужны движение вперёд, азарт и новые впечатления.', en: 'The Moon in your chart is in a fire sign: you need momentum, excitement and new impressions.' } },
      earth: { key: 'body', text: { ru: 'Луна в твоей карте стоит в земном знаке: тебя успокаивают уют, режим, еда и простые телесные радости.', en: 'The Moon in your chart is in an earth sign: comfort, routine, food and simple physical joys calm you.' } },
      air: { key: 'people', text: { ru: 'Луна в твоей карте стоит в воздушном знаке: тебе легче, когда есть с кем поговорить и обменяться мыслями.', en: 'The Moon in your chart is in an air sign: it is easier when you have someone to talk to.' } },
      water: { key: 'quiet', text: { ru: 'Луна в твоей карте стоит в водном знаке: тебе нужны тишина, близкие люди рядом и время побыть в своих чувствах.', en: 'The Moon in your chart is in a water sign: you need quiet, close people nearby and time with your feelings.' } },
    },
  },
};
