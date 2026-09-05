import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { PersonalForecastPeriod } from '../lib/personalForecastContract';
import { personalForecastFixture } from './personal-forecast-fixture';

// Render the actual JSX in the repository's Node-only Jest runner.
function loadComponent(filename: string): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (!specifier.startsWith('.')) return require(specifier);
    const target = path.resolve(path.dirname(filename), specifier);
    return existsSync(`${target}.tsx`) ? loadComponent(`${target}.tsx`) : require(target);
  };
  new Function('require', 'exports', output)(localRequire, exports);
  return exports;
}

const { ForecastSectionBlock } = loadComponent(path.resolve(__dirname, '../components/PersonalForecastFeed/ForecastSectionBlock.tsx')) as {
  ForecastSectionBlock: typeof import('../components/PersonalForecastFeed/ForecastSectionBlock').ForecastSectionBlock;
};
const { TodayEditorialFeed } = loadComponent(path.resolve(__dirname, '../components/PersonalForecastFeed/TodayEditorialFeed.tsx')) as {
  TodayEditorialFeed: typeof import('../components/PersonalForecastFeed/TodayEditorialFeed').TodayEditorialFeed;
};

describe('personal forecast three-part reader', () => {
  it.each(['day', 'week', 'month'] as const)('renders the complete %s forecast once, followed by its closing without another heading', (period: PersonalForecastPeriod) => {
    const forecast = personalForecastFixture();
    const title = 'Вот это поворот';
    const first = 'Знакомое дело наконец сдвинется с места. Вместо долгой переписки придёт короткий ответ.';
    const last = 'Встреча, которую всё откладывали, получит дату. К концу дня освободится вечер.';
    const closing = 'Планы снова похожи на планы.';
    const overview = {
      ...forecast.overview,
      title,
      contentBlocks: [first, last].map((text, index) => ({
        ...forecast.overview.contentBlocks[0],
        id: `body:${index}`,
        text,
      })),
    };
    const final = {
      ...forecast.sections[0],
      title: 'Служебное название финала',
      contentBlocks: [{ ...forecast.sections[0].contentBlocks[0], text: closing }],
    };
    const sections = [overview, final];
    const html = renderToStaticMarkup(period === 'day'
      ? React.createElement(TodayEditorialFeed, {
        sections,
        lockedSectionIds: new Set<string>(),
        userId: 'forecast-reader-test',
        periodKey: forecast.periodKey,
        timezone: forecast.timezone,
        language: 'ru',
        tone: 'mixed',
        onRequestPremium: () => {},
      })
      : React.createElement('article', { lang: 'ru' }, sections.map((section) => (
        React.createElement(ForecastSectionBlock, {
          key: section.id,
          section,
          period,
          language: 'ru',
          locked: false,
          onRequestPremium: () => {},
        })
      ))));

    [title, first, last, closing].forEach((text) => expect(html.split(text)).toHaveLength(2));
    expect(html).toContain(`${first} ${last}</p>`);
    expect(html.indexOf(title)).toBeLessThan(html.indexOf(first));
    expect(html.indexOf(last)).toBeLessThan(html.indexOf(closing));
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).not.toMatch(/<h[2-6]\b|Служебное название финала|Итог дня|Итог недели|Итог месяца/gu);
    if (period === 'day') {
      expect(html).toContain('today-calendar-clock');
      expect(html).toContain('<time');
      expect(html).not.toMatch(/<video\b|<iframe\b/gu);
    }
  });
});
