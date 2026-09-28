import type { UserProfile } from '../types';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import {
  buildNatalQuestionPrompt,
  buildNatalQuestionPromptContext,
  generateNatalQuestionAnswer,
  getNatalQuestionAnswerValidationErrors,
  validateNatalQuestionAnswer,
} from '../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../lib/natalReading/natalQuestionStore';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const profile = {
  id: '7',
  name: 'Мира',
  birthDate: '1990-01-01',
  birthTime: '08:15',
  birthPlace: 'Москва',
  language: 'ru',
} as UserProfile;

function validAnswer(meaningId: string, text = 'Ты быстрее включаешься, когда задача понятна. В неопределённой ситуации сначала собираешь больше деталей. После этого решение обычно даётся проще.') {
  return { answer: text, meaning_ids: [meaningId] };
}

describe('unified natal question path', () => {
  it('exposes only approved meanings to the writer, never raw chart or permanent report', () => {
    const chart = canonicalNatalChart();
    const { interpretation, context } = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно принимаю важные решения?',
    });

    expect(context.interpretationVersion).toBe(interpretation.schemaVersion);
    expect(context.approvedMeanings).toHaveLength(interpretation.meanings.length);
    expect(context.approvedMeanings[0]).toEqual(expect.objectContaining({
      id: interpretation.meanings[0].id,
      meaning: interpretation.meanings[0].text,
    }));
    expect(context).not.toHaveProperty('chart');
    expect(context).not.toHaveProperty('permanentReport');
    expect(context.approvedMeanings[0]).not.toHaveProperty('evidenceIds');

    const prompt = buildNatalQuestionPrompt('ru', context);
    expect(prompt).toContain('APPROVED_MEANINGS');
    expect(prompt).toContain('meaning_ids');
    expect(prompt).not.toContain('"longitude"');
    expect(prompt).not.toContain('"aspects"');
    expect(prompt).not.toContain('"positions"');
  });

  it('does not expose unstable evidence as an approved meaning', () => {
    const chart = canonicalNatalChart({
      time: {
        mode: 'approximate',
        localTime: '08:15',
        uncertaintyMinutes: 30,
        rangeStart: null,
        rangeEnd: null,
      },
    });
    chart.positions.moon.stable.sign = false;
    chart.positions.moon.reliability = 'variable_in_range';
    chart.chartQuality.variableBodies = ['moon'];

    const { context } = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно реагирую?',
    });

    expect(context.approvedMeanings.map((meaning) => meaning.id))
      .not.toContain('meaning:position:moon:sign');
  });

  it('requires known meaning ids and rejects astrology, coaching and fabricated timing in visible copy', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart(), 'ru');
    const meaningId = interpretation.meanings[0].id;
    const allowed = new Set(interpretation.meanings.map((meaning) => meaning.id));

    expect(validateNatalQuestionAnswer(validAnswer(meaningId), allowed, interpretation))
      .toMatchObject({ meaningIds: [meaningId] });

    expect(getNatalQuestionAnswerValidationErrors({
      answer: 'Солнце задаёт твой основной характер. Эта планета делает реакцию заметно быстрее. Поэтому выбор почти всегда получается одинаковым.',
      meaning_ids: [meaningId],
    }, allowed)).toContain('COPY_VIOLATION');

    expect(getNatalQuestionAnswerValidationErrors({
      answer: 'Тебе стоит сначала проверить детали. Попробуй не спешить с выбором. После этого решение будет даваться легче.',
      meaning_ids: [meaningId],
    }, allowed)).toContain('COPY_VIOLATION');

    expect(getNatalQuestionAnswerValidationErrors({
      answer: 'Завтра ты точно получишь нужный результат. Решение окажется правильным. Сомнений после этого уже не останется.',
      meaning_ids: [meaningId],
    }, allowed)).toEqual(expect.arrayContaining([
      'UNSUPPORTED_FUTURE_TIMING',
      'UNSUPPORTED_FUTURE_EVENT',
    ]));

    expect(getNatalQuestionAnswerValidationErrors(validAnswer('meaning:invented'), allowed))
      .toContain('MEANING_UNKNOWN');
  });

  it('derives evidence ids from the selected meanings instead of trusting model evidence', async () => {
    const chart = canonicalNatalChart();
    const interpretation = buildNatalInterpretation(chart, 'ru');
    const meaning = interpretation.meanings[0];
    const candidate = validAnswer(meaning.id);

    const answer = await generateNatalQuestionAnswer({
      chartId: 101,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно принимаю важные решения?',
      requestAnswer: async () => candidate,
      reviewAnswer: async () => [],
    });

    expect(answer.meaningIds).toEqual([meaning.id]);
    expect(answer.evidenceIds).toEqual(meaning.evidenceIds);
  });

  it('retries when semantic review finds a new unsupported claim', async () => {
    const chart = canonicalNatalChart();
    const interpretation = buildNatalInterpretation(chart, 'ru');
    const meaningId = interpretation.meanings[0].id;
    const prompts: string[] = [];
    let reviews = 0;

    const answer = await generateNatalQuestionAnswer({
      chartId: 101,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно принимаю важные решения?',
      requestAnswer: async ({ prompt }) => {
        prompts.push(prompt);
        return validAnswer(meaningId);
      },
      reviewAnswer: async () => {
        reviews += 1;
        return reviews === 1 ? ['candidate added a new cause'] : [];
      },
    });

    expect(answer.generationAttempts).toBe(2);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('SEMANTIC_MISMATCH');
  });

  it('keeps only the last eight answered pairs and does not use incomplete or foreign questions', () => {
    const history: NatalQuestionStoredMessage[] = [];
    for (let index = 0; index < 10; index += 1) {
      const questionId = index * 2 + 1;
      history.push(
        {
          id: questionId,
          threadId: 1,
          userId: '7',
          chartId: 101,
          role: 'user',
          text: `question ${index + 1}`,
          payload: null,
          createdAt: new Date(2026, 0, questionId).toISOString(),
        },
        {
          id: questionId + 1,
          threadId: 1,
          userId: '7',
          chartId: 101,
          role: 'assistant',
          text: `answer ${index + 1}`,
          payload: { questionMessageId: questionId },
          createdAt: new Date(2026, 0, questionId + 1).toISOString(),
        },
      );
    }
    history.push(
      {
        id: 30,
        threadId: 1,
        userId: '7',
        chartId: 101,
        role: 'user',
        text: 'incomplete question',
        payload: null,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 31,
        threadId: 2,
        userId: '7',
        chartId: 202,
        role: 'user',
        text: 'foreign question',
        payload: null,
        createdAt: '2026-02-02T00:00:00.000Z',
      },
    );

    const { context } = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: canonicalNatalChart(),
      history,
      question: 'Как я принимаю решения?',
    });

    expect(context.recentMessages).toHaveLength(16);
    expect(context.recentMessages[0].text).toBe('question 3');
    expect(context.recentMessages.at(-1)?.text).toBe('answer 10');
    expect(context.recentMessages.some((message) => message.text.includes('incomplete'))).toBe(false);
    expect(context.recentMessages.some((message) => message.text.includes('foreign'))).toBe(false);
  });
});
