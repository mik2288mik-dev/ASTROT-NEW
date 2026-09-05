import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, LockKeyhole } from 'lucide-react';
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
  const title = main ? (ru ? 'О тебе' : 'About you') : getNatalReportCategory(activeCategoryKey)?.title[language];
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
      ? (ru ? 'Учтена погрешность времени' : 'Birth-time uncertainty included')
      : (ru ? 'Без неизвестных домов и асцендента' : 'Without unknown houses or Ascendant');
  const readingMinutes = pack ? Math.max(1, Math.round(pack.summary.map((paragraph) => paragraph.text).join(' ').split(/\s+/u).length / 180)) : null;
  const selectChapter = (key: NatalReportCategoryKey) => {
    if (contentsRef.current) contentsRef.current.open = false;
    onSelectCategory(key);
    if (key === activeCategoryKey) headingRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  return (
    <div className="natal-v3-experience natal-narrative-experience">
      <details className="natal-reading-contents" ref={contentsRef}>
        <summary><span>{ru ? 'Разделы разбора' : 'Reading chapters'}</span><span>{title}<ChevronDown aria-hidden="true" /></span></summary>
        <nav aria-label={ru ? 'Разделы натального разбора' : 'Natal reading chapters'}>
          {(['main', ...CHAPTERS] as const).map((key, index) => <button type="button" key={key} aria-current={key === activeCategoryKey ? 'page' : undefined} onClick={() => selectChapter(key)}>
            <span className="natal-reading-chapter-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span><strong>{key === 'main' ? (ru ? 'О тебе' : 'About you') : getNatalReportCategory(key)!.title[language]}</strong><small>{key === 'main' ? (ru ? 'Цельный портрет. Доступен бесплатно.' : 'Your complete portrait. Free to read.') : CHAPTER_COPY[key][language]}</small></span>
            {key !== 'main' && !isPremium ? <LockKeyhole aria-label="Premium" /> : <ChevronRight aria-hidden="true" />}
          </button>)}
        </nav>
      </details>
      {!main ? <button type="button" className="natal-v3-back-action" onClick={() => onSelectCategory('main')}><ArrowLeft aria-hidden="true" />{ru ? 'К первому разбору' : 'Back to your first reading'}</button> : null}
      <header className="natal-v3-page-heading">
        <p>{subjectName}</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <div className="natal-reading-meta"><span>{main ? (ru ? 'Личный портрет' : 'Personal portrait') : 'Premium'}</span>{readingMinutes && !locked ? <span>{ru ? `${readingMinutes} мин чтения` : `${readingMinutes} min read`}</span> : null}</div>
        <button type="button" className="natal-v3-accuracy-link" onClick={() => setExplanation({ mode: 'accuracy', title: ru ? 'Точность разбора' : 'Reading accuracy' })}>{accuracyLabel}<ChevronRight aria-hidden="true" /></button>
      </header>
      {locked ? (
        <section className="natal-v3-premium-section" aria-label={ru ? 'Продолжение разбора' : 'Continue the reading'}>
          <p>{mainPack?.previews.find((item) => getNatalReportCategory(activeCategoryKey)?.answerKeys.includes(item.answerKey))?.preview || CHAPTER_COPY[activeCategoryKey as keyof typeof CHAPTER_COPY]?.[language]}</p>
          {canPromotePremium ? <button id={`natal-chapter-${activeCategoryKey}`} type="button" className="natal-v3-primary-action" onClick={() => onRequestPremium(activeCategoryKey)}>{ru ? 'Читать с Premium' : 'Read with Premium'}</button> : <p>{ru ? 'Подробный разбор доступен с Premium.' : 'The detailed reading is available with Premium.'}</p>}
        </section>
      ) : pack?.summary.length ? (
        <>
          <article className="natal-narrative-copy" aria-label={title}>
            {pack.summary.map((paragraph, index) => <p key={`${activeCategoryKey}-${index}`}>{paragraph.text}</p>)}
          </article>
          <details key={activeCategoryKey} className="natal-narrative-evidence">
            <summary>{ru ? 'Почему так?' : 'Why?'}</summary>
            <p>{ru ? 'Выбери мысль, чтобы посмотреть, на каких данных карты основана интерпретация.' : 'Choose a passage to see the chart data behind its interpretation.'}</p>
            {pack.summary.map((paragraph, index) => <button type="button" key={index} onClick={() => setExplanation({ mode: 'why', title: ru ? 'Основание вывода' : 'Basis for this reading', text: paragraph.text, evidenceIds: paragraph.evidenceIds })}><span>{paragraph.text.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim() || paragraph.text}</span><ChevronRight aria-hidden="true" /></button>)}
          </details>
        </>
      ) : categoryLoading ? (
        <div className="natal-v3-reading-loading" role="status" aria-busy="true"><span className="sr-only">{ru ? 'Готовим разбор карты' : 'Preparing the reading'}</span><span /><span /><span /><span /></div>
      ) : (
        <section className="natal-v3-reading-error" role="alert"><h2>{ru ? 'Разбор не загрузился' : 'The reading did not load'}</h2><p>{categoryError || (ru ? 'Попробуй открыть его ещё раз.' : 'Try opening it again.')}</p><button type="button" onClick={onRetryCategory}>{ru ? 'Попробовать снова' : 'Try again'}</button></section>
      )}
      <section className="natal-narrative-chapters" aria-labelledby="natal-narrative-chapters-title">
        <div className="natal-v3-section-heading"><h2 id="natal-narrative-chapters-title">{ru ? 'Читать дальше' : 'Keep reading'}</h2><p>{ru ? 'Каждая глава — ещё одна сторона этой карты.' : 'Each chapter explores another side of this chart.'}</p></div>
        {CHAPTERS.filter((key) => key !== activeCategoryKey).map((key) => {
          const category = getNatalReportCategory(key)!;
          const preview = mainPack?.previews.find((item) => category.answerKeys.includes(item.answerKey));
          return <button type="button" key={key} onClick={() => onSelectCategory(key)}><span><strong>{category.title[language]}</strong><small>{preview?.preview || CHAPTER_COPY[key][language]}</small></span>{!isPremium ? <LockKeyhole aria-label="Premium" /> : <ChevronRight aria-hidden="true" />}</button>;
        })}
      </section>
      {onOpenQuestions && isPremium ? <section className="natal-v3-ask-entry"><button type="button" onClick={() => onOpenQuestions(activeCategoryKey)}>{ru ? 'Спросить о себе' : 'Ask about yourself'}<ChevronRight aria-hidden="true" /></button></section> : null}
      <NatalEvidenceSheet target={explanation} profile={profile} chartData={chartData} onClose={() => setExplanation(null)} />
    </div>
  );
};
