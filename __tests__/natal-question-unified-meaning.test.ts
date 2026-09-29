import type { UserProfile } from '../types';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import {
  buildNatalQuestionPrompt,
  buildNatalQuestionPromptContext,
  generateNatalQuestionAnswer,
  getNatalQuestionAnswerValidationErrors,
} from '../lib/natalReading/natalQuestion';

const profile = {
  id: '42',
  name: 'Анна',
  birthDate: '1990-01-01',
  birthTime: '08:15',
  birthPlace: 'Москва',
  language: 'ru',
} as UserProfile;

const validAnswer = 'Ты чаще выбираешь прямой способ действия, когда цель понятна. Включиться в конкретную задачу тебе обычно проще, чем долго готовиться без ясной точки старта. Когда направление уже видно, решение приходит быстрее.';

describe('natal questions use the unified meaning layer', () => {
  it('builds question context from approved meanings instead of raw chart structures', () => {
    const chart = canonicalNatalChart();
    const { interpretation, context } = buildNatalQuestionPromptContext({
      chartId: 7,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно начинаю новые дела?',
    });
    const prompt = buildNatalQuestionPrompt('ru', context);

    expect(context.interpretationVersion).toBe(interpretation.schemaVersion);
    expect(context.approvedMeanings).toHaveLength(interpretation.meanings.length);
    expect(context.approvedMeanings[0]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^meaning:/),
      meaning: expect.any(String),
    }));
    expect(prompt).toContain('APPROVED CONTEXT');
    expect(prompt).toContain('approvedMeanings');
    expect(prompt).not.toContain('"positions"');
    expect(prompt).not.toContain('"houses"');
    expect(prompt).not.toContain('"aspects"');
    expect(prompt).not.toContain('technicalText');
  });

  it('derives evidence ids on the server from the selected meaning ids', async () => {
    const chart = canonicalNatalChart();
    const interpretation = buildNatalInterpretation(chart, 'ru');
    const selected = interpretation.meanings.find((meaning) => meaning.semanticKey.startsWith('body-sign:sun:'));
    if (!selected) throw new Error('sun meaning missing');

    const answer = await generateNatalQuestionAnswer({
      chartId: 7,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно начинаю новые дела?',
      requestAnswer: async () => ({
        answer: validAnswer,
        meaning_ids: [selected.id],
      }),
      reviewAnswer: async () => [],
    });

    expect(answer.meaningIds).toEqual([selected.id]);
    expect(answer.evidenceIds).toEqual(selected.evidenceIds);
    expect(answer.generationAttempts).toBe(1);
  });

  it('rejects an invented meaning id before semantic review', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart(), 'ru');
    const errors = getNatalQuestionAnswerValidationErrors({
      answer: validAnswer,
      meaning_ids: ['meaning:invented'],
    }, new Set(interpretation.meanings.map((meaning) => meaning.id)));

    expect(errors).toContain('MEANING_UNKNOWN');
  });

  it('rejects an answer that cites an unnecessarily broad slice of the whole chart', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart(), 'ru');
    const errors = getNatalQuestionAnswerValidationErrors({
      answer: validAnswer,
      meaning_ids: interpretation.meanings.slice(0, 7).map((meaning) => meaning.id),
    }, new Set(interpretation.meanings.map((meaning) => meaning.id)));

    expect(errors).toContain('MEANING_SELECTION_TOO_BROAD');
  });

  it('repairs an answer when semantic review finds a claim outside the selected meanings', async () => {
    const chart = canonicalNatalChart();
    const interpretation = buildNatalInterpretation(chart, 'ru');
    const selected = interpretation.meanings.find((meaning) => meaning.semanticKey.startsWith('body-sign:sun:'));
    if (!selected) throw new Error('sun meaning missing');

    const prompts: string[] = [];
    let reviews = 0;
    const answer = await generateNatalQuestionAnswer({
      chartId: 7,
      profile,
      chartData: chart,
      history: [],
      question: 'Как я обычно начинаю новые дела?',
      requestAnswer: async ({ prompt }) => {
        prompts.push(prompt);
        return { answer: validAnswer, meaning_ids: [selected.id] };
      },
      reviewAnswer: async () => {
        reviews += 1;
        return reviews === 1 ? ['unsupported cause'] : [];
      },
    });

    expect(answer.generationAttempts).toBe(2);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('SEMANTIC_MISMATCH');
  });
});
