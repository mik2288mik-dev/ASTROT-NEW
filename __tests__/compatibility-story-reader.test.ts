import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { SynastryResult } from '../types';
import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import {
  buildCompatibilityResult, validateCompatibilityNarrative,
  type CompatibilityWriterResponse,
} from '../lib/synastry/compatibilityNarrative';
import { buildCompatibilityStoryPrompt, COMPATIBILITY_STORY_SCHEMA } from '../lib/synastry/compatibilityVoice';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStoryFor } from './fixtures/compatibilityStory';

function loadComponent(filename: string): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (!specifier.startsWith('.')) return require(specifier);
    const target = path.resolve(path.dirname(filename), specifier);
    return existsSync(`${target}.tsx`) ? loadComponent(`${target}.tsx`) : require(target);
  };
  new Function('require', 'exports', output)(localRequire, exports);
  return exports;
}

const { CompatibilityStoryReader } = loadComponent(path.resolve(__dirname, '../components/CompatibilityStoryReader.tsx')) as {
  CompatibilityStoryReader: typeof import('../components/CompatibilityStoryReader').CompatibilityStoryReader;
};
type ReaderProps = React.ComponentProps<typeof CompatibilityStoryReader>;

const calculated = calculateCompatibility({
  subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart({ birthDate: '1990-08-22' }),
  calculationLevel: 'full', relationshipContext: 'romance', language: 'ru', subjectName: 'Анна', partnerName: 'Максим',
});
const writer = () => compatibilityStoryFor(calculated);
const saved = () => buildCompatibilityResult(calculated, writer());
const props = (overrides: Partial<ReaderProps> = {}): ReaderProps => ({
  result: saved(), language: 'ru', subjectName: 'Анна', partnerName: 'Максим', ...overrides,
});
const render = (overrides: Partial<ReaderProps> = {}) => renderToStaticMarkup(React.createElement(CompatibilityStoryReader, props(overrides)));

describe('saved compatibility story reader', () => {
  it('answers the questions of the chosen relationship type with the calculated short answer', () => {
    const result = saved();
    const html = render({ result });
    const answered = result.questions!.filter((question) => question.score != null);
    expect(answered.length).toBeGreaterThan(0);
    for (const question of result.questions!) {
      expect(html).toContain(`>${question.question}</h3>`);
      expect(html).toContain(`>${question.answerLabel}</span>`);
    }
    expect(html.match(/class="compat-answer-bar"/gu)).toHaveLength(answered.length);
    expect(html).toContain(result.storyParagraphs![0].text);
    expect(html).not.toContain('Что у вас получается');
  });

  it('keeps the question order even when the provider returns answers in another order', () => {
    const result = saved();
    result.storyParagraphs = [...result.storyParagraphs!].reverse();
    const html = render({ result });
    const positions = result.questions!.map((question) => html.indexOf(`compat-answer-${question.id}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('shows who affects whom as its own block', () => {
    const result = saved();
    result.directionalPatterns = [{ id: 'd1', direction: 'subject_to_partner', title: 'Анна → Максим', fact: 'Анна приносит в пару правила и порядок.', evidenceIds: [] }];
    const html = render({ result });
    expect(html).toContain('Кто на кого как влияет');
    expect(html).toContain('Анна приносит в пару правила и порядок.');
  });

  it('keeps an older story-format result readable', () => {
    const legacy = {
      ...saved(),
      questions: undefined,
      storyParagraphs: [{ topic: 'what_works', text: 'Старый раздел сохранённого разбора, который нужно показать.', evidenceIds: [], direction: 'mutual' }],
    } as SynastryResult;
    const html = render({ result: legacy });
    expect(html).toContain('Что у вас получается');
    expect(html).toContain('Старый раздел сохранённого разбора');
  });

  it('keeps a legacy summary-only result readable without headings', () => {
    const legacy = { ...saved(), storyParagraphs: undefined, summary: 'Старый короткий вывод.\n\nВторой абзац сохранённого разбора.' } as SynastryResult;
    const html = render({ result: legacy });
    expect(html).toContain('<p>Старый короткий вывод.</p><p>Второй абзац сохранённого разбора.</p>');
    expect(html).not.toContain('<h2');
  });
});

describe('compatibility writer contract', () => {
  it.each(['ru', 'en'] as const)('asks for one plain answer per calculated question in %s', (language) => {
    const work = calculateCompatibility({
      subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart({ birthDate: '1990-08-22' }),
      calculationLevel: 'full', relationshipContext: 'work', language, subjectName: 'Мария', partnerName: 'Пётр',
    });
    const prompt = buildCompatibilityStoryPrompt({
      calculated: work, language,
      subject: { name: 'Мария', gender: 'unspecified', birthTimeQuality: 'exact' },
      partner: { name: 'Пётр', gender: 'unspecified', birthTimeQuality: 'unknown' },
    });
    const payload = JSON.parse(prompt.user);
    const schema = COMPATIBILITY_STORY_SCHEMA as any;
    expect(payload.people.subject).toMatchObject({ name: 'Мария', gender: 'unspecified' });
    expect(payload.questions.map((item: { questionId: string }) => item.questionId))
      .toEqual(work.questions.filter((question) => question.score != null).map((question) => question.id));
    expect(payload.questions.every((item: { questionId: string }) => item.questionId.startsWith('work_'))).toBe(true);
    expect(schema.required).toEqual(['summary', 'paragraphs']);
    expect(schema.properties.paragraphs.items.required).toContain('questionId');
    expect(prompt.system).toContain(language === 'ru' ? 'ОТВЕТЫ НА ВОПРОСЫ ПАРЫ' : "ANSWERS TO THE PAIR'S QUESTIONS");
    expect(prompt.system).toContain(language === 'ru' ? 'Без сленга' : 'No slang');
  });

  it('requires a summary, one answer per question and real evidence', () => {
    const candidate = writer();
    expect(validateCompatibilityNarrative(candidate, calculated).summary).toBe(candidate.summary);
    expect(() => validateCompatibilityNarrative({ paragraphs: candidate.paragraphs }, calculated)).toThrow('summary_missing');
    expect(() => validateCompatibilityNarrative({ ...candidate, summary: 'Слишком коротко.' }, calculated)).toThrow('summary_length');
    expect(() => validateCompatibilityNarrative({ ...candidate, paragraphs: candidate.paragraphs.slice(0, 2) }, calculated)).toThrow('paragraph_count');
    const duplicate = { ...candidate, paragraphs: [...candidate.paragraphs] };
    duplicate.paragraphs[1] = { ...duplicate.paragraphs[1], questionId: duplicate.paragraphs[0].questionId };
    expect(() => validateCompatibilityNarrative(duplicate, calculated)).toThrow('question_repeated');
  });

  it.each([undefined, 'work_pace', '__proto__'])('rejects a question outside the chosen relationship type: %s', (questionId) => {
    const candidate = writer();
    candidate.paragraphs[0].questionId = questionId as CompatibilityWriterResponse['paragraphs'][number]['questionId'];
    expect(() => validateCompatibilityNarrative(candidate, calculated)).toThrow('question_missing');
  });
});
