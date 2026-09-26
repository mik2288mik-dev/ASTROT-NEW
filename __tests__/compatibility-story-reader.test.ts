import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { SynastryResult } from '../types';
import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import {
  buildCompatibilityResult, selectCompatibilityWriterEvidence, validateCompatibilityNarrative,
  type CompatibilityWriterResponse,
} from '../lib/synastry/compatibilityNarrative';
import { buildCompatibilityStoryPrompt, COMPATIBILITY_STORY_SCHEMA } from '../lib/synastry/compatibilityVoice';
import { COMPATIBILITY_STORY_TOPICS, type CompatibilityStoryTopic } from '../lib/synastry/storyTopics';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStory } from './fixtures/compatibilityStory';

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
const writer = () => compatibilityStory(selectCompatibilityWriterEvidence(calculated));
const saved = () => buildCompatibilityResult(calculated, writer());
const props = (overrides: Partial<ReaderProps> = {}): ReaderProps => ({
  result: saved(), language: 'ru', subjectName: 'Анна', partnerName: 'Максим', ...overrides,
});
const render = (overrides: Partial<ReaderProps> = {}) => renderToStaticMarkup(React.createElement(CompatibilityStoryReader, props(overrides)));

describe('saved compatibility story reader', () => {
  const russianTitles = ['Что у вас получается', 'Где можете не понять друг друга', 'О чём лучше сказать сразу', 'Что не стоит раздувать'];

  it.each(['romance', 'relationship', 'ex', 'friendship', 'family', 'work'] as const)('uses the same everyday headings for %s without changing the context facts', (context) => {
    const html = render({ result: { ...saved(), relationshipContext: context } });
    expect(html.match(/<section /gu)).toHaveLength(4);
    russianTitles.forEach((title, index) => {
      expect(html).toContain(`<h2 id="compat-story-${COMPATIBILITY_STORY_TOPICS[index]}" tabindex="-1">${title}</h2>`);
    });
    expect(html).not.toContain('Архитектура связи');
    expect(html).not.toContain('Точки опоры');
    expect(html).not.toContain('Зоны риска');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('К разделам');
  });

  it('keeps the reader order clear even when the provider returns sections in another order', () => {
    const result = saved();
    result.storyParagraphs = [...result.storyParagraphs!].reverse();
    const html = render({ result });
    const positions = COMPATIBILITY_STORY_TOPICS.map((topic) => html.indexOf(`compat-story-${topic}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keeps a legacy saved result readable without showing retired headings', () => {
    const legacy = { ...saved(), storyParagraphs: undefined, summary: 'Старый короткий вывод.\n\nВторой абзац сохранённого разбора.' } as SynastryResult;
    const html = render({ result: legacy });
    expect(html).toContain('<p>Старый короткий вывод.</p><p>Второй абзац сохранённого разбора.</p>');
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('<nav');
  });

  it('localizes the compact reader without rendering a score or a report label', () => {
    const html = render({ result: { ...saved(), relationshipContext: 'work' }, language: 'en', subjectName: 'Nina', partnerName: 'Alex' });
    expect(html).toContain('aria-label="Your pair reading"');
    expect(html).toContain('What works between you');
    expect(html).toContain('Where you may miss each other');
    expect(html).toContain('What is worth saying early');
    expect(html).toContain('What not to turn into a big deal');
    expect(html).not.toContain('Connection architecture');
    expect(html).not.toContain('%');
  });
});

describe('compatibility writer contract', () => {
  it.each(['ru', 'en'] as const)('asks for a separate short summary and 3–4 everyday sections in %s', (language) => {
    const prompt = buildCompatibilityStoryPrompt({
      calculated: { ...calculated, relationshipContext: 'work' }, language,
      subject: { name: 'Мария', gender: 'unspecified', birthTimeQuality: 'exact' },
      partner: { name: 'Пётр', gender: 'unspecified', birthTimeQuality: 'unknown' },
    });
    const payload = JSON.parse(prompt.user);
    const schema = COMPATIBILITY_STORY_SCHEMA as any;
    expect(payload.people.subject).toMatchObject({ name: 'Мария', gender: 'unspecified' });
    expect(payload.requiredSections).toBe('4');
    expect(payload.chapterGuide.map((item: { topic: string }) => item.topic)).toEqual(COMPATIBILITY_STORY_TOPICS);
    expect(payload.chapterGuide[0].title).toBe(language === 'ru' ? 'Что у вас получается' : 'What works between you');
    expect(schema.required).toEqual(['summary', 'paragraphs']);
    expect(schema.properties.paragraphs.items.properties.topic.enum).toEqual(COMPATIBILITY_STORY_TOPICS);
    expect(prompt.system).toContain(language === 'ru' ? 'БЕЗ ЛИШНИХ СЛОВ' : 'WITHOUT EXTRA WORDS');
    expect(prompt.system).not.toContain(language === 'ru' ? 'Архитектура связи и расстановка сил' : 'Connection Architecture');
  });

  it('requires a separate summary, three or four distinct sections, and real evidence', () => {
    const candidate = writer();
    expect(validateCompatibilityNarrative(candidate, calculated).summary).toBe(candidate.summary);
    expect(() => validateCompatibilityNarrative({ paragraphs: candidate.paragraphs }, calculated)).toThrow('summary_missing');
    expect(() => validateCompatibilityNarrative({ ...candidate, summary: 'Слишком коротко.' }, calculated)).toThrow('summary_length');
    expect(() => validateCompatibilityNarrative({ ...candidate, paragraphs: candidate.paragraphs.slice(0, 2) }, calculated)).toThrow('paragraph_count');
    const duplicate = { ...candidate, paragraphs: [...candidate.paragraphs] };
    duplicate.paragraphs[3] = { ...duplicate.paragraphs[3], topic: 'what_works' };
    expect(() => validateCompatibilityNarrative(duplicate, calculated)).toThrow('topic_repeated');
    const threeSections: CompatibilityWriterResponse = { ...candidate, paragraphs: candidate.paragraphs.slice(0, 3) };
    expect(validateCompatibilityNarrative(threeSections, calculated).paragraphs).toHaveLength(3);
  });

  it.each([undefined, 'invented-topic', '__proto__'])('rejects unknown or missing topics: %s', (topic) => {
    const candidate = writer();
    candidate.paragraphs[0].topic = topic as CompatibilityStoryTopic;
    expect(() => validateCompatibilityNarrative(candidate, calculated)).toThrow('topic_missing');
  });
});
