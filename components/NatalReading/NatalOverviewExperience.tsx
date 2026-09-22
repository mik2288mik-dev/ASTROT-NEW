import React, { createContext, useContext, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, LockKeyhole } from 'lucide-react';
import { NatalMeaningExperience } from './NatalMeaningExperience';
import { NatalEvidenceSheet, type NatalExplanationTarget } from './NatalEvidenceSheet';
import { getNatalReportCategory, type NatalReportCategoryKey } from '../../lib/natalReading/reportCatalog';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import styles from './NatalSection.module.css';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { NatalArtwork, type NatalArt } from './NatalArtwork';

export const NatalOverviewMode = createContext<{mode:'story' | 'topics'; onTopics:() => void}>({mode:'story',onTopics:() => {}});
const TOPICS: { key: NatalReportCategoryKey; title: string; description: string }[] = [
  { key: 'character', title: 'Характер', description: 'Как ты принимаешь решения и действуешь.' },
  { key: 'love', title: 'Отношения', description: 'Что для тебя важно рядом с человеком.' },
  { key: 'communication', title: 'Общение', description: 'Как ты говоришь и понимаешь других.' },
  { key: 'work', title: 'Работа', description: 'Как ты берёшься за дела и работаешь.' },
  { key: 'money', title: 'Деньги', description: 'Как ты тратишь, копишь и зарабатываешь.' },
];

