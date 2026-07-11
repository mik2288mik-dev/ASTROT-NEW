import { extractPersonalizationPrivacyFlags, logger, sanitizeLogEvent } from '../lib/logger';
import { logContentApi } from '../lib/contentApiLogging';

function captureLogLine(fn: () => void): string {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    fn();
    expect(spy).toHaveBeenCalled();
    return String(spy.mock.calls[0]?.[0] || '');
  } finally {
    spy.mockRestore();
  }
}

describe('logger privacy', () => {
  it('redacts sensitive metadata fields', () => {
    const sanitized = sanitizeLogEvent({
      scope: 'test',
      event: 'privacy_check',
      metadata: {
        question: 'What will happen to my relationship tomorrow?',
        answer: 'The stars suggest patience.',
        birthDate: '1989-03-06',
        birthPlace: 'Moscow, Russia',
        chartContext: 'Sun: Pisces\nBirth date: 1989-03-06',
        personalizationContext: { user: { birthDate: '1989-03-06' } },
        partnerData: { partnerBirthDate: '1990-01-01', partnerName: 'Alex' },
        history: [{ role: 'user', text: 'secret' }],
      },
    });

    expect(JSON.stringify(sanitized.metadata)).not.toContain('1989-03-06');
    expect(JSON.stringify(sanitized.metadata)).not.toContain('Moscow');
    expect(JSON.stringify(sanitized.metadata)).not.toContain('relationship tomorrow');
    expect(JSON.stringify(sanitized.metadata)).not.toContain('stars suggest');
    expect(JSON.stringify(sanitized.metadata)).not.toContain('Alex');
    expect(sanitized.metadata?.question).toBe('[redacted]');
    expect(sanitized.metadata?.answer).toBe('[redacted]');
    expect(sanitized.metadata?.birthDate).toBe('[redacted]');
    expect(sanitized.metadata?.birthPlace).toBe('[redacted]');
    expect(sanitized.metadata?.chartContext).toBe('[redacted]');
    expect(sanitized.metadata?.personalizationContext).toBe('[redacted]');
    expect(sanitized.metadata?.partnerData).toBe('[redacted]');
  });

  it('allows safe personalization flags in metadata', () => {
    const flags = extractPersonalizationPrivacyFlags({
      user: {
        birthDate: '1989-03-06',
        birthTime: '14:30',
        birthPlace: 'Moscow',
      },
      chartData: { sun: { sign: 'Pisces' } },
      chartQuality: { birthTimeQuality: 'exact' },
      dailyAstroSignal: { source: 'swisseph', calculationVersion: 'daily-astro-signal-v1' },
      recentCheckIns: [{ date: '2026-05-29' }],
      recentQuestions: [{ question: 'hidden' }],
      relationshipContext: [{ summary: 'hidden' }],
    });

    const sanitized = sanitizeLogEvent({
      scope: 'test',
      event: 'flags_check',
      metadata: flags,
    });

    const serialized = JSON.stringify(sanitized.metadata);
    expect(serialized).toContain('"hasBirthDate":true');
    expect(serialized).toContain('"hasBirthTime":true');
    expect(serialized).toContain('"hasBirthPlace":true');
    expect(serialized).toContain('"hasChart":true');
    expect(serialized).toContain('"hasDailyAstroSignal":true');
    expect(serialized).toContain('"hasCheckIns":true');
    expect(serialized).toContain('"hasRecentQuestions":true');
    expect(serialized).toContain('"hasRelationshipContext":true');
    expect(serialized).toContain('"birthTimeQuality":"exact"');
    expect(serialized).toContain('"source":"swisseph"');
    expect(serialized).toContain('"calculationVersion":"daily-astro-signal-v1"');
    expect(serialized).not.toContain('1989-03-06');
    expect(serialized).not.toContain('Moscow');
    expect(serialized).not.toContain('hidden');
  });

  it('does not emit raw sensitive values through logger.info', () => {
    const line = captureLogLine(() => {
      logger.info({
        scope: 'ask-lumia',
        event: 'test_emit',
        metadata: {
          question: 'Should I change jobs this month?',
          answer: 'Yes, after the full moon.',
          birthDate: '1985-12-01',
        },
      });
    });

    expect(line).not.toContain('Should I change jobs');
    expect(line).not.toContain('full moon');
    expect(line).not.toContain('1985-12-01');
    expect(line).toContain('[redacted]');
  });

  it('redacts sensitive fields from content API logging helper', () => {
    const line = captureLogLine(() => {
      logContentApi(
        {
          scope: 'natal-human-section',
          userId: 'user-1',
          chartId: 42,
          surface: 'natal',
          variant: 'living',
        },
        'generation_success',
        {
          metadata: {
            question: 'Will I relocate this year?',
            answer: 'The chart suggests gradual change.',
            birthDate: '1992-07-14',
            birthTime: '09:15',
            birthPlace: 'Saint Petersburg',
            sectionKey: 'work_business',
          },
        }
      );
    });

    expect(line).not.toContain('relocate this year');
    expect(line).not.toContain('gradual change');
    expect(line).not.toContain('1992-07-14');
    expect(line).not.toContain('Saint Petersburg');
    expect(line).toContain('work_business');
  });
});
