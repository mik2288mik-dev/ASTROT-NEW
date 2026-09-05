import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LockKeyhole } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import { getNatalReportCategory, type NatalReportCategoryKey, type NatalReportCategoryPack } from '../../lib/natalReading/reportCatalog';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import { NatalEvidenceSheet, type NatalExplanationTarget } from './NatalEvidenceSheet';

export type NatalExperienceView = 'foundation' | 'explore';
const CHAPTERS = ['love', 'work', 'money', 'communication', 'character'] as const;
const CHAPTER_COPY = {
  love: { ru: 'Как ты сближаешься и что тебе нужно в отношениях.', en: 'How you get close and what you need in a relationship.' },
  work: { ru: 'Какая работа увлекает тебя и как ты доводишь дела до конца.', en: 'What work draws you in and how you get things done.' },
  money: { ru: 'Как ты выбираешь между потратить, отложить и рискнуть.', en: 'How you choose between spending, saving, and taking a risk.' },
  communication: { ru: 'Как ты находишь общий язык, споришь и миришься.', en: 'How you connect, disagree, and make peace.' },
  character: { ru: 'Что у тебя получается легко и где ты себе мешаешь.', en: 'What comes easily and where you get in your own way.' },
};
const CHAPTER_QUESTIONS = {
  love: { ru: 'Что тебе нужно в отношениях?', en: 'What do you need in a relationship?' },
  work: { ru: 'Какая работа тебе подходит?', en: 'What kind of work suits you?' },
  money: { ru: 'На что тебе легко потратить деньги?', en: 'What do you spend money on easily?' },
  communication: { ru: 'Как ты споришь и находишь общий язык?', en: 'How do you disagree and find common ground?' },
  character: { ru: 'В чём твоя сила, а что тебе мешает?', en: 'What are your strengths and what gets in your way?' },
};
type Props = {
  profile: UserProfile; chartData: NatalChartData; subjectName: string;
  activeCategoryKey: NatalReportCategoryKey;
  mainPack: NatalReportCategoryPack | null; categoryPack: NatalReportCategoryPack | null;
  categoryLoading: boolean; categoryError: string | null; isPremium: boolean; canPromotePremium: boolean;
  onSelectCategory: (category: NatalReportCategoryKey) => void;
  onRetryCategory: () => void;
  onRequestPremium: (category: NatalReportCategoryKey) => void;
  onOpenQuestions?: (category: NatalReportCategoryKey) => void;
};
export const NatalMeaningExperience: React.FC<Props> = ({
  profile, chartData, subjectName, activeCategoryKey, mainPack, categoryPack,
  categoryLoading, categoryError, isPremium, canPromotePremium,
  onSelectCategory, onRetryCategory, onRequestPremium, onOpenQuestions,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const main = activeCategoryKey === 'main';
  const locked = !main && !isPremium;
  const pack = main ? mainPack : categoryPack;
  const title = main ? (ru ? 'Коротко о тебе' : 'You, in a few words') : getNatalReportCategory(activeCategoryKey)?.title[language];
  const reliability = getPermanentNatalReliability(chartData);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentsRef = useRef<HTMLDetailsElement>(null);
  const previousCategory = useRef(activeCategoryKey);
  useEffect(() => { setExplanation(null); }, [activeCategoryKey, chartData, isPremium, language]);
  useEffect(() => {
    if (previousCategory.current === activeCategoryKey) return;
    previousCategory.current = activeCategoryKey;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [activeCategoryKey]);
  const accuracyLabel = reliability.quality === 'exact'
    ? (ru ? 'Время рождения учтено' : 'Birth time included')
    : reliability.quality === 'approximate'
      ? (ru ? 'Время примерное. Что учтено?' : 'Approximate time. What is included?')
      : (ru ? 'Время неизвестно. Что учтено?' : 'Unknown time. What is included?');
  const readingMinutes = pack ? Math.max(1, Math.round(pack.summary.map((paragraph) => paragraph.text).join(' ').split(/\s+/u).length / 180)) : null;
  const selectChapter = (key: NatalReportCategoryKey) => {
    if (contentsRef.current) contentsRef.current.open = false;
    onSelectCategory(key);
    if (key === activeCategoryKey) headingRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const followUps = (locked ? [] : pack?.followUps || []).filter((item) => item.categoryKey !== activeCategoryKey);
  const suggestedChapters = followUps.length
    ? followUps
    : CHAPTERS.filter((key) => key !== activeCategoryKey).slice(0, 3).map((categoryKey) => ({ categoryKey, label: CHAPTER_QUESTIONS[categoryKey][language] }));
  return (
    <div className="natal-v3-experience natal-narrative-experience">
      <details className="natal-reading-contents" ref={contentsRef}>
        <summary><span>{ru ? 'Разделы разбора' : 'Reading chapters'}</span><span>{title}<ChevronDown aria-hidden="true" /></span></summary>
        <nav aria-label={ru ? 'Разделы натального разбора' : 'Natal reading chapters'}>
          {(['main', ...CHAPTERS] as const).map((key) => <button type="button" key={key} aria-current={key === activeCategoryKey ? 'page' : undefined} onClick={() => selectChapter(key)}>
            <span><strong>{key === 'main' ? (ru ? 'Коротко о тебе' : 'You, in a few words') : getNatalReportCategory(key)!.title[language]}</strong><small>{key === 'main' ? (ru ? 'Главное о характере. Бесплатно.' : 'The essentials of your character. Free.') : CHAPTER_COPY[key][language]}</small></span>
            {key !== 'main' && !isPremium ? <LockKeyhole aria-label="Premium" /> : <ChevronRight aria-hidden="true" />}
          </button>)}
        </nav>
      </details>
      <header className="natal-v3-page-heading">
        <p className="sr-only">{subjectName}</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <div className="natal-reading-meta">{!main ? <span>Premium</span> : null}{readingMinutes && !locked ? <span>{ru ? `${readingMinutes} мин чтения` : `${readingMinutes} min read`}</span> : null}</div>
        {reliability.quality !== 'exact' ? <button type="button" className="natal-v3-accuracy-link" onClick={() => setExplanation({ mode: 'accuracy', title: ru ? 'На чём основан разбор' : 'What the reading is based on' })}>{accuracyLabel}<ChevronRight aria-hidden="true" /></button> : null}
      </header>
      {locked ? (
        <section className="natal-v3-premium-section" aria-label={ru ? 'Продолжение разбора' : 'Continue the reading'}>
          <p>{mainPack?.previews.find((item) => getNatalReportCategory(activeCategoryKey)?.answerKeys.includes(item.answerKey))?.preview || CHAPTER_COPY[activeCategoryKey as keyof typeof CHAPTER_COPY]?.[language]}</p>
          {canPromotePremium ? <button id={`natal-chapter-${activeCategoryKey}`} type="button" className="natal-v3-primary-action" onClick={() => onRequestPremium(activeCategoryKey)}>{ru ? 'Читать с Premium' : 'Read with Premium'}</button> : <p>{ru ? 'Подробный разбор доступен с Premium.' : 'The detailed reading is available with Premium.'}</p>}
        </section>
      ) : pack?.summary.length ? (
        <>
          <article className="natal-narrative-copy" aria-label={title}>
            {pack.summary.map((paragraph, index) => <section className="natal-reading-observation" key={`${activeCategoryKey}-${index}`}>
              {paragraph.title ? <h2>{paragraph.title}</h2> : null}
              <p>{paragraph.text}</p>
              <button type="button" className="natal-reading-why" aria-label={`${ru ? 'Почему так' : 'Why'}: ${paragraph.title || paragraph.text.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim() || paragraph.text}`} onClick={() => setExplanation({ mode: 'why', title: paragraph.title || (ru ? 'Почему так?' : 'Why?'), text: paragraph.text, evidenceIds: paragraph.evidenceIds })}>{ru ? 'Почему так?' : 'Why?'}<ChevronRight aria-hidden="true" /></button>
            </section>)}
          </article>
        </>
      ) : categoryLoading ? (
        <div className="natal-v3-reading-loading" role="status" aria-busy="true"><span className="sr-only">{ru ? 'Готовим разбор карты' : 'Preparing the reading'}</span><span /><span /><span /><span /></div>
      ) : (
        <section className="natal-v3-reading-error" role="alert"><h2>{ru ? 'Разбор не загрузился' : 'The reading did not load'}</h2><p>{categoryError || (ru ? 'Попробуй открыть его ещё раз.' : 'Try opening it again.')}</p><button type="button" onClick={onRetryCategory}>{ru ? 'Попробовать снова' : 'Try again'}</button></section>
      )}
      <section className="natal-narrative-chapters" aria-labelledby="natal-narrative-chapters-title">
        <div className="natal-v3-section-heading"><h2 id="natal-narrative-chapters-title">{ru ? 'Что ещё про тебя?' : 'What else about you?'}</h2><p>{isPremium ? (ru ? 'Выбери, о чём хочется узнать больше.' : 'Choose what you want to explore next.') : (ru ? 'Продолжение твоего разбора с Premium.' : 'Continue your reading with Premium.')}</p></div>
        {suggestedChapters.map(({ categoryKey, label }) => {
          const category = getNatalReportCategory(categoryKey)!;
          return <button type="button" key={categoryKey} onClick={() => selectChapter(categoryKey)}><span><small>{category.title[language]}</small><strong>{label}</strong></span>{!isPremium ? <LockKeyhole aria-label="Premium" /> : <ChevronRight aria-hidden="true" />}</button>;
        })}
        <button type="button" className="natal-reading-all-chapters" onClick={() => { if (contentsRef.current) { contentsRef.current.open = true; contentsRef.current.scrollIntoView({ block: 'start', behavior: 'auto' }); contentsRef.current.querySelector('summary')?.focus(); } }}>{ru ? 'Все темы разбора' : 'All reading topics'}<ChevronDown aria-hidden="true" /></button>
      </section>
      {onOpenQuestions && isPremium ? <section className="natal-v3-ask-entry"><div><h2>{ru ? 'Есть свой вопрос?' : 'Have your own question?'}</h2><p>{ru ? 'Задай его по своей карте в «Спросить о себе».' : 'Ask about your chart in “Ask about yourself”.'}</p></div><button type="button" onClick={() => onOpenQuestions(activeCategoryKey)}>{ru ? 'Спросить о себе' : 'Ask about yourself'}<ChevronRight aria-hidden="true" /></button></section> : null}
      <NatalEvidenceSheet target={locked && explanation?.mode === 'why' ? null : explanation} profile={profile} chartData={chartData} onClose={() => setExplanation(null)} />
    </div>
  );
};
