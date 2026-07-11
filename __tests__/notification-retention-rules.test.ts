import {
  buildNotificationDeepLink,
  findForbiddenNotificationTerms,
  renderNotificationTemplate,
} from '../lib/notificationEngineRules';
import {
  detectUserSegments,
  pickRetentionCandidate,
  type PersonalizationContext,
} from '../services/notificationRetentionService';

function makeContext(overrides: Partial<PersonalizationContext> = {}): PersonalizationContext {
  const base: PersonalizationContext = {
    user: {
      id: 'u1',
      name: 'Misha',
      birthDate: '1990-01-01',
      birthTime: '12:00',
      birthPlace: 'Moscow',
      premiumUntil: null,
      lastLogin: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      language: 'ru',
      chartId: 1,
      chartTimezone: 'Europe/Moscow',
      hasPrimaryChart: true,
    },
    timezone: 'Europe/Moscow',
    localDate: '2026-05-22',
    localTime: '09:30',
    localHour: 9,
    isPremium: false,
    isBirthdayToday: false,
    premiumDaysLeft: null,
    hasBirthDate: true,
    hasBirthTime: true,
    hasBirthPlace: true,
    hasPrimaryChart: true,
    dailyAstroSignal: null,
    preparedDailyCard: {
      theme: 'Разговоры',
      summary: 'Лучше говорить коротко и по делу.',
      loveText: 'Смотри на поступки.',
      workText: 'Выбери одну задачу.',
      moneyText: 'Сравни варианты.',
      cautionText: 'Не спорь на эмоциях.',
      adviceText: 'Сначала сформулируй одну мысль.',
    },
    recentScreens: [],
    lockedBlockEvents: 0,
    daysInactive: 0,
    daysWithoutClick: 0,
    ignoredLastCount: 0,
    daysSinceLastSent: 999,
    notificationsSentToday: 0,
    typesUsedToday: [],
    hasPending: false,
    lastNotificationType: null,
    lastTemplateId: null,
    preferences: {
      enabled: true,
      daily_card: true,
      love: true,
      money: true,
      work: true,
      natal: true,
      premium: true,
      synastry: true,
      evening_summary: true,
    },
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    interests: { love: 0, money: 0, work: 0, synastry: 0, natal: 0 },
    segments: ['daily_active_free'],
  };
  return { ...base, ...overrides } as PersonalizationContext;
}

