import type { SelfTestDefinition } from './types';

/** Five ways people argue, in plain everyday scenes. */
export const CONFLICT_TEST: SelfTestDefinition = {
  id: 'conflict',
  title: { ru: 'Как ты ведёшь себя в ссоре', en: 'How you act in an argument' },
  subtitle: { ru: 'Наступаешь, договариваешься, уступаешь или уходишь — честно, без оценок', en: 'Push, negotiate, give in or walk away — honestly, no grades' },
  minutes: 3,
  questions: [
    {
      id: 'c1',
      text: { ru: 'Партнёр опять оставил гору посуды. Ты…', en: 'Your partner left a pile of dishes again. You…' },
      options: [
        { text: { ru: 'Сразу высказываю всё, что думаю', en: 'Say everything I think right away' }, to: ['compete'] },
        { text: { ru: 'Предлагаю сесть и придумать, как делить дела', en: 'Suggest sitting down to split the chores' }, to: ['collaborate'] },
        { text: { ru: 'Говорю: сегодня я, завтра ты', en: 'Say: me today, you tomorrow' }, to: ['compromise'] },
        { text: { ru: 'Молча мою посуду, лишь бы не ругаться', en: 'Wash them myself, anything to avoid a fight' }, to: ['accommodate'] },
        { text: { ru: 'Ухожу в другую комнату и делаю вид, что ничего нет', en: 'Go to another room and pretend nothing is there' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c2',
      text: { ru: 'Коллега присвоил твою идею на планёрке.', en: 'A colleague took credit for your idea in a meeting.' },
      options: [
        { text: { ru: 'Тут же поправляю при всех', en: 'Correct it right there in front of everyone' }, to: ['compete'] },
        { text: { ru: 'После встречи говорю с ним напрямую, чтобы такого не повторялось', en: 'Talk to them after, so it does not happen again' }, to: ['collaborate'] },
        { text: { ru: 'Предлагаю дальше вести проект вместе', en: 'Offer to run the project together from now on' }, to: ['compromise'] },
        { text: { ru: 'Ладно, главное — дело сделано', en: 'Fine, the main thing is the work gets done' }, to: ['accommodate'] },
        { text: { ru: 'Ничего не говорю, но запоминаю', en: 'Say nothing, but remember it' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c3',
      text: { ru: 'В споре ты чаще всего хочешь…', en: 'In an argument you mostly want…' },
      options: [
        { text: { ru: 'Доказать свою правоту', en: 'To prove I am right' }, to: ['compete'] },
        { text: { ru: 'Понять, что на самом деле нужно обоим', en: 'To understand what we both really need' }, to: ['collaborate'] },
        { text: { ru: 'Быстро найти середину и жить дальше', en: 'To find the middle fast and move on' }, to: ['compromise'] },
        { text: { ru: 'Чтобы другой человек не расстраивался', en: 'For the other person not to be upset' }, to: ['accommodate'] },
        { text: { ru: 'Чтобы всё это поскорее закончилось', en: 'For it all to end as soon as possible' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c4',
      text: { ru: 'Друг отменил встречу в последний момент — третий раз.', en: 'A friend cancels at the last minute — for the third time.' },
      options: [
        { text: { ru: 'Пишу резко: так не делают', en: 'Write sharply: that is not how it works' }, to: ['compete'] },
        { text: { ru: 'Спрашиваю, что происходит, и договариваемся по-другому', en: 'Ask what is going on and agree on a new way' }, to: ['collaborate'] },
        { text: { ru: 'Предлагаю встречаться ближе к нему, раз ему сложно', en: 'Offer to meet closer to them if it is hard' }, to: ['compromise'] },
        { text: { ru: 'Пишу «ничего страшного», хотя обидно', en: 'Write "no worries", though it hurts' }, to: ['accommodate'] },
        { text: { ru: 'Перестаю звать — пусть объявится первым', en: 'Stop inviting — let them reach out' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c5',
      text: { ru: 'Что ты чувствуешь сразу после ссоры?', en: 'What do you feel right after a fight?' },
      options: [
        { text: { ru: 'Азарт: всё, что хотелось, сказано', en: 'A rush: everything I wanted is said' }, to: ['compete'] },
        { text: { ru: 'Желание разобраться до конца, а не замять', en: 'A need to sort it out, not hush it up' }, to: ['collaborate'] },
        { text: { ru: 'Облегчение, если договорились хоть как-то', en: 'Relief if we agreed on anything at all' }, to: ['compromise'] },
        { text: { ru: 'Вину, даже если вины нет', en: 'Guilt, even if it was not my fault' }, to: ['accommodate'] },
        { text: { ru: 'Пустоту и желание побыть одному', en: 'Emptiness and a wish to be alone' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c6',
      text: { ru: 'Семья выбирает, куда ехать в отпуск. Мнения разные.', en: 'The family is choosing a holiday. Opinions differ.' },
      options: [
        { text: { ru: 'Отстаиваю свой вариант до последнего', en: 'Fight for my option to the end' }, to: ['compete'] },
        { text: { ru: 'Собираю, кто чего хочет, и ищу место, где будет всем', en: 'Collect what everyone wants and find a place for all' }, to: ['collaborate'] },
        { text: { ru: 'В этот раз ваш вариант, в следующий — мой', en: 'Your choice this time, mine next time' }, to: ['compromise'] },
        { text: { ru: 'Да куда угодно, лишь бы все были довольны', en: 'Anywhere, as long as everyone is happy' }, to: ['accommodate'] },
        { text: { ru: 'Пусть решают без меня', en: 'Let them decide without me' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c7',
      text: { ru: 'Тебе говорят, что ты ошибаешься. Первая реакция?', en: 'Someone says you are wrong. First reaction?' },
      options: [
        { text: { ru: 'Ещё посмотрим, кто ошибается', en: 'We will see who is wrong' }, to: ['compete'] },
        { text: { ru: 'Интересно, почему он так думает', en: 'Curious why they think so' }, to: ['collaborate'] },
        { text: { ru: 'Может, каждый прав наполовину', en: 'Maybe each of us is half right' }, to: ['compromise'] },
        { text: { ru: 'Наверное, правда ошибаюсь', en: 'I am probably wrong then' }, to: ['accommodate'] },
        { text: { ru: 'Не хочу это обсуждать', en: 'I do not want to discuss it' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c8',
      text: { ru: 'Сосед сверху шумит после одиннадцати.', en: 'The upstairs neighbour is noisy after eleven.' },
      options: [
        { text: { ru: 'Стучу по батарее или иду ругаться', en: 'Bang on the pipes or go to complain' }, to: ['compete'] },
        { text: { ru: 'Захожу днём познакомиться и договориться', en: 'Drop by in the daytime to meet and agree' }, to: ['collaborate'] },
        { text: { ru: 'Прошу хотя бы в будни до одиннадцати', en: 'Ask for at least weekdays till eleven' }, to: ['compromise'] },
        { text: { ru: 'Покупаю беруши — людям же тоже надо жить', en: 'Buy earplugs — people need to live too' }, to: ['accommodate'] },
        { text: { ru: 'Терплю и злюсь, но ничего не делаю', en: 'Put up with it, angry, doing nothing' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c9',
      text: { ru: 'Какая фраза про тебя?', en: 'Which line sounds like you?' },
      options: [
        { text: { ru: 'Лучше один раз поругаться, чем годами молчать', en: 'Better one fight than years of silence' }, to: ['compete'] },
        { text: { ru: 'Любой спор можно решить, если понять друг друга', en: 'Any argument can be solved if we understand each other' }, to: ['collaborate'] },
        { text: { ru: 'Худой мир лучше доброй ссоры', en: 'A bad peace beats a good fight' }, to: ['compromise'] },
        { text: { ru: 'Мне проще уступить, чем спорить', en: 'It is easier for me to give in than to argue' }, to: ['accommodate'] },
        { text: { ru: 'Само рассосётся', en: 'It will sort itself out' }, to: ['avoid'] },
      ],
    },
    {
      id: 'c10',
      text: { ru: 'Близкий человек обиделся, а ты не понимаешь на что.', en: 'Someone close is hurt and you do not know why.' },
      options: [
        { text: { ru: 'Требую объяснить, в чём дело', en: 'Demand to know what is going on' }, to: ['compete'] },
        { text: { ru: 'Спрашиваю спокойно и слушаю до конца', en: 'Ask calmly and listen to the end' }, to: ['collaborate'] },
        { text: { ru: 'Извиняюсь за своё и жду того же', en: 'Apologise for my part and expect the same' }, to: ['compromise'] },
        { text: { ru: 'Извиняюсь сразу — неважно за что', en: 'Apologise right away — whatever for' }, to: ['accommodate'] },
        { text: { ru: 'Даю время, вдруг пройдёт само', en: 'Give it time, maybe it passes' }, to: ['avoid'] },
      ],
    },
  ],
  results: [
    {
      key: 'compete',
      title: { ru: 'Напор', en: 'Push' },
      lead: { ru: 'В ссоре ты идёшь вперёд и говоришь прямо. С тобой понятно, где стоишь, и проблемы не гниют годами.', en: 'In a fight you go forward and speak plainly. People know where they stand, and problems do not rot for years.' },
      strengths: [
        { ru: 'Не копишь обиды — всё сразу на столе', en: 'You do not store grudges — it is all on the table' },
        { ru: 'Умеешь защитить себя и своих', en: 'You can stand up for yourself and your people' },
        { ru: 'В кризисе берёшь решение на себя', en: 'In a crisis you take the decision' },
      ],
      watch: [
        { ru: 'Побеждать в споре и решать проблему — не одно и то же', en: 'Winning an argument and solving a problem are not the same' },
        { ru: 'Тихие люди рядом могут просто перестать спорить — и отдалиться', en: 'Quiet people around you may just stop arguing — and drift away' },
      ],
      tip: { ru: 'Перед тем как отвечать, задай один вопрос: «А что ты хочешь сказать?» Это меняет весь разговор.', en: 'Before replying, ask one question: "What did you mean?" It changes the whole conversation.' },
    },
    {
      key: 'collaborate',
      title: { ru: 'Сотрудничество', en: 'Working it out' },
      lead: { ru: 'Ты ищешь решение, которое подойдёт обоим, а не просто перемирие. Это самый взрослый способ ссориться — и самый затратный.', en: 'You look for a solution that suits both of you, not just a truce. It is the most grown-up way to argue — and the most tiring.' },
      strengths: [
        { ru: 'Слышишь, что стоит за словами', en: 'You hear what is behind the words' },
        { ru: 'После ссоры с тобой отношения становятся крепче', en: 'After a fight with you, relationships get stronger' },
        { ru: 'Не боишься трудных разговоров', en: 'You are not afraid of hard talks' },
      ],
      watch: [
        { ru: 'Не каждая мелочь стоит часового разговора', en: 'Not every small thing is worth an hour-long talk' },
        { ru: 'Устаёшь, если договариваться всегда начинаешь ты', en: 'It wears you out if you are always the one who starts' },
      ],
      tip: { ru: 'Раздели споры на «важно» и «пусть». По второй категории можно просто уступить или посмеяться — силы пригодятся для первой.', en: 'Split arguments into "matters" and "let it go". For the second, just give in or laugh — save strength for the first.' },
    },
    {
      key: 'compromise',
      title: { ru: 'Компромисс', en: 'Middle ground' },
      lead: { ru: 'Ты быстро находишь середину: немного уступить, немного получить — и жить дальше. С тобой легко договариваться.', en: 'You quickly find the middle: give a little, get a little — and move on. It is easy to make deals with you.' },
      strengths: [
        { ru: 'Гасишь ссору, пока она не разрослась', en: 'You put out a fight before it grows' },
        { ru: 'Честно делишь — без обид', en: 'You split things fairly — no hard feelings' },
        { ru: 'Умеешь быть гибким', en: 'You know how to be flexible' },
      ],
      watch: [
        { ru: 'Иногда середина не устраивает никого', en: 'Sometimes the middle suits nobody' },
        { ru: 'В важном для себя лучше не делить пополам', en: 'In what matters to you, do not split it in half' },
      ],
      tip: { ru: 'Прежде чем предлагать «давай пополам», спроси себя: а мне это важно на сколько из десяти? Если на девять — говори об этом прямо.', en: 'Before offering "let us split it", ask yourself: how much does this matter, out of ten? If nine — say so.' },
    },
    {
      key: 'accommodate',
      title: { ru: 'Уступка', en: 'Giving in' },
      lead: { ru: 'Тебе важнее мир и человек, чем правота. Ты легко уступаешь — и это делает тебя очень тёплым человеком.', en: 'Peace and the person matter more to you than being right. You give in easily — and that makes you very warm.' },
      strengths: [
        { ru: 'Сохраняешь отношения там, где другие рвут', en: 'You keep relationships where others break them' },
        { ru: 'Чувствуешь, когда человеку плохо', en: 'You sense when someone feels bad' },
        { ru: 'Не раздуваешь мелочи', en: 'You do not blow up small things' },
      ],
      watch: [
        { ru: 'Невысказанное копится и потом выходит разом', en: 'What you leave unsaid piles up and bursts out at once' },
        { ru: 'Люди привыкают, что ты всегда уступишь', en: 'People get used to you always giving in' },
      ],
      tip: { ru: 'Попробуй раз в неделю сказать «нет» в мелочи: где сесть, что смотреть, куда идти. Это тренировка, а не ссора.', en: 'Once a week, try saying "no" to something small: where to sit, what to watch, where to go. It is practice, not a fight.' },
    },
    {
      key: 'avoid',
      title: { ru: 'Уход', en: 'Walking away' },
      lead: { ru: 'Ссоры тебя выматывают, и ты предпочитаешь отойти, пока всё не уляжется. Иногда это мудро: остыть и правда полезно.', en: 'Fights drain you, and you prefer to step back until things settle. Sometimes that is wise: cooling down helps.' },
      strengths: [
        { ru: 'Не говоришь лишнего сгоряча', en: 'You do not say things you regret in the heat' },
        { ru: 'Не тратишь силы на пустые споры', en: 'You do not waste strength on empty arguments' },
        { ru: 'Даёшь людям время прийти в себя', en: 'You give people time to calm down' },
      ],
      watch: [
        { ru: 'Важное само не рассасывается — оно ждёт', en: 'Important things do not sort themselves out — they wait' },
        { ru: 'Другим кажется, что тебе всё равно, хотя это не так', en: 'Others may think you do not care, though you do' },
      ],
      tip: { ru: 'Уходи, но с обещанием: «Мне нужен час, потом поговорим». Пауза с датой возвращения — это не побег, а забота о разговоре.', en: 'Step away, but with a promise: "I need an hour, then we talk." A pause with a return time is not running away.' },
    },
  ],
  chart: {
    factor: 'mars',
    byElement: {
      fire: { key: 'compete', text: { ru: 'Марс в твоей карте стоит в огненном знаке: злость вспыхивает быстро и выходит наружу сразу.', en: 'Mars in your chart is in a fire sign: anger flares fast and comes out at once.' } },
      earth: { key: 'collaborate', text: { ru: 'Марс в твоей карте стоит в земном знаке: ты упираешься по делу и хочешь, чтобы спор чем-то кончился.', en: 'Mars in your chart is in an earth sign: you dig in on the facts and want an argument to lead somewhere.' } },
      air: { key: 'compromise', text: { ru: 'Марс в твоей карте стоит в воздушном знаке: ты споришь словами и аргументами и легче всего договариваешься.', en: 'Mars in your chart is in an air sign: you argue with words and reasons and find deals easiest.' } },
      water: { key: 'avoid', text: { ru: 'Марс в твоей карте стоит в водном знаке: злость уходит внутрь, а обида копится тихо.', en: 'Mars in your chart is in a water sign: anger goes inward and hurt piles up quietly.' } },
    },
  },
};
