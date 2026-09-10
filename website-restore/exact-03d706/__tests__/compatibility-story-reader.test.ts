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

// Like natal-narrative-reader.test.ts: render the real JSX in the Node runner, without a DOM dependency.
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
function elements(node: React.ReactNode, type: string): Array<React.ReactElement<Record<string, any>>> {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement<Record<string, any>>(child)) return [];
    return [...(child.type === type ? [child] : []), ...elements(child.props.children, type)];
  });
}
function chapterHtml(html: string, topic: CompatibilityStoryTopic): string {
  const section = html.match(new RegExp(`<section[^>]*aria-labelledby="compat-story-${topic}"[^>]*>([\\s\\S]*?)<\\/section>`));
  expect(section).not.toBeNull();
  return section![1];
}

describe('saved compatibility story reader', () => {
  it.each([
    ['romance', ['Что цепляет', 'Притяжение и близость', 'Как пойдёт разговор', 'Где можно не совпасть', 'Легко ли быть рядом']],
    ['relationship', ['Что вас соединяет', 'Близость и желание', 'Как вы слышите друг друга', 'Что происходит в спорах', 'Жизнь рядом']],
    ['ex', ['Что могло притягивать', 'Близость и дистанция', 'Если снова заговорить', 'Что может повториться', 'На каких условиях общаться']],
    ['friendship', ['За что интересно вместе', 'Доверие и поддержка', 'Разговоры без церемоний', 'Если не сошлись во мнениях', 'Планы, привычки, расстояние']],
    ['family', ['Что помогает быть ближе', 'Забота без нажима', 'Как услышать друг друга', 'Ожидания и разногласия', 'Свой выбор и общие дела']],
    ['work', ['В чём вы дополняете друг друга', 'Доверие в деле', 'Как обсуждать решения', 'Когда мнения расходятся', 'Темп и ответственность']],
  ] as const)('renders five context-specific chapters for %s, preserving every saved paragraph', (context, titles) => {
    const result = { ...saved(), relationshipContext: context };
    const html = render({ result });
    expect(html.match(/<section /gu)).toHaveLength(5);
    expect(html.match(/<button /gu)).toHaveLength(10);
    titles.forEach((title, index) => {
      expect(html).toContain(`<h2 id="compat-story-${COMPATIBILITY_STORY_TOPICS[index]}" tabindex="-1">${title}</h2>`);
    });
    for (const paragraph of result.storyParagraphs!) {
      expect(chapterHtml(html, paragraph.topic)).toContain(`<p>${paragraph.text}</p>`);
    }
  });

  it('navigates only to chapters that exist, focuses their headings, and performs no request', () => {
    const result = saved();
    result.storyParagraphs = result.storyParagraphs!.filter((paragraph) => paragraph.topic === 'connection' || paragraph.topic === 'everyday');
    const tree = CompatibilityStoryReader(props({ result }));
    const buttons = elements(tree, 'button').filter((button) => button.props.className !== 'compat-story-back');
    const headings = elements(tree, 'h2');
    expect(buttons).toHaveLength(2);
    expect(headings.map((heading) => heading.props.id)).toEqual(['compat-story-connection', 'compat-story-everyday']);
    const targets = new Map(headings.map((heading) => [heading.props.id, { focus: jest.fn(), scrollIntoView: jest.fn() }]));
    const getElementById = jest.fn((id: string) => targets.get(id));
    const fetch = jest.fn();
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById } });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetch });
    try {
      buttons.forEach((button) => button.props.onClick());
      expect(getElementById.mock.calls.map(([id]) => id)).toEqual([...targets.keys()]);
      targets.forEach((target) => {
        expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch); else Reflect.deleteProperty(globalThis, 'fetch');
    }
  });

  it('shows only cited saved evidence in each chapter, deduplicated and collapsed after its prose', () => {
    const result = saved();
    const [first, second] = result.evidence!;
    result.evidence = [
      { ...first, label: 'Факт первой главы' }, { ...second, label: 'Факт второй главы' },
      { ...first, id: 'not-cited', label: 'Непроцитированный факт' },
    ];
    result.storyParagraphs = [
      { ...result.storyParagraphs![0], topic: 'connection', evidenceIds: [first.id, first.id, 'missing-saved-fact'] },
      { ...result.storyParagraphs![1], topic: 'connection', evidenceIds: [first.id] },
      { ...result.storyParagraphs![2], topic: 'closeness', evidenceIds: [second.id] },
    ];
    result.limitations = [];
    const html = render({ result });
    const firstChapter = chapterHtml(html, 'connection');
    const secondChapter = chapterHtml(html, 'closeness');
    expect(firstChapter.match(/<li>/gu)).toHaveLength(1);
    expect(firstChapter).toContain('<li>Факт первой главы</li>');
    expect(firstChapter).not.toContain('Факт второй главы');
    expect(secondChapter).toContain('<li>Факт второй главы</li>');
    expect(secondChapter).not.toContain('Факт первой главы');
    expect(html).not.toContain('Непроцитированный факт');
    expect(html).not.toContain('missing-saved-fact');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/u);
    expect(firstChapter.indexOf(result.storyParagraphs[1].text)).toBeLessThan(firstChapter.indexOf('<details'));
  });

  it.each([undefined, []])('renders an older saved summary without inventing chapters (%j)', (storyParagraphs) => {
    const html = render({ result: { ...saved(), storyParagraphs, summary: 'Старый первый абзац.\n\nСтарый второй абзац.' } });
    expect(html).toContain('<p>Старый первый абзац.</p><p>Старый второй абзац.</p>');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('compat-story-undefined');
  });

  it('opens a saved v1 story whose paragraphs predate topics as the complete legacy summary', () => {
    const result = saved();
    const legacy = {
      ...result, narrativeVersion: 'compatibility-story.v1',
      storyParagraphs: result.storyParagraphs!.map(({ topic: _topic, ...paragraph }) => paragraph),
    } as SynastryResult;
    const html = render({ result: legacy });
    for (const paragraph of result.storyParagraphs!) expect(html).toContain(`<p>${paragraph.text}</p>`);
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('compat-story-undefined');
  });

  it('localizes English navigation and accuracy copy, identifies both people, and keeps legacy scores hidden', () => {
    const result = {
      ...saved(), relationshipContext: 'work' as const,
      overallScore: 97, compatibilityScore: 97, verdict: 'LEGACY_VERDICT_DO_NOT_RENDER',
      limitations: ['Exact birth times were not supplied.'],
    };
    const html = render({ result, language: 'en', subjectName: 'Nina', partnerName: 'Alex' });
    expect(html).toContain('aria-label="Your pair reading"');
    expect(html).toContain('aria-label="Compatibility chapters"');
    expect(html).toContain('What would you like to know?');
    expect(html).toContain('“You” means Nina. Alex is named.');
    expect(html).toContain('Trust at work');
    expect(html).toContain('Pace and responsibility');
    expect(html).toContain('Why?');
    expect(html).toContain('What depends on birth-time accuracy');
    expect(html).toContain('Exact birth times were not supplied.');
    expect(html).not.toContain('Что хочется узнать');
    expect(html).not.toContain('Почему так');
    expect(html).not.toContain('LEGACY_VERDICT_DO_NOT_RENDER');
    expect(html).not.toContain('97');
    expect(html).not.toContain('%');
  });
});