const enabledScenarios = [
  { id: 1, key: 'birth_data_missing', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 2, key: 'birth_time_missing', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 3, key: 'daily_card', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 4, key: 'inactive_7d', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 5, key: 'premium', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 72, deep_link: '' },
  { id: 6, key: 'love', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 7, key: 'natal_free', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
  { id: 8, key: 'synastry', enabled: true, priority: 10, max_per_day: 1, cooldown_hours: 20, deep_link: '' },
];

describe('retention notification rules', () => {
  it('rejects horoscope fog and empty push copy', () => {
    expect(findForbiddenNotificationTerms('Зайди в приложение, твой гороскоп готов')).toEqual(
      expect.arrayContaining(['зайди\\s+в\\s+приложение', 'твой\\s+гороскоп\\s+готов'])
    );
    expect(findForbiddenNotificationTerms('Сегодня магическая энергия откроет портал удачи')).toEqual(
      expect.arrayContaining(['магическ', 'энергия', 'портал', 'удач[аиуе]'])
    );
    expect(findForbiddenNotificationTerms('Сегодня лучше не писать на эмоциях. Сначала сформулируй одну мысль.')).toHaveLength(0);
  });

  it('renders retention variables and builds tracked deep links', () => {
    const rendered = renderNotificationTemplate(
      {
        title: '{{daily_theme}}',
        body: '{{daily_summary}}\n{{pulse_window}}\n{{best_action}}\n{{avoid_action}}\n{{interest_topic}}\n{{locked_topic}}\n{{days_inactive}}\n{{unfinished_action}}',
        buttonText: 'Открыть',
      },
      {
        daily_theme: 'Разговоры',
        daily_summary: 'Лучше говорить коротко и по делу.',
        pulse_window: '14:00-16:00',
        best_action: 'одна задача',
        avoid_action: 'спор',
        interest_topic: 'работа',
        locked_topic: 'отношения',
        days_inactive: 7,
        unfinished_action: 'добавить время рождения',
      }
    );

    expect(rendered.title).toBe('Разговоры');
    expect(rendered.body).toContain('14:00-16:00');
    expect(rendered.body).toContain('добавить время рождения');

    const url = buildNotificationDeepLink({
      baseUrl: 'https://app.lumia.example/start',
      section: 'daily_card',
      scenarioKey: 'daily_card',
      notificationId: 77,
      campaignId: 15,
      segment: 'daily_active_free',
      variant: 'b',
    });

    expect(url).toContain('screen=daily_card');
    expect(url).toContain('notification_id=77');
    expect(url).toContain('campaign_id=15');
    expect(url).toContain('source=tg_notification');
    expect(url).toContain('segment=daily_active_free');
    expect(url).toContain('variant=b');
  });

  it('detects required retention segments', () => {
    expect(
      detectUserSegments(
        makeContext({
          hasBirthDate: false,
          hasBirthPlace: false,
          hasPrimaryChart: false,
          segments: [],
        })
      )
    ).toContain('new_user_no_birth_data');

    expect(
      detectUserSegments(
        makeContext({
          hasBirthTime: false,
          segments: [],
        })
      )
    ).toContain('birth_data_no_time');

    const active = detectUserSegments(
      makeContext({
        recentScreens: ['chart', 'love', 'love', 'money'],
        lockedBlockEvents: 2,
        interests: { love: 2, money: 1, work: 0, synastry: 0, natal: 0 },
        segments: [],
      })
    );
    expect(active).toEqual(expect.arrayContaining(['free_natal_opened_no_premium', 'love_interested', 'high_intent_premium']));
    expect(active).not.toContain('assistant_user');
  });

  it('treats a daily-active premium user as active, never inactive_*', () => {
    const segments = detectUserSegments(
      makeContext({ isPremium: true, daysInactive: 0, segments: [] })
    );
    expect(segments).toContain('daily_active_premium');
    expect(segments).not.toContain('inactive_2_days');
    expect(segments).not.toContain('inactive_7_days');
    expect(segments).not.toContain('inactive_14_days');
  });

  it('applies quiet hours, daily limits and setup priority', () => {
    expect(pickRetentionCandidate(makeContext({ localTime: '23:10', localHour: 23 }), enabledScenarios as any)).toBeNull();
    expect(pickRetentionCandidate(makeContext({ notificationsSentToday: 2 }), enabledScenarios as any)).toBeNull();
    // Уже есть неотправленный пуш в очереди → новый сейчас не ставим (наполняем по одному в такт отправке).
    expect(pickRetentionCandidate(makeContext({ hasPending: true, localHour: 9 }), enabledScenarios as any)).toBeNull();

    const setupContext = makeContext({
      hasBirthDate: false,
      hasBirthPlace: false,
      hasPrimaryChart: false,
      segments: ['new_user_no_birth_data'],
    });
    expect(pickRetentionCandidate(setupContext, enabledScenarios as any)?.type).toBe('birth_data_missing');
  });

  it('gives premium up to 4/day and routes them to UNEXPLORED premium features', () => {
    const premiumAfternoon = (over: Partial<PersonalizationContext> = {}) =>
      makeContext({
        isPremium: true,
        localTime: '14:00',
        localHour: 14,
        hasPrimaryChart: true,
        recentScreens: [],
        interests: { love: 0, money: 0, work: 0, synastry: 0, natal: 0 },
        ...over,
      });

    // Премиум-лимит теперь 4: на 3-м пуше ещё можно, на 4-м — стоп.
    expect(pickRetentionCandidate(premiumAfternoon({ notificationsSentToday: 3 }), enabledScenarios as any)).not.toBeNull();
    expect(pickRetentionCandidate(premiumAfternoon({ notificationsSentToday: 4 }), enabledScenarios as any)).toBeNull();

    // Днём премиуму, не открывавшему премиум-функции, предлагаем ФУНКЦИЮ (натальный разбор приоритетнее),
    // а не рутинную сферу.
    const picked = pickRetentionCandidate(premiumAfternoon(), enabledScenarios as any,
      ['love', 'natal_free', 'synastry']);
    expect(picked?.type).toBe('natal_free');

    // Побывал в карте → промо разбора отключается, слот уходит следующей неоткрытой premium-функции.
    const afterNatal = pickRetentionCandidate(
      premiumAfternoon({ interests: { love: 0, money: 0, work: 0, synastry: 0, natal: 5 } }),
      enabledScenarios as any, ['love', 'natal_free', 'synastry']);
    expect(afterNatal?.type).toBe('synastry');
  });

  it('keeps the daily anchor for active users but suppresses recently opened non-anchor sections', () => {
    // Дневной гороскоп (якорь) НЕ отменяется тем, что юзер только что заходил на главную —
    // активные (в т.ч. владелец, постоянно в приложении) тоже должны получать утренний пуш.
    expect(
      pickRetentionCandidate(
        makeContext({ recentScreens: ['today', 'daily_card'], localHour: 9 }),
        enabledScenarios as any,
        ['daily_card']
      )?.type
    ).toBe('daily_card');

    // Не-якорная сфера, недавно открытая, по-прежнему подавляется (не дублируем то, что смотрят).
    expect(
      pickRetentionCandidate(
        makeContext({ isPremium: true, localTime: '14:00', localHour: 14, recentScreens: ['love'] }),
        enabledScenarios as any,
        ['love']
      )
    ).toBeNull();
    // …а без недавнего открытия премиум-юзер получает дневную сферу без порога интересов.
    expect(
      pickRetentionCandidate(
        makeContext({ isPremium: true, localTime: '14:00', localHour: 14, recentScreens: [] }),
        enabledScenarios as any,
        ['love']
      )?.type
    ).toBe('love');

    // Тип, уже отправленный сегодня, пропускается — планировщик переходит к следующему.
    expect(
      pickRetentionCandidate(
        makeContext({ isPremium: true, localTime: '14:00', localHour: 14, typesUsedToday: ['love'] }),
        enabledScenarios as any,
        ['love']
      )
    ).toBeNull();

    const inactive = makeContext({
      localTime: '11:00',
      localHour: 11,
      daysInactive: 8,
      ignoredLastCount: 5,
      segments: ['inactive_7_days'],
    });
    expect(pickRetentionCandidate(inactive, enabledScenarios as any, ['inactive_7d'])?.type).toBe('inactive_7d');
  });

  it('never mutes an ACTIVE user for ignoring push buttons (owner bug: 5 sent without click = permanent silence)', () => {
    // Активный юзер (заходит в приложение каждый день) не кликает кнопки пушей — открывает апп сам.
    // Раньше после 5 отправленных без клика он замолкал НАВСЕГДА: новых пушей нет → кликнуть нечего.
    const activeIgnorer = makeContext({
      localTime: '09:30',
      localHour: 9,
      daysInactive: 0,
      ignoredLastCount: 5,
      daysSinceLastSent: 1,
      segments: ['daily_active_free'],
    });
    expect(pickRetentionCandidate(activeIgnorer, enabledScenarios as any, ['daily_card'])?.type).toBe('daily_card');
  });

  it('throttles a truly disengaged ignorer to at most one push per week', () => {
    const deadIgnorer = (daysSinceLastSent: number) =>
      makeContext({
        localTime: '11:00',
        localHour: 11,
        daysInactive: 8,
        ignoredLastCount: 5,
        daysSinceLastSent,
        segments: ['inactive_7_days'],
      });
    // Игнорирует пуши И не ходит в приложение, последний пуш 2 дня назад → пауза (не спамим ежедневно).
    expect(pickRetentionCandidate(deadIgnorer(2), enabledScenarios as any, ['inactive_7d'])).toBeNull();
    // Прошла неделя — одна реактивационная попытка снова разрешена.
    expect(pickRetentionCandidate(deadIgnorer(8), enabledScenarios as any, ['inactive_7d'])?.type).toBe('inactive_7d');
  });
});
