import type { SelfTestDefinition } from './types';

/** Classic four temperaments, in everyday situations. */
export const TEMPERAMENT_TEST: SelfTestDefinition = {
  id: 'temperament',
  title: { ru: 'Какой у тебя темперамент', en: 'What is your temperament' },
  subtitle: { ru: 'Холерик, сангвиник, флегматик или меланхолик, по обычным ситуациям', en: 'Choleric, sanguine, phlegmatic or melancholic, through everyday moments' },
  minutes: 3,
  questions: [
    {
      id: 't1',
      text: { ru: 'Утро понедельника, звонит будильник. Ты…', en: 'Monday morning, the alarm goes off. You…' },
      options: [
        { text: { ru: 'Вскакиваешь и сразу в бой', en: 'Jump up and get going' }, to: ['choleric'] },
        { text: { ru: 'Включаешь музыку и пишешь друзьям', en: 'Put on music and text friends' }, to: ['sanguine'] },
        { text: { ru: 'Встаёшь по привычному порядку, без суеты', en: 'Get up in your usual order, no rush' }, to: ['phlegmatic'] },
        { text: { ru: 'Лежишь и прокручиваешь, как пройдёт день', en: 'Lie there replaying how the day will go' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't2',
      text: { ru: 'В очереди кто-то лезет вперёд. Что ты делаешь?', en: 'Someone cuts in line. What do you do?' },
      options: [
        { text: { ru: 'Сразу говорю, громко и прямо', en: 'Say it right away, loud and clear' }, to: ['choleric'] },
        { text: { ru: 'Шучу так, что ему становится неловко', en: 'Make a joke that makes them blush' }, to: ['sanguine'] },
        { text: { ru: 'Пусть стоит, минута ничего не решит', en: 'Let it go, one minute changes nothing' }, to: ['phlegmatic'] },
        { text: { ru: 'Молчу, но настроение испорчено на час', en: 'Stay quiet, but my mood is ruined for an hour' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't3',
      text: { ru: 'Ты в новой компании, где почти никого не знаешь.', en: 'You are in a new group where you hardly know anyone.' },
      options: [
        { text: { ru: 'Быстро беру разговор на себя', en: 'Quickly take over the conversation' }, to: ['choleric'] },
        { text: { ru: 'Через десять минут знаю всех по именам', en: 'Know everyone by name in ten minutes' }, to: ['sanguine'] },
        { text: { ru: 'Нахожу одного человека и весь вечер с ним', en: 'Find one person and stay with them all evening' }, to: ['phlegmatic'] },
        { text: { ru: 'Присматриваюсь и раскрываюсь ближе к концу', en: 'Watch first and open up towards the end' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't4',
      text: { ru: 'Планы на выходные внезапно сорвались.', en: 'Your weekend plans suddenly fall through.' },
      options: [
        { text: { ru: 'Злюсь, но тут же ищу план Б', en: 'Get annoyed, then instantly find plan B' }, to: ['choleric'] },
        { text: { ru: 'Отлично, значит, случится что-то другое', en: 'Great, something else will happen then' }, to: ['sanguine'] },
        { text: { ru: 'Ничего страшного, перенесём', en: 'No big deal, we will reschedule' }, to: ['phlegmatic'] },
        { text: { ru: 'Расстраиваюсь сильнее, чем стоило бы', en: 'Get more upset than it deserves' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't5',
      text: { ru: 'Как ты обычно принимаешь решения?', en: 'How do you usually make decisions?' },
      options: [
        { text: { ru: 'Быстро, а разбираюсь по ходу', en: 'Fast, and figure it out on the way' }, to: ['choleric'] },
        { text: { ru: 'По настроению, как сердце скажет', en: 'By mood, whatever feels right' }, to: ['sanguine'] },
        { text: { ru: 'Не спеша, всё взвесив', en: 'Slowly, after weighing everything' }, to: ['phlegmatic'] },
        { text: { ru: 'Долго сомневаюсь и боюсь ошибиться', en: 'Doubt for a long time, afraid to get it wrong' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't6',
      text: { ru: 'Какая работа тебе больше по душе?', en: 'What kind of work suits you best?' },
      options: [
        { text: { ru: 'Где надо рулить и решать', en: 'Where I get to lead and decide' }, to: ['choleric'] },
        { text: { ru: 'Где много людей и каждый день разный', en: 'With lots of people and every day different' }, to: ['sanguine'] },
        { text: { ru: 'Спокойная и понятная, без авралов', en: 'Calm and clear, no fire drills' }, to: ['phlegmatic'] },
        { text: { ru: 'Где можно сделать тонко и качественно', en: 'Where I can do things carefully and well' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't7',
      text: { ru: 'Тебя задели словом. Что дальше?', en: 'Someone hurt you with a remark. What next?' },
      options: [
        { text: { ru: 'Вспыхиваю, но быстро отхожу', en: 'Flare up, but cool down quickly' }, to: ['choleric'] },
        { text: { ru: 'Расскажу друзьям, и уже легче', en: 'Tell my friends, and it already feels lighter' }, to: ['sanguine'] },
        { text: { ru: 'Меня вообще трудно задеть', en: 'It is hard to get to me at all' }, to: ['phlegmatic'] },
        { text: { ru: 'Помню долго, даже если не показываю', en: 'Remember it for long, even if I do not show it' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't8',
      text: { ru: 'Друзья описали бы тебя одним словом…', en: 'Friends would describe you in one word…' },
      options: [
        { text: { ru: 'Огонь', en: 'Fire' }, to: ['choleric'] },
        { text: { ru: 'Душа компании', en: 'Life of the party' }, to: ['sanguine'] },
        { text: { ru: 'Скала', en: 'Rock' }, to: ['phlegmatic'] },
        { text: { ru: 'Тонкий человек', en: 'Sensitive soul' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't9',
      text: { ru: 'Скучная задача часа на три.', en: 'A boring task for about three hours.' },
      options: [
        { text: { ru: 'Сделаю рывком, лишь бы закончить', en: 'Do it in one push just to finish' }, to: ['choleric'] },
        { text: { ru: 'Отвлекусь сто раз, но сделаю', en: 'Get distracted a hundred times, but do it' }, to: ['sanguine'] },
        { text: { ru: 'Спокойно сделаю, даже приятно', en: 'Calmly do it, it is even nice' }, to: ['phlegmatic'] },
        { text: { ru: 'Сделаю идеально, но вымотаюсь', en: 'Do it perfectly, but be drained' }, to: ['melancholic'] },
      ],
    },
    {
      id: 't10',
      text: { ru: 'Как ты отдыхаешь после тяжёлой недели?', en: 'How do you rest after a hard week?' },
      options: [
        { text: { ru: 'Спорт или любое дело, где можно выпустить пар', en: 'Sport or anything that lets off steam' }, to: ['choleric'] },
        { text: { ru: 'Встреча с друзьями, чем шумнее, тем лучше', en: 'Seeing friends, the louder the better' }, to: ['sanguine'] },
        { text: { ru: 'Диван, сериал и никуда не спешить', en: 'Couch, a series and no rush' }, to: ['phlegmatic'] },
        { text: { ru: 'Тишина, книга и никаких людей', en: 'Quiet, a book and no people' }, to: ['melancholic'] },
      ],
    },
  ],
  results: [
    {
      key: 'choleric',
      title: { ru: 'Холерик', en: 'Choleric' },
      lead: { ru: 'Ты заводишься быстро и быстро действуешь. Рядом с тобой дела сдвигаются с места, а скука долго не живёт.', en: 'You start fast and act fast. Around you things get moving, and boredom does not last.' },
      strengths: [
        { ru: 'Решаешь, пока другие обсуждают', en: 'You decide while others are still talking' },
        { ru: 'Берёшь ответственность, когда все растерялись', en: 'You take charge when everyone is lost' },
        { ru: 'Честно говоришь, что думаешь', en: 'You honestly say what you think' },
      ],
      watch: [
        { ru: 'Вспыхиваешь раньше, чем дослушаешь, посчитай до пяти', en: 'You flare up before hearing people out, count to five' },
        { ru: 'Устаёшь резко: заряд кончается сразу и целиком', en: 'You run out sharply: all at once' },
      ],
      tip: { ru: 'Самые важные разговоры откладывай на вечер, когда пар уже вышел. Утренний ты, для рывков, вечерний, для переговоров.', en: 'Leave important talks for the evening when the steam is out. Morning you is for sprints, evening you for negotiations.' },
    },
    {
      key: 'sanguine',
      title: { ru: 'Сангвиник', en: 'Sanguine' },
      lead: { ru: 'Ты лёгкий человек: быстро сходишься с людьми, быстро переключаешься и не застреваешь в плохом.', en: 'You are easy-going: you click with people fast, switch fast and do not get stuck in the bad.' },
      strengths: [
        { ru: 'Умеешь разрядить обстановку одной фразой', en: 'You can ease tension with one line' },
        { ru: 'Знакомишь людей и собираешь компании', en: 'You connect people and gather groups' },
        { ru: 'Быстро приходишь в себя после неудач', en: 'You bounce back quickly after setbacks' },
      ],
      watch: [
        { ru: 'Начатого много, законченного, меньше', en: 'Lots started, fewer finished' },
        { ru: 'Обещаешь легко, а потом не хватает времени', en: 'You promise easily and then run out of time' },
      ],
      tip: { ru: 'Заведи правило одной вещи: пока не закончишь одно дело, за новое не берёшься. Звучит скучно, работает отлично.', en: 'Try the one-thing rule: no new task until the current one is done. Sounds dull, works great.' },
    },
    {
      key: 'phlegmatic',
      title: { ru: 'Флегматик', en: 'Phlegmatic' },
      lead: { ru: 'Ты спокойный и надёжный. Раскачиваешься не сразу, зато потом тебя не сбить, и на тебя можно опереться.', en: 'You are calm and reliable. You take time to start, but then nothing knocks you off course, and people can lean on you.' },
      strengths: [
        { ru: 'Не паникуешь, когда все вокруг паникуют', en: 'You stay calm when everyone panics' },
        { ru: 'Доводишь дела до конца', en: 'You finish what you start' },
        { ru: 'С тобой спокойно и уютно', en: 'People feel safe and cosy with you' },
      ],
      watch: [
        { ru: 'Перемены даются тяжело, даже хорошие', en: 'Change is hard, even good change' },
        { ru: 'Молчишь о том, что не нравится, слишком долго', en: 'You stay quiet about what bothers you for too long' },
      ],
      tip: { ru: 'Раз в месяц делай что-то новое по мелочи: другая дорога, новое блюдо, незнакомое место. Так перемены перестают пугать.', en: 'Once a month do one small new thing: another route, a new dish, an unknown place. Change stops feeling scary.' },
    },
    {
      key: 'melancholic',
      title: { ru: 'Меланхолик', en: 'Melancholic' },
      lead: { ru: 'Ты чувствуешь тоньше других: замечаешь детали, настроение людей и то, что обычно проходит мимо.', en: 'You feel things more finely than most: you notice details, moods and what usually goes unnoticed.' },
      strengths: [
        { ru: 'Делаешь качественно, а не лишь бы как', en: 'You do things properly, not just somehow' },
        { ru: 'Понимаешь людей без слов', en: 'You understand people without words' },
        { ru: 'Видишь риски раньше других', en: 'You see risks before others do' },
      ],
      watch: [
        { ru: 'Прокручиваешь мысли по кругу, особенно на ночь', en: 'You replay thoughts in circles, especially at night' },
        { ru: 'Устаёшь от людей быстрее, чем кажется со стороны', en: 'People tire you faster than it looks' },
      ],
      tip: { ru: 'Если мысль крутится третий раз, запиши её на бумагу. Записанное перестаёт жужжать в голове.', en: 'If a thought comes back a third time, write it down. Written thoughts stop buzzing.' },
    },
  ],
  chart: {
    factor: 'elements',
    byElement: {
      fire: { key: 'choleric', text: { ru: 'В твоей карте больше всего огня, это классика холерика: быстрый старт и прямота.', en: 'Your chart has the most fire, classic choleric: a fast start and directness.' } },
      air: { key: 'sanguine', text: { ru: 'В твоей карте больше всего воздуха, так обычно описывают сангвиника: общение, лёгкость, переключение.', en: 'Your chart has the most air, the usual picture of a sanguine: talk, lightness, switching.' } },
      earth: { key: 'phlegmatic', text: { ru: 'В твоей карте больше всего земли, это ближе всего к флегматику: устойчивость и надёжность.', en: 'Your chart has the most earth, closest to the phlegmatic: steadiness and reliability.' } },
      water: { key: 'melancholic', text: { ru: 'В твоей карте больше всего воды, так рисуют меланхолика: чувствительность и внимание к оттенкам.', en: 'Your chart has the most water, the picture of a melancholic: sensitivity and attention to nuance.' } },
    },
  },
};
