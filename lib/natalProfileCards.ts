import type { NatalChartData, PlanetPosition, ProfileCard, UserProfile } from '../types';

export const NATAL_PROFILE_CARDS_VERSION = 'profile_cards.v1';

type ElementKey = 'Fire' | 'Earth' | 'Air' | 'Water' | 'Neutral';
type ModalityKey = 'cardinal' | 'fixed' | 'mutable' | 'neutral';

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

const SIGN_ELEMENT: Record<string, ElementKey> = {
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
};

const SIGN_MODALITY: Record<string, ModalityKey> = {
  Aries: 'cardinal',
  Cancer: 'cardinal',
  Libra: 'cardinal',
  Capricorn: 'cardinal',
  Taurus: 'fixed',
  Leo: 'fixed',
  Scorpio: 'fixed',
  Aquarius: 'fixed',
  Gemini: 'mutable',
  Virgo: 'mutable',
  Sagittarius: 'mutable',
  Pisces: 'mutable',
};

const ELEMENT_COPY: Record<ElementKey, {
  persona: string;
  inner: string;
  strength: string;
  overload: string;
  base: string;
  chip: string;
}> = {
  Fire: {
    persona: 'живым, прямым и заметным',
    inner: 'много импульса, смелости и желания действовать',
    strength: 'быстро зажигаться и запускать движение там, где другие ещё сомневаются',
    overload: 'ощущение, что тебя тормозят, глушат или заставляют ждать без ясной причины',
    base: 'свобода действия, честный импульс и ощущение, что жизнь не стоит на паузе',
    chip: 'живой импульс',
  },
  Earth: {
    persona: 'собранным, надёжным и внимательным к реальности',
    inner: 'потребность в опоре, качестве и понятных шагах',
    strength: 'доводить важное до формы и не терять практический смысл',
    overload: 'хаос, спешка и решения, где нет почвы под ногами',
    base: 'ясная структура, нормальный темп и ощущение, что усилия дают результат',
    chip: 'устойчивая опора',
  },
  Air: {
    persona: 'лёгким в контакте, наблюдательным и быстрым на смыслы',
    inner: 'много мыслей, связей и потребность понимать, что происходит',
    strength: 'видеть варианты, договариваться и связывать людей или идеи',
    overload: 'информационный шум, бесконечные разговоры и отсутствие ясной точки',
    base: 'свежий воздух, честный диалог и пространство для выбора',
    chip: 'ясный взгляд',
  },
  Water: {
    persona: 'спокойным, глубоким и не сразу открытым',
    inner: 'тонкая чувствительность, память на детали и сильная эмоциональная настройка',
    strength: 'считывать атмосферу глубже слов и замечать то, что другие пропускают',
    overload: 'чужие эмоции, давление и слишком громкий фон вокруг',
    base: 'тишина, доверие и ощущение, что рядом можно быть настоящим',
    chip: 'глубокое чувство',
  },
  Neutral: {
    persona: 'живым, внимательным и многослойным',
    inner: 'сочетание чувствительности, силы и потребности в своём ритме',
    strength: 'собирать разные стороны себя в один ясный шаг',
    overload: 'слишком много задач, чужих ожиданий и лишнего шума',
    base: 'свой темп, честность с собой и понятная опора на день',
    chip: 'свой ритм',
  },
};

const MODALITY_COPY: Record<ModalityKey, { tempo: string; risk: string; chip: string }> = {
  cardinal: {
    tempo: 'тебе легче, когда есть первый шаг и понятное направление',
    risk: 'сложно долго оставаться в подвешенности',
    chip: 'нужен старт',
  },
  fixed: {
    tempo: 'тебе важно входить в процесс глубоко и не сбивать себя постоянными разворотами',
    risk: 'резкие перемены без подготовки могут быстро утомлять',
    chip: 'глубокий фокус',
  },
  mutable: {
    tempo: 'ты лучше раскрываешься там, где можно адаптироваться и менять маршрут',
    risk: 'слишком жёсткая рамка может забрать живость',
    chip: 'гибкий темп',
  },
  neutral: {
    tempo: 'тебе подходит темп, где есть и движение, и пауза',
    risk: 'перегруз начинается, когда всё требует внимания одновременно',
    chip: 'ровный ход',
  },
};

