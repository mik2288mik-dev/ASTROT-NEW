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
    todayPulse: null,
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
    notificationsSentToday: 0,
    lastNotificationType: null,
    lastTemplateId: null,
    preferences: {
      enabled: true,
      daily_card: true,
      pulse_day: true,
      love: true,
      money: true,
      work: true,
      assistant: true,
      natal: true,
      premium: true,
      synastry: true,
      evening_summary: true,
    },
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    interests: { love: 0, money: 0, work: 0, assistant: 0, synastry: 0 },
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
        recentScreens: ['chart', 'love', 'love', 'money', 'assistant', 'assistant'],
        lockedBlockEvents: 2,
        interests: { love: 2, money: 1, work: 0, assistant: 2, synastry: 0 },
        segments: [],
      })
    );
    expect(active).toEqual(expect.arrayContaining(['free_natal_opened_no_premium', 'love_interested', 'assistant_user', 'high_intent_premium']));
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

    const setupContext = makeContext({
      hasBirthDate: false,
      hasBirthPlace: false,
      hasPrimaryChart: false,
      segments: ['new_user_no_birth_data'],
    });
    expect(pickRetentionCandidate(setupContext, enabledScenarios as any)?.type).toBe('birth_data_missing');
  });

  it('does not repeat recently opened sections and lets inactive chains through', () => {
    expect(
      pickRetentionCandidate(
        makeContext({ recentScreens: ['today'], localHour: 9 }),
        enabledScenarios as any,
        ['daily_card']
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
});
