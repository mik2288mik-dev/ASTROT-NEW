import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { SynastryResult } from '../types';

// Exercise the production mapping and navigation without mounting network clients.
function surface(name: string) {
  const filename = path.resolve(__dirname, `../components/nebo-v2/${name}.tsx`);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  const localRequire = (specifier: string): unknown => {
    if (specifier === 'next/dynamic') return () => () => null;
    if (specifier.endsWith('/storyTopics') || specifier.endsWith('/relationshipContext')) return require(path.resolve(path.dirname(filename), specifier));
    if (specifier.startsWith('.')) return {};
    return require(specifier);
  };
  new Function('require', 'exports', output)(localRequire, exports);
  return exports;
}

const { deepSections } = surface('NeboUnionRoom') as Pick<typeof import('../components/nebo-v2/NeboUnionRoom'), 'deepSections'>;
const { validMatrixDate } = surface('NeboMatrixRoom') as Pick<typeof import('../components/nebo-v2/NeboMatrixRoom'), 'validMatrixDate'>;
const { NatalTabs } = surface('NeboNatal') as Pick<typeof import('../components/nebo-v2/NeboNatal'), 'NatalTabs'>;

describe('new design reading surfaces', () => {
  it('preserves every saved story paragraph once, grouped by its actual topic', () => {
    const paragraphs = [
      { topic: 'connection', text: 'Первая мысль о паре.', evidenceIds: ['a'], direction: 'mutual' },
      { topic: 'connection', text: 'Другая мысль о паре.', evidenceIds: ['b'], direction: 'mutual' },
      { topic: 'conversation', text: 'Самостоятельная мысль об общении.', evidenceIds: ['c'], direction: 'mutual' },
    ] as NonNullable<SynastryResult['storyParagraphs']>;
    const result = { relationshipContext: 'relationship', storyParagraphs: paragraphs, summary: paragraphs.map(item => item.text).join('\n\n'), sections: [] } as unknown as SynastryResult;
    const sections = deepSections(result, true);
    expect(sections.map(item => item.id)).toEqual(['connection', 'conversation']);
    expect(sections.map(item => item.text).join('\n\n')).toBe(result.summary);
    expect(sections[0].evidenceIds).toEqual(['a', 'b']);
    expect(sections[1].evidenceIds).toEqual(['c']);
    expect(sections[1].title).toBe('Как вы слышите друг друга');
  });

  it('opens a legacy summary once without inventing five different chapters', () => {
    const result = { summary: 'Полный сохранённый разбор.', sections: [] } as unknown as SynastryResult;
    expect(deepSections(result, true)).toHaveLength(1);
    expect(deepSections(result, true)[0]).toMatchObject({ title: 'Ваш разбор', text: result.summary });
    expect(deepSections({ summary: '' } as SynastryResult, true)).toEqual([]);
  });

  it('keeps the three natal tabs and names the active page', () => {
    const html = renderToStaticMarkup(React.createElement(NatalTabs, { mode: 'overview', language: 'ru', onSelect: () => undefined }));
    expect([...html.matchAll(/<button[^>]*>(.*?)<\/button>/gu)].map(match => match[1])).toEqual(['Карта', 'Разбор', 'Матрица судьбы']);
    expect(html).toContain('aria-current="page">Разбор');
    expect(html.match(/aria-current="page"/gu)).toHaveLength(1);
  });

  it.each(['2023-02-29', '1999-02-31', '2020-13-01', '', '14.05.1999'])('does not show a matrix for an impossible date: %s', value => {
    expect(validMatrixDate(value)).toBe(false);
  });
  it.each(['2024-02-29', '1999-05-14'])('accepts a real calendar date: %s', value => {
    expect(validMatrixDate(value)).toBe(true);
  });
});