function compact(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function signLabel(sign?: string | null): string {
  const normalized = String(sign || '').trim();
  return SIGN_RU[normalized] || normalized || 'знак не определён';
}

function positionElement(position?: PlanetPosition | null): ElementKey {
  return SIGN_ELEMENT[String(position?.sign || '').trim()] || 'Neutral';
}

function positionModality(position?: PlanetPosition | null): ModalityKey {
  return SIGN_MODALITY[String(position?.sign || '').trim()] || 'neutral';
}

function listPositions(chartData: NatalChartData): PlanetPosition[] {
  return [
    chartData.sun,
    chartData.moon,
    chartData.rising,
    chartData.mercury,
    chartData.venus,
    chartData.mars,
    chartData.jupiter,
    chartData.saturn,
  ].filter((item): item is PlanetPosition => !!item?.sign);
}

function pickDominantElement(chartData: NatalChartData): ElementKey {
  const explicit = String(chartData.element || '').trim();
  if (explicit && explicit in ELEMENT_COPY) return explicit as ElementKey;
  const counts: Record<ElementKey, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0, Neutral: 0 };
  for (const position of listPositions(chartData)) {
    counts[positionElement(position)] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ElementKey) || 'Neutral';
}

function pickDominantModality(chartData: NatalChartData): ModalityKey {
  const counts: Record<ModalityKey, number> = { cardinal: 0, fixed: 0, mutable: 0, neutral: 0 };
  for (const position of listPositions(chartData)) {
    counts[positionModality(position)] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ModalityKey) || 'neutral';
}

function aspectCounts(chartData: NatalChartData) {
  const positive = (chartData.aspects || []).filter((aspect) => aspect.type === 'trine' || aspect.type === 'sextile').length;
  const tense = (chartData.aspects || []).filter((aspect) => aspect.type === 'square' || aspect.type === 'opposition').length;
  return { positive, tense };
}

function hasReliableBirthTime(profile: UserProfile, chartData: NatalChartData): boolean {
  const time = String(profile.birthTime || '').trim();
  return !!time && time !== '12:00' && !!chartData.rising?.sign && Array.isArray(chartData.houses) && chartData.houses.length >= 12;
}

function confidence(profile: UserProfile, chartData: NatalChartData, usesTimeSensitiveData = false): 'high' | 'medium' | 'low' {
  if (!usesTimeSensitiveData) return chartData.sun?.sign && chartData.moon?.sign ? 'high' : 'medium';
  return hasReliableBirthTime(profile, chartData) ? 'high' : 'low';
}

function nowIsEvening(input: NatalProfileCardsInput): boolean {
  const hour = input.todayContext?.localHour;
  if (typeof hour === 'number' && Number.isFinite(hour)) return hour >= 18;
  const tz = input.chartData.timezone || 'Europe/Moscow';
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    const parsed = Number.parseInt(formatted, 10);
    return Number.isFinite(parsed) ? parsed >= 18 : false;
  } catch {
    return new Date().getUTCHours() + 3 >= 18;
  }
}

function card(params: ProfileCard): ProfileCard {
  return {
    ...params,
    title: compact(params.title),
    subtitle: params.subtitle ? compact(params.subtitle) : undefined,
    chips: params.chips.map(compact).filter(Boolean).slice(0, 3),
    shortText: compact(params.shortText),
    freeText: compact(params.freeText),
    premiumText: params.premiumText ? compact(params.premiumText) : undefined,
    freeBullets: params.freeBullets?.map(compact).filter(Boolean),
    premiumBullets: params.premiumBullets?.map(compact).filter(Boolean),
    teaser: params.teaser ? compact(params.teaser) : undefined,
  };
}