describe('compatibility chapter writer contract', () => {
  it.each(['ru', 'en'] as const)('preserves unspecified genders without guessing from names in the %s prompt', (language) => {
    const prompt = buildCompatibilityStoryPrompt({
      calculated: { ...calculated, relationshipContext: 'work' }, language,
      subject: { name: 'Мария', gender: 'unspecified', birthTimeQuality: 'exact' },
      partner: { name: 'Пётр', gender: 'unspecified', birthTimeQuality: 'unknown' },
    });
    const payload = JSON.parse(prompt.user);
    expect(payload.people.subject).toMatchObject({ name: 'Мария', gender: 'unspecified' });
    expect(payload.people.partner).toMatchObject({ name: 'Пётр', gender: 'unspecified' });
    expect(prompt.system).toContain('При unspecified пиши нейтрально');
    expect(prompt.system).toContain('Пол меняет обращение, но не назначает характер');
    expect(prompt.system).toContain(language === 'ru' ? 'Пиши по-русски' : 'Write natural, direct English');
    expect(payload.chapterGuide.map((item: { topic: string }) => item.topic)).toEqual(COMPATIBILITY_STORY_TOPICS);
    expect(payload.chapterGuide[1].title).toBe(language === 'ru' ? 'Доверие в деле' : 'Trust at work');
    expect(payload).not.toHaveProperty('overallScore');
    expect(payload).not.toHaveProperty('compatibilityScore');
    const schema = COMPATIBILITY_STORY_SCHEMA as any;
    expect(schema.properties.paragraphs.items.required).toContain('topic');
    expect(schema.properties.paragraphs.items.properties.topic.enum).toEqual(COMPATIBILITY_STORY_TOPICS);
  });

  it.each([undefined, 'invented-topic', '__proto__'])('rejects unknown or missing topics: %s', (topic) => {
    const candidate = writer();
    candidate.paragraphs[0].topic = topic as CompatibilityStoryTopic;
    expect(() => validateCompatibilityNarrative(candidate, calculated)).toThrow('topic_missing');
  });

  it('accepts neighbouring paragraphs in one chapter but rejects returning to a completed chapter', () => {
    const candidate = writer();
    expect(validateCompatibilityNarrative(candidate, calculated).paragraphs).toHaveLength(8);
    candidate.paragraphs[4].topic = 'connection';
    expect(() => validateCompatibilityNarrative(candidate, calculated)).toThrow('topic_repeated');
  });

  it('rejects a detailed story restricted to three topics while accepting four supported topics', () => {
    const candidate = writer();
    candidate.paragraphs = candidate.paragraphs.map((paragraph) => ({
      ...paragraph, topic: paragraph.topic === 'everyday' || paragraph.topic === 'friction' ? 'conversation' : paragraph.topic,
    }));
    expect(() => validateCompatibilityNarrative(candidate, calculated)).toThrow('topics_too_narrow');
    candidate.paragraphs[7].topic = 'everyday';
    expect(validateCompatibilityNarrative(candidate, calculated).paragraphs).toHaveLength(8);
  });

  it('allows three chapters for sparse saved evidence, but rejects reducing them to two', () => {
    const sparse = { ...calculated, evidence: selectCompatibilityWriterEvidence(calculated).filter((fact) => fact.direction === 'mutual').slice(0, 3) };
    const candidate: CompatibilityWriterResponse = compatibilityStory(selectCompatibilityWriterEvidence(sparse));
    candidate.paragraphs = candidate.paragraphs.map((paragraph, index) => ({
      ...paragraph, topic: index < 3 ? 'connection' : index < 6 ? 'conversation' : 'everyday',
    }));
    expect(validateCompatibilityNarrative(candidate, sparse).paragraphs).toHaveLength(8);
    candidate.paragraphs = candidate.paragraphs.map((paragraph) => ({ ...paragraph, topic: paragraph.topic === 'everyday' ? 'conversation' : paragraph.topic }));
    expect(() => validateCompatibilityNarrative(candidate, sparse)).toThrow('topics_too_narrow');
  });
});
