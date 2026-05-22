import type { NatalChartData, PlanetPosition, ProfileCard, UserProfile } from '../types';

export const NATAL_PROFILE_CARDS_VERSION = 'profile_cards.v2';

export type NatalProfileCardsInput = {
  profile: UserProfile;
  chartData: NatalChartData;
  isPremium?: boolean;
  todayContext?: {
    shortText?: string | null;
    pulseTitle?: string | null;
    pulseSummary?: string | null;
    bestWindowLabel?: string | null;
    checkinCompleted?: boolean | null;
    recentActionCount?: number | null;
    localHour?: number | null;
  };
};

const SIGN_RU: Record<string, string> = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы',
};

function compact(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function signLabel(position?: PlanetPosition | null): string {
  const sign = String(position?.sign || '').trim();
  return SIGN_RU[sign] || sign || 'не указано';
}

function hasReliableBirthTime(profile: UserProfile, chartData: NatalChartData): boolean {
  const time = String(profile.birthTime || '').trim();
  return !!time && time !== '12:00' && !!chartData.rising?.sign && Array.isArray(chartData.houses) && chartData.houses.length >= 12;
}

function confidence(profile: UserProfile, chartData: NatalChartData, usesBirthTime = false): 'high' | 'medium' | 'low' {
  if (!chartData.sun?.sign) return 'low';
  if (!usesBirthTime) return chartData.moon?.sign ? 'high' : 'medium';
  return hasReliableBirthTime(profile, chartData) ? 'high' : 'medium';
}

function aspectCounts(chartData: NatalChartData) {
  const positive = (chartData.aspects || []).filter((aspect) => aspect.type === 'trine' || aspect.type === 'sextile').length;
  const tense = (chartData.aspects || []).filter((aspect) => aspect.type === 'square' || aspect.type === 'opposition').length;
  return { positive, tense };
}

function card(params: ProfileCard): ProfileCard {
  return {
    ...params,
    mapperVersion: NATAL_PROFILE_CARDS_VERSION,
    title: compact(params.title),
    subtitle: params.subtitle ? compact(params.subtitle) : undefined,
    chips: params.chips.map(compact).filter(Boolean).slice(0, 3),
    shortText: compact(params.shortText),
    body: params.body
      ? {
          life: compact(params.body.life),
          plus: compact(params.body.plus),
          risk: compact(params.body.risk),
          action: params.body.action ? compact(params.body.action) : undefined,
        }
      : undefined,
    freeText: compact(params.freeText),
    premiumText: params.premiumText ? compact(params.premiumText) : undefined,
    premiumBody: params.premiumBody
      ? {
          work: compact(params.premiumBody.work),
          relationships: compact(params.premiumBody.relationships),
          money: compact(params.premiumBody.money),
          recommendation: compact(params.premiumBody.recommendation),
          why: compact(params.premiumBody.why),
        }
      : undefined,
    freeBullets: params.freeBullets?.map(compact).filter(Boolean),
    premiumBullets: params.premiumBullets?.map(compact).filter(Boolean),
    teaser: params.teaser ? compact(params.teaser) : undefined,
  };
}

function bodyText(body: NonNullable<ProfileCard['body']>): string {
  return [
    `Где это видно: ${body.life}`,
    `Пример: ${body.plus}`,
    `Что может мешать: ${body.risk}`,
    body.action ? `Что делать: ${body.action}` : '',
  ].filter(Boolean).join('\n\n');
}

function premiumText(body: NonNullable<ProfileCard['premiumBody']>): string {
  return [
    `Работа: ${body.work}`,
    `Отношения: ${body.relationships}`,
    `Деньги: ${body.money}`,
    `Что делать: ${body.recommendation}`,
    `Почему так по карте: ${body.why}`,
  ].join('\n\n');
}

export function buildNatalProfileCards(input: NatalProfileCardsInput): ProfileCard[] {
  const { profile, chartData } = input;
  const sun = signLabel(chartData.sun);
  const moon = signLabel(chartData.moon);
  const rising = signLabel(chartData.rising);
  const mercury = signLabel(chartData.mercury);
  const venus = signLabel(chartData.venus);
  const mars = signLabel(chartData.mars);
  const aspects = aspectCounts(chartData);

  const sourceDebugBase = [
    `sun:${sun}`,
    `moon:${moon}`,
    `rising:${rising}`,
    `mercury:${mercury}`,
    `venus:${venus}`,
    `mars:${mars}`,
    `positiveAspects:${aspects.positive}`,
    `tenseAspects:${aspects.tense}`,
    input.todayContext?.pulseTitle ? `todayPulse:${input.todayContext.pulseTitle}` : '',
    input.todayContext?.bestWindowLabel ? `todayBestWindow:${input.todayContext.bestWindowLabel}` : '',
    input.todayContext?.checkinCompleted ? 'todayCheckin:completed' : '',
    Number(input.todayContext?.recentActionCount || 0) > 0 ? `recentActions:${input.todayContext?.recentActionCount}` : '',
  ].filter(Boolean);

  const firstBody = {
    life: 'В новых знакомствах, рабочих разговорах и ситуациях, где нужно понять человека.',
    plus: 'Человек может много обещать, но делать мало. Ты быстро замечаешь разницу между словами и поступками.',
    risk: 'Тебя могут принять за закрытого человека, хотя ты просто присматриваешься.',
    action: 'Не пытайся сразу казаться удобным. Дай пару ясных сигналов, если человек тебе важен.',
  };

  const decisionBody = {
    life: 'В выборе работы, покупках, разговорах о будущем и любых решениях с последствиями.',
    plus: 'Если понятно, зачем это делать и что будет дальше, ты решаешь спокойнее и реже идёшь за чужим давлением.',
    risk: 'Когда вариантов слишком много, можно долго откладывать шаг и терять время.',
    action: 'Сократи выбор до двух-трёх вариантов и выпиши, что изменится после каждого решения.',
  };

  const communicationBody = {
    life: 'В переписке, переговорах, рабочих обсуждениях и разговорах, где люди говорят не всё прямо.',
    plus: 'Ты замечаешь, когда человек говорит одно, а ведёт себя по-другому. Это помогает не верить пустым обещаниям.',
    risk: 'Если долго молчать о том, что не устраивает, другой человек может даже не понять, где проблема.',
    action: 'Говори раньше и короче: что случилось, почему это важно и какое решение тебе подходит.',
  };

  const relationshipBody = {
    life: 'В дружбе, паре, семье и совместных деньгах, где важны договорённости и повторяющееся поведение.',
    plus: 'Ты лучше оцениваешь человека по поступкам, а не по красивым словам.',
    risk: 'Можно долго терпеть нарушение границ, а потом резко отдалиться.',
    action: 'Смотри на повторяющиеся поступки и проговаривай правила до того, как накопится злость.',
  };

  const blockersBody = {
    life: 'Когда задач много, сроки плавают, люди давят, а правила меняются по ходу дела.',
    plus: 'Ты рано замечаешь, что ситуация стала мутной, и можешь остановить лишний риск.',
    risk: 'Если пытаться закрыть всё сразу, внимание распадается и растёт раздражение.',
    action: 'Раздели список на три части: решить сегодня, перенести, отменить. Потом дай короткий ответ тем, кто ждёт.',
  };

  const strengthsBody = {
    life: 'В задачах, где нужны внимание к деталям, проверка условий, ответственность и понятный результат.',
    plus: 'Ты можешь заметить риск до того, как он станет проблемой для всех.',
    risk: 'Можно взять на себя слишком много проверок и начать исправлять чужую работу без договорённости.',
    action: 'Выбирай задачи, где ценят точность, анализ и качество. Не забирай чужую ответственность без прямой просьбы.',
  };

  return [
    card({
      id: 'first_impression',
      order: 1,
      title: 'Как ты ведёшь себя с новыми людьми',
      subtitle: 'Первый контакт',
      chips: ['сначала наблюдаешь', 'проверяешь доверие', 'сдержанный старт'],
      shortText: 'В новом общении ты не сразу показываешь отношение. Сначала смотришь, как человек ведёт себя и можно ли ему доверять.',
      body: firstBody,
      freeText: `Ты не сразу становишься открытым в общении. Сначала смотришь, как человек ведёт себя, насколько он честен и можно ли ему доверять.\n\n${bodyText(firstBody)}`,
      freeBullets: ['Главное: тебе не нужно сразу нравиться всем. Важнее понять, кто перед тобой.'],
      premiumBody: {
        work: 'На новой работе ты сначала изучаешь правила, людей и реальную власть в команде, а потом включаешься активнее.',
        relationships: 'В личном общении тебе важно видеть поступки, а не слушать обещания о том, каким человек хочет казаться.',
        money: 'Ты осторожнее относишься к решениям, которые покупают впечатление, но не дают понятной пользы.',
        recommendation: 'Показывай отношение простыми действиями: отвечай прямо, называй ожидания и не пропадай без объяснения.',
        why: `вывод учитывает первый контакт карты, Солнце в ${sun}, Луну в ${moon} и Асцендент в ${rising}.`,
      },
      premiumText: premiumText({
        work: 'На новой работе ты сначала изучаешь правила, людей и реальную власть в команде, а потом включаешься активнее.',
        relationships: 'В личном общении тебе важно видеть поступки, а не слушать обещания о том, каким человек хочет казаться.',
        money: 'Ты осторожнее относишься к решениям, которые покупают впечатление, но не дают понятной пользы.',
        recommendation: 'Показывай отношение простыми действиями: отвечай прямо, называй ожидания и не пропадай без объяснения.',
        why: `вывод учитывает первый контакт карты, Солнце в ${sun}, Луну в ${moon} и Асцендент в ${rising}.`,
      }),
      teaser: 'В полном разборе: как первое впечатление влияет на работу, отношения и доверие.',
      isPremiumLocked: false,
      sourceKeys: ['ascendant', 'firstImpressionTags', 'sun', 'dominantElements'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData, true),
      visualKey: 'hero_halo_portrait',
      assetKey: 'first-impression',
      primaryCta: { label: 'Разобрать дальше', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'inner_base',
      order: 2,
      title: 'Как ты принимаешь решения',
      subtitle: 'Выбор',
      chips: ['причины', 'последствия', 'личный выбор'],
      shortText: 'Тебе проще решать, когда понятны причины, последствия и зачем это вообще делать.',
      body: decisionBody,
      freeText: `Ты редко двигаешься просто потому, что «надо». Тебе важно понять причину, цену решения и что оно изменит.\n\n${bodyText(decisionBody)}`,
      freeBullets: ['Главное: сначала убери лишние варианты, потом выбирай между реальными действиями.'],
      premiumBody: {
        work: 'Лучше подходят задачи, где есть понятная цель, зона ответственности и возможность влиять на итог.',
        relationships: 'В отношениях хуже работают ультиматумы. Лучше, когда есть разговор о фактах и последствиях.',
        money: 'Импульсивные покупки легче остановить вопросом: что это решит через неделю?',
        recommendation: 'Перед важным выбором сравни не желания, а последствия: время, деньги, люди, обязательства.',
        why: `вывод собран по Солнцу в ${sun}, Луне в ${moon}, Меркурию в ${mercury} и общему стилю решений в карте.`,
      },
      premiumText: premiumText({
        work: 'Лучше подходят задачи, где есть понятная цель, зона ответственности и возможность влиять на итог.',
        relationships: 'В отношениях хуже работают ультиматумы. Лучше, когда есть разговор о фактах и последствиях.',
        money: 'Импульсивные покупки легче остановить вопросом: что это решит через неделю?',
        recommendation: 'Перед важным выбором сравни не желания, а последствия: время, деньги, люди, обязательства.',
        why: `вывод собран по Солнцу в ${sun}, Луне в ${moon}, Меркурию в ${mercury} и общему стилю решений в карте.`,
      }),
      teaser: 'В полном разборе: какие решения даются легче и где ты чаще тянешь время.',
      isPremiumLocked: false,
      sourceKeys: ['sun', 'moon', 'mercury', 'dominantElements'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_core_rings',
      assetKey: 'decisions',
      primaryCta: { label: 'Посмотреть примеры', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'strengths',
      order: 3,
      title: 'Как ты общаешься',
      subtitle: 'Разговоры',
      chips: ['по делу', 'видишь несостыковки', 'не любишь давление'],
      shortText: 'В разговоре ты быстро замечаешь, где слова расходятся с поступками. Давление и намёки работают хуже прямого разговора.',
      body: communicationBody,
      freeText: `Твой стиль общения лучше всего работает там, где люди говорят прямо и держат договорённости. Если тебя давят или заставляют угадывать, разговор быстро становится тяжёлым.\n\n${bodyText(communicationBody)}`,
      freeBullets: ['Главное: не жди, пока раздражение накопится. Скажи коротко, что именно не подходит.'],
      premiumBody: {
        work: 'В работе тебе подходят ясные роли, нормальные сроки и обсуждение по фактам, а не по настроению начальника.',
        relationships: 'В близком контакте важно, чтобы человек не заставлял тебя угадывать, что он имел в виду.',
        money: 'Перед общими расходами нужны правила: кто платит, когда возвращает, что считается нормальным.',
        recommendation: 'Используй короткую формулу: факт, влияние, просьба. Так меньше шансов уйти в долгие споры.',
        why: `вывод учитывает Меркурий в ${mercury}, Венеру в ${venus}, Марс в ${mars} и связи между личными планетами.`,
      },
      premiumText: premiumText({
        work: 'В работе тебе подходят ясные роли, нормальные сроки и обсуждение по фактам, а не по настроению начальника.',
        relationships: 'В близком контакте важно, чтобы человек не заставлял тебя угадывать, что он имел в виду.',
        money: 'Перед общими расходами нужны правила: кто платит, когда возвращает, что считается нормальным.',
        recommendation: 'Используй короткую формулу: факт, влияние, просьба. Так меньше шансов уйти в долгие споры.',
        why: `вывод учитывает Меркурий в ${mercury}, Венеру в ${venus}, Марс в ${mars} и связи между личными планетами.`,
      }),
      teaser: 'В полном разборе: стиль общения в работе, близости и спорных ситуациях.',
      isPremiumLocked: false,
      sourceKeys: ['communicationTags', 'mercury', 'venus', 'mars'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_strength_spark',
      assetKey: 'communication',
      primaryCta: { label: 'Разобрать общение', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'overload',
      order: 4,
      title: 'Как ты в отношениях',
      subtitle: 'Близкий контакт',
      chips: ['поступки важнее слов', 'доверие', 'границы'],
      shortText: 'В отношениях тебе важны поступки, понятные договорённости и уважение к границам.',
      body: relationshipBody,
      freeText: `Ты можешь долго терпеть, если человек важен. Но если договорённости нарушаются несколько раз, доверие резко падает.\n\n${bodyText(relationshipBody)}`,
      freeBullets: ['Главное: смотри не на обещания, а на поведение, которое повторяется.'],
      premiumBody: {
        work: 'В рабочих связках тебе легче с людьми, которые говорят прямо, фиксируют решения и не меняют правила без причины.',
        relationships: 'В паре важнее предсказуемые поступки, чем сильные слова после ошибки.',
        money: 'Общие финансы требуют прозрачности: суммы, сроки, обязанности и право сказать нет.',
        recommendation: 'Говори о границах до конфликта. Так меньше риска резко закрыть контакт после долгого терпения.',
        why: `вывод собран по Венере в ${venus}, Луне в ${moon}, Марсу в ${mars} и показателям партнёрского поведения.`,
      },
      premiumText: premiumText({
        work: 'В рабочих связках тебе легче с людьми, которые говорят прямо, фиксируют решения и не меняют правила без причины.',
        relationships: 'В паре важнее предсказуемые поступки, чем сильные слова после ошибки.',
        money: 'Общие финансы требуют прозрачности: суммы, сроки, обязанности и право сказать нет.',
        recommendation: 'Говори о границах до конфликта. Так меньше риска резко закрыть контакт после долгого терпения.',
        why: `вывод собран по Венере в ${venus}, Луне в ${moon}, Марсу в ${mars} и показателям партнёрского поведения.`,
      }),
      teaser: 'В полном разборе: доверие, конфликты, деньги в паре и правила нормального контакта.',
      isPremiumLocked: false,
      sourceKeys: ['relationshipTags', 'venus', 'moon', 'mars'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData, true),
      visualKey: 'hero_noise_fade',
      assetKey: 'relationships',
      primaryCta: { label: 'Перейти к отношениям', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'relationships',
      order: 5,
      title: 'Что тебя сбивает',
      subtitle: 'Помехи',
      chips: ['неопределённость', 'давление', 'хаос'],
      shortText: 'Тебя чаще сбивают неопределённость, давление, спешка и слишком много незакрытых дел.',
      body: blockersBody,
      freeText: `Проблема не всегда в количестве задач. Часто тяжелее то, что непонятно: кто отвечает, когда срок, чего от тебя ждут и что можно не делать.\n\n${bodyText(blockersBody)}`,
      freeBullets: ['Главное: сначала убери неопределённость, а уже потом пытайся ускоряться.'],
      premiumBody: {
        work: 'Тяжелее всего там, где много срочных запросов, но нет владельца задачи и ясного результата.',
        relationships: 'Мешают намёки, молчание и ожидание, что ты сам всё поймёшь.',
        money: 'На спешке выше риск купить лишнее или согласиться на неудобные условия.',
        recommendation: 'Не решай всё сразу. Сначала закрой один непонятный пункт, потом переходи к следующему.',
        why: `вывод учитывает напряжённые связи карты, Луну в ${moon}, Марс в ${mars} и реакцию на давление.`,
      },
      premiumText: premiumText({
        work: 'Тяжелее всего там, где много срочных запросов, но нет владельца задачи и ясного результата.',
        relationships: 'Мешают намёки, молчание и ожидание, что ты сам всё поймёшь.',
        money: 'На спешке выше риск купить лишнее или согласиться на неудобные условия.',
        recommendation: 'Не решай всё сразу. Сначала закрой один непонятный пункт, потом переходи к следующему.',
        why: `вывод учитывает напряжённые связи карты, Луну в ${moon}, Марс в ${mars} и реакцию на давление.`,
      }),
      teaser: 'В полном разборе: что чаще всего ломает планы и как не доводить до резкого срыва.',
      isPremiumLocked: false,
      sourceKeys: ['stressTags', 'overloadTags', 'moon', 'saturn', 'challengingAspects'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_dual_orbit',
      assetKey: 'blockers',
      primaryCta: { label: 'Что с этим делать', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'today_bridge',
      order: 6,
      title: 'Где у тебя получается лучше всего',
      subtitle: 'Сильные стороны',
      chips: ['детали', 'качество', 'ответственность'],
      shortText: 'Лучше всего у тебя получается замечать детали, держать внимание на важном и разбираться там, где другим хватает общего впечатления.',
      body: strengthsBody,
      freeText: `Ты полезен там, где цена ошибки заметна: договоры, качество, переговоры, проверка условий, сложные решения.\n\n${bodyText(strengthsBody)}`,
      freeBullets: ['Главное: выбирай задачи, где нужна точность, а не постоянная суета.'],
      premiumBody: {
        work: 'Подходят роли, где важны качество, анализ, ответственность и способность видеть последствия.',
        relationships: 'Помогает замечать не слова, а поступки, которые повторяются.',
        money: 'Полезно сравнивать условия и не покупать только из-за красивой подачи.',
        recommendation: 'Используй это как рабочий инструмент, но не превращайся в человека, который всё контролирует за других.',
        why: `вывод основан на сильных показателях карты, стиле действий и основных связях между планетами.`,
      },
      premiumText: premiumText({
        work: 'Подходят роли, где важны качество, анализ, ответственность и способность видеть последствия.',
        relationships: 'Помогает замечать не слова, а поступки, которые повторяются.',
        money: 'Полезно сравнивать условия и не покупать только из-за красивой подачи.',
        recommendation: 'Используй это как рабочий инструмент, но не превращайся в человека, который всё контролирует за других.',
        why: `вывод основан на сильных показателях карты, стиле действий и основных связях между планетами.`,
      }),
      teaser: 'В полном разборе: работа, деньги, отношения и задачи, где это даёт лучший результат.',
      isPremiumLocked: false,
      sourceKeys: ['strengthsTags', 'sun', 'mars', 'jupiter', 'positiveAspects'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_path_focus',
      assetKey: 'strengths',
      primaryCta: { label: 'Что мне подходит', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
  ];
}
