import {
  buildNotificationDeepLink,
  effectiveDailyLimit,
  effectiveMinIntervalHours,
  findForbiddenNotificationTerms,
  findUnknownNotificationVariables,
  isWithinQuietHours,
  pickBestScenario,
  renderNotificationTemplate,
} from '../lib/notificationEngineRules';

describe('notification engine rules', () => {
  it('blocks heavy astrology wording in admin templates', () => {
    expect(findForbiddenNotificationTerms('Сегодня активен 2 дом и транзит важный')).toHaveLength(2);
    expect(findForbiddenNotificationTerms('Луна касается Венеры, проверь аспекты')).toHaveLength(2);
    expect(findForbiddenNotificationTerms('Сегодня лучше без гонки')).toHaveLength(0);
  });

  it('detects unknown variables and renders fallbacks', () => {
    expect(findUnknownNotificationVariables('Привет {{first_name}}, {{unknown_value}}')).toEqual(['unknown_value']);

    const rendered = renderNotificationTemplate(
      {
        title: 'Сегодня: {{main_title}}',
        body: 'Слот: {{best_slot_from}}-{{best_slot_to}}\n{{missing_ok}}',
        buttonText: 'Открыть {{first_name}}',
      },
      {
        first_name: 'Аня',
        main_title: 'лучше спокойно',
        best_slot_from: '14:00',
      },
      {
        best_slot_to: '16:00',
      }
    );

    expect(rendered.title).toBe('Сегодня: лучше спокойно');
    expect(rendered.body).toBe('Слот: 14:00-16:00');
    expect(rendered.buttonText).toBe('Открыть Аня');
  });

  it('picks the highest priority matching scenario', () => {
    const context = {
      localTime: '13:35',
      dayPart: 'day' as const,
      minutesToBestSlot: 25,
      hasBestSlot: true,
      hasPatternProgress: false,
      userState: {
        openedToday: false,
        acceptedFocusToday: false,
        completedCheckinYesterday: true,
        checkinStreak: 2,
        daysWithoutClick: 1,
      },
    };

    const picked = pickBestScenario(
      [
        {
          key: 'day_not_opened_reminder',
          dayPart: 'day' as const,
          priority: 30,
          timeWindowStart: '12:00',
          timeWindowEnd: '17:30',
          triggerRuleJson: { openedToday: false },
        },
        {
          key: 'day_slot_starting_soon',
          dayPart: 'day' as const,
          priority: 80,
          timeWindowStart: '12:00',
          timeWindowEnd: '17:30',
          triggerRuleJson: { requiresBestSlot: true, minutesToSlotMax: 40 },
        },
      ],
      context
    );

    expect(picked.scenario?.key).toBe('day_slot_starting_soon');
  });

  it('applies quiet hours and inactivity frequency gates', () => {
    expect(isWithinQuietHours('23:10', '22:30', '08:00')).toBe(true);
    expect(isWithinQuietHours('07:50', '22:30', '08:00')).toBe(true);
    expect(isWithinQuietHours('12:30', '22:30', '08:00')).toBe(false);
    expect(effectiveDailyLimit(0, 3)).toBe(3);
    expect(effectiveDailyLimit(3, 3)).toBe(1);
    expect(effectiveDailyLimit(7, 3)).toBe(1);
    expect(effectiveMinIntervalHours(1, 4)).toBe(4);
    expect(effectiveMinIntervalHours(7, 4)).toBe(72);
  });

  it('builds attributed WebApp deep links to concrete sections', () => {
    const url = buildNotificationDeepLink({
      baseUrl: 'https://app.lumia.example/start',
      section: 'checkin',
      scenarioKey: 'evening_checkin',
      logId: 42,
    });

    expect(url).toContain('view=dashboard');
    expect(url).toContain('todaySection=checkin');
    expect(url).toContain('source=tg_notification');
    expect(url).toContain('scenario=evening_checkin');
    expect(url).toContain('nl=42');
  });
});