/** Presentation of the existing report packs; generation and access stay in NatalCatalogReport. */
export function NatalOverviewExperience(props: React.ComponentProps<typeof NatalMeaningExperience>) {
  const {mode,onTopics} = useContext(NatalOverviewMode);
  const { profile, chartData, mainPack, categoryPack, activeCategoryKey, isPremium,
    categoryLoading, categoryError, canPromotePremium, onSelectCategory,
    onRequestPremium, onRetryCategory, onOpenQuestions } = props;
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  useEffect(() => { setExplanation(null); }, [activeCategoryKey, chartData, mode]);
  useEffect(() => { if (mode === 'story' && activeCategoryKey !== 'main') onSelectCategory('main'); }, [mode, activeCategoryKey, onSelectCategory]);
  const main = mode === 'story' || activeCategoryKey === 'main';
  const pack = main ? mainPack : categoryPack;
  const story = (isPremium ? mainPack?.premiumStory : undefined) || mainPack?.story || (mainPack?.summary.length ? {
    text: mainPack.summary.map((paragraph) => paragraph.text).join(' '),
    evidenceIds: [...new Set(mainPack.summary.flatMap((paragraph) => paragraph.evidenceIds))],
  } : null);
  const locked = !main && !isPremium;
  const quality = getPermanentNatalReliability(chartData).quality;
  const title = TOPICS.find(topic => topic.key === activeCategoryKey)?.title || getNatalReportCategory(activeCategoryKey)?.title.ru;
  const extraTopics = [
    { title: 'Эмоции', paragraphs: (mainPack?.summary || []).filter(p => p.evidenceIds.some(id => /position[.:_-]moon$/i.test(id))) },
    { title: 'Дом и семья', paragraphs: (mainPack?.summary || []).filter(p => /семь|родител|домашн|свой дом|своего дома/i.test(p.text)) },
  ].filter(topic => topic.paragraphs.length > 0);
  const why = (paragraphs: NonNullable<typeof pack>['summary'], heading: string) => setExplanation({ mode: 'why', title: heading, text: paragraphs.map(p => p.text).join('\n\n'), evidenceIds: [...new Set(paragraphs.flatMap(p => p.evidenceIds))] });
  const topicArt = (key: NatalReportCategoryKey): NatalArt => key === 'main' ? 'character' : key as NatalArt;
  useEffect(() => {
    if (main || explanation) return;
    const onBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      event.stopImmediatePropagation(); onSelectCategory('main');
    };
    window.addEventListener(NATIVE_BACK_EVENT, onBack, true);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onBack, true);
  }, [main, explanation, onSelectCategory]);
  return <div className={styles.overview}>
    {quality !== 'exact' ? <button className={styles.why} type="button" onClick={() => setExplanation({mode:'accuracy',title:'На чём основан обзор'})}>{quality === 'unknown' ? 'Время неизвестно. Что учтено?' : 'Время примерное. Что учтено?'}<ChevronRight size={17} aria-hidden="true"/></button> : null}
    {!main ? <header className={styles.chapterHeading}><button type="button" onClick={() => onSelectCategory('main')}><ChevronLeft size={18} aria-hidden="true"/>Все темы</button><div className={styles.chapterTitle}><h2>{title}</h2><NatalArtwork art={topicArt(activeCategoryKey)}/></div></header> : null}
    {mode === 'topics' && main ? extraTopics.map(topic => <details key={topic.title} className={styles.observation}><summary><span aria-hidden="true" className={styles.topicArtwork} data-art={topic.title === 'Эмоции' ? 'emotions' : 'home'}/><span>{topic.title}<small>{topic.title === 'Эмоции' ? 'Как ты реагируешь на происходящее.' : 'Что для тебя дом и близкие.'}</small></span><ChevronRight size={18} aria-hidden="true"/></summary>{topic.paragraphs.map((paragraph,index) => <p key={index}>{paragraph.text}</p>)}<button className={styles.why} type="button" onClick={() => why(topic.paragraphs,topic.title)}><CircleHelp size={17} aria-hidden="true"/>Почему так?</button></details>) : locked ? <section className={styles.state}><p>{TOPICS.find(topic => topic.key === activeCategoryKey)?.description}</p>{canPromotePremium ? <button type="button" onClick={() => onRequestPremium(activeCategoryKey)}>Читать с NEBO+</button> : <p>Подробная тема доступна с NEBO+.</p>}</section>
      : mode === 'story' && story ? <article aria-label="Рассказ о тебе" className={styles.story}>
        {story.text.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}
        <button className={styles.why} type="button" onClick={() => setExplanation({ mode: 'why', title: 'На чём основан рассказ', text: story.text, evidenceIds: story.evidenceIds })}><CircleHelp size={17} aria-hidden="true"/>Почему так?</button>
      </article> : pack?.summary.length ? <article aria-label={title || 'Основные наблюдения'} className={styles.observations}>
        {pack.summary.map((paragraph, index) => <p key={index}>{paragraph.text}</p>)}
        <button className={styles.why} type="button" onClick={() => why(pack.summary,title || 'Разбор темы')}><CircleHelp size={17} aria-hidden="true"/>Почему так?</button>
      </article> : categoryLoading ? <p className={styles.state} role="status">Загружаем разбор карты…</p> : <section className={styles.state} role="alert"><p>{categoryError || 'Разбор пока не загрузился.'}</p><button type="button" onClick={onRetryCategory}>Попробовать снова</button></section>}
    {mode === 'topics' && main ? <nav className={styles.topics} aria-label="Темы обзора">{TOPICS.map(topic => <button type="button" key={topic.key} data-topic={topic.key} onClick={() => onSelectCategory(topic.key)}><span aria-hidden="true" className={styles.topicArtwork} data-art={topic.key}/><span><strong>{topic.title}</strong><small>{topic.description}</small></span>{!isPremium ? <LockKeyhole size={19} aria-label="Premium"/> : <ChevronRight size={19} aria-hidden="true"/>}</button>)}</nav> : null}
    {mode === 'story' && Boolean(story) && Boolean(mainPack?.followUps?.length) ? <nav className={styles.readingLinks} aria-label="Продолжить чтение">{mainPack?.followUps?.slice(0,onOpenQuestions ? 2 : 3).map(item => <button key={item.categoryKey} type="button" onClick={() => {onTopics(); onSelectCategory(item.categoryKey);}}>{item.label}<ChevronRight size={18} aria-hidden="true"/></button>)}</nav> : null}
    {mode === 'story' && onOpenQuestions ? <button className={styles.readingLink} type="button" onClick={() => onOpenQuestions(activeCategoryKey)}>Есть свой вопрос? Спросить<ChevronRight size={18} aria-hidden="true"/></button> : null}
    <NatalEvidenceSheet target={locked && explanation?.mode === 'why' ? null : explanation} profile={profile} chartData={chartData} onClose={() => setExplanation(null)}/>
  </div>;
}