export function buildNatalProfileCards(input: NatalProfileCardsInput): ProfileCard[] {
  const { profile, chartData } = input;
  const element = pickDominantElement(chartData);
  const modality = pickDominantModality(chartData);
  const elementCopy = ELEMENT_COPY[element];
  const modalityCopy = MODALITY_COPY[modality];
  const aspects = aspectCounts(chartData);
  const sun = signLabel(chartData.sun?.sign);
  const moon = signLabel(chartData.moon?.sign);
  const rising = signLabel(chartData.rising?.sign);
  const venusElement = ELEMENT_COPY[positionElement(chartData.venus)];
  const mercuryElement = ELEMENT_COPY[positionElement(chartData.mercury)];
  const evening = nowIsEvening(input);
  const todayPrimaryText = compact(input.todayContext?.shortText || input.todayContext?.pulseSummary || '');
  const todayBestWindow = compact(input.todayContext?.bestWindowLabel || '');
  const todayCheckInCompleted = input.todayContext?.checkinCompleted === true;
  const todayActionCount = Number(input.todayContext?.recentActionCount ?? 0);

  const sourceDebugBase = [
    `sun:${sun}`,
    `moon:${moon}`,
    `rising:${rising}`,
    `dominantElement:${element}`,
    `dominantModality:${modality}`,
    `positiveAspects:${aspects.positive}`,
    `tenseAspects:${aspects.tense}`,
    input.todayContext?.pulseTitle ? `todayPulse:${input.todayContext.pulseTitle}` : '',
    todayBestWindow ? `todayBestWindow:${todayBestWindow}` : '',
    todayCheckInCompleted ? 'todayCheckin:completed' : '',
    todayActionCount > 0 ? `recentActions:${todayActionCount}` : '',
  ].filter(Boolean);

  return [
    card({
      id: 'first_impression',
      order: 1,
      title: 'Ты с первого взгляда',
      subtitle: 'Как тебя видят мир',
      chips: [elementCopy.chip, modalityCopy.chip, hasReliableBirthTime(profile, chartData) ? 'точный образ' : 'мягкий образ'],
      shortText: `Со стороны ты можешь казаться ${elementCopy.persona}. А глубже чувствуется ${elementCopy.inner}.`,
      freeText:
        `Первое впечатление о тебе складывается не из одного жеста, а из общего ритма карты. В нём заметно, что снаружи ты можешь выглядеть ${elementCopy.persona}. Но чем ближе человек подходит, тем яснее становится другое: внутри у тебя есть ${elementCopy.inner}. ${modalityCopy.tempo}.`,
      premiumText:
        `В полном слое этот образ раскрывается через разные контексты: как тебя считывают в работе, в близком общении и в новых компаниях. Иногда люди могут видеть только внешнюю часть — ${elementCopy.persona}. Но твоя настоящая сила проявляется, когда есть доверие, нормальный темп и возможность не играть роль.`,
      freeBullets: ['Снаружи ты можешь выглядеть иначе, чем чувствуешь себя внутри.', modalityCopy.tempo],
      premiumBullets: ['Как тебя могут понять неправильно при первом контакте.', 'Где твоя естественная заметность работает сильнее всего.'],
      teaser: 'Ещё внутри: как тебя считывают в работе и почему ты не открываешься с порога.',
      isPremiumLocked: false,
      sourceKeys: ['rising', 'sun', 'dominant_element', 'dominant_modality'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData, true),
      visualKey: 'hero_halo_portrait',
      primaryCta: { label: 'Читать глубже', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'inner_base',
      order: 2,
      title: 'Твоя внутренняя опора',
      subtitle: 'Что для тебя база',
      chips: [elementCopy.base.split(',')[0], 'свой ритм', modalityCopy.chip],
      shortText: `Тебе важно не просто делать, а понимать зачем. Внутренняя опора включается через ${elementCopy.base}.`,
      freeText:
        `Твоя база — это не гонка и не попытка быть удобной версией себя. По карте видно, что тебе нужна опора: ${elementCopy.base}. Когда это есть, становится легче выбирать, не распыляться и возвращаться к себе. ${modalityCopy.tempo}.`,
      premiumText:
        `Глубже этот слой показывает, что именно стабилизирует тебя в работе, в отношениях и в повседневном ритме. Тебе важно замечать моменты, где ты начинаешь жить на чужой скорости. Там быстрее всего теряется интерес и появляется усталость.`,
      freeBullets: ['Опора появляется, когда есть ясное зачем.', 'Свой темп важнее внешней гонки.'],
      premiumBullets: ['Что быстрее всего возвращает тебя в устойчивость.', 'Где ты теряешь интерес, если долго идёшь не своим маршрутом.'],
      teaser: 'Ещё внутри: что даёт тебе опору и где ты быстрее всего теряешь интерес.',
      isPremiumLocked: false,
      sourceKeys: ['sun', 'moon', 'dominant_element', 'dominant_modality'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_core_rings',
      primaryCta: { label: 'Понять свою базу', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'strengths',
      order: 3,
      title: 'В чём твоя сила',
      subtitle: 'Твои ресурсы',
      chips: [elementCopy.chip, aspects.positive > 2 ? 'легко соединяешь' : 'видишь нюансы', 'держишь качество'],
      shortText: `Твоя сильная сторона — ${elementCopy.strength}. Это работает лучше без лишнего шума и давления.`,
      freeText:
        `Сильная сторона твоей карты — ${elementCopy.strength}. Это не обязательно выглядит громко. Чаще сила проявляется в том, как ты выбираешь момент, замечаешь детали и не теряешь главное, когда вокруг много лишнего.`,
      premiumText:
        `В полном разборе этот ресурс раскладывается по жизненным сферам: где он помогает в работе, как проявляется в близких отношениях и почему иногда ты можешь считать его чем-то обычным, хотя для других это заметная ценность.`,
      freeBullets: ['Сила не обязана быть громкой, чтобы быть заметной.', 'Тебе полезно выбирать один фокус вместо десяти направлений.'],
      premiumBullets: ['Как использовать эту силу в работе и делах.', 'Где чувствительность становится преимуществом, а не перегрузом.'],
      teaser: 'Ещё внутри: где твоя чувствительность — суперсила, а не слишком много.',
      isPremiumLocked: !input.isPremium,
      sourceKeys: ['mars', 'jupiter', 'positive_aspects', 'dominant_element'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_strength_spark',
      primaryCta: { label: 'Открыть сильные стороны', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'overload',
      order: 4,
      title: 'Что может сбивать',
      subtitle: 'Твои вызовы',
      chips: ['перегруз', element === 'Water' ? 'чужие эмоции' : element === 'Air' ? 'инфошум' : 'давление', 'нужно пространство'],
      shortText: `Тебя чаще выбивает не сама нагрузка, а ${elementCopy.overload}. Важно замечать это раньше.`,
      freeText:
        `Точка перегруза в твоей карте связана с темой: ${elementCopy.overload}. Когда этого становится слишком много, может пропадать ясность, включается усталость или желание отойти в сторону. ${modalityCopy.risk}.`,
      premiumText:
        `В глубоком слое LUMIA показывает ранние сигналы перегруза и мягкий способ выйти из него: что убрать первым, какой контакт отложить, где не давить на себя и как вернуться к одному посильному шагу.`,
      freeBullets: ['Первый сигнал перегруза лучше замечать до резкого отката.', modalityCopy.risk],
      premiumBullets: ['Сигналы перегруза за 24 часа.', 'Короткий план выхода без рывка и самодавления.'],
      teaser: 'Ещё внутри: как понять, что ты уже на пределе — до того, как сорвёшься.',
      isPremiumLocked: !input.isPremium,
      sourceKeys: ['moon', 'saturn', 'tense_aspects', 'dominant_element'],
      sourceDebug: sourceDebugBase,
      confidence: confidence(profile, chartData),
      visualKey: 'hero_noise_fade',
      primaryCta: { label: 'Как себя беречь', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'relationships',
      order: 5,
      title: 'Как тебе с людьми',
      subtitle: 'Контакт и близость',
      chips: ['без игр', 'важно доверие', positionElement(chartData.venus) === 'Air' ? 'нужен диалог' : 'свой темп'],
      shortText:
        `В контакте тебе важны честность и нормальные границы. Лучше работает спокойная искренность, а не игры и давление.`,
      freeText:
        `В отношениях и общении у тебя лучше работает контакт без лишних игр. По связке личных показателей видно: тебе важно, чтобы рядом было достаточно доверия, воздуха и ясности. ${venusElement.base}. А в разговоре помогает ${mercuryElement.chip}.`,
      premiumText:
        `Глубокий слой показывает красные и зелёные флаги: с кем тебе легко раскрыться, где ты закрываешься раньше времени и какой формат общения помогает не терять себя рядом с другими.`,
      freeBullets: ['Тебе важна искренность без давления.', 'Поверхностный контакт быстро теряет смысл.'],
      premiumBullets: ['Красные и зелёные флаги в контакте.', 'Как с тобой лучше общаться в дружбе, любви и работе.'],
      teaser: 'Ещё внутри: как с тобой лучше общаться и что ты считываешь быстрее слов.',
      isPremiumLocked: !input.isPremium,
      sourceKeys: ['venus', 'mercury', 'rising', 'relationships_vector'],
      sourceDebug: [...sourceDebugBase, `venusElement:${positionElement(chartData.venus)}`, `mercuryElement:${positionElement(chartData.mercury)}`],
      confidence: confidence(profile, chartData, true),
      visualKey: 'hero_dual_orbit',
      primaryCta: { label: 'Как с тобой лучше общаться', action: 'read_deeper' },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
    card({
      id: 'today_bridge',
      order: 6,
      title: 'Как использовать это сегодня',
      subtitle: 'Карта сегодня',
      chips: ['сегодня', 'одно главное', evening ? 'вечером отметь' : 'поймай фокус'],
      shortText:
        todayPrimaryText ||
        'Этот портрет полезен не в теории, а в одном точном шаге сегодня и коротком check-in вечером.',
      freeText:
        `Самый полезный способ использовать карту сегодня — не пытаться быть всем сразу. ${todayPrimaryText ? `${todayPrimaryText} ` : ''}Выбери одно главное дело, оставь место для нормального темпа и ${evening ? 'вечером отметь, что реально сработало' : 'вернись к Today, чтобы поймать лучший фокус дня'}.${todayBestWindow ? ` Сейчас в Today уже есть ориентир: ${todayBestWindow}.` : ''}${todayCheckInCompleted ? ' Сегодняшняя отметка уже сохранена, поэтому можно спокойно забрать один вывод на завтра.' : ''}`,
      premiumText:
        `В Premium этот слой связывает постоянный портрет с текущим днём: где лучше действовать, где не перегружаться и какой вечерний check-in поможет LUMIA точнее видеть твой личный ритм.`,
      freeBullets: [
        todayBestWindow ? `Ориентир дня: ${todayBestWindow}.` : 'Один точный шаг лучше гонки.',
        todayCheckInCompleted
          ? 'Check-in уже сохранён, можно вернуться к выводам.'
          : evening
            ? 'Вечерний check-in поможет заметить повторения.'
            : 'Today покажет, где сейчас лучший фокус.',
      ],
      premiumBullets: ['Личные утренние и вечерние подсказки.', 'Связь карты с текущим ритмом дня.'],
      teaser: 'Ещё внутри: как сделать так, чтобы карта работала вместе с твоим днём.',
      isPremiumLocked: false,
      sourceKeys: ['today_context', 'dominant_element', 'profile_rhythm'],
      sourceDebug: sourceDebugBase,
      confidence: todayPrimaryText ? 'high' : 'medium',
      visualKey: 'hero_path_focus',
      primaryCta: {
        label: evening ? 'Отметить день' : 'Открыть Сегодня',
        action: evening ? 'open_checkin' : 'open_today',
        deepLink: evening ? '?view=dashboard&todaySection=checkin' : '?view=dashboard&todaySection=pulse',
      },
      secondaryCta: { label: 'Сохранить', action: 'save_card' },
    }),
  ];
}
