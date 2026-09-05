import React from 'react';
import type { SynastryResult } from '../types';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle, type CompatibilityStoryTopic } from '../lib/synastry/storyTopics';
import { normalizeRelationshipContext } from '../lib/synastry/relationshipContext';

type Props = { result: SynastryResult; language: 'ru' | 'en'; subjectName: string; partnerName: string };

/** Saved prose and its saved evidence; opening a chapter performs no request. */
export function CompatibilityStoryReader({ result, language, subjectName, partnerName }: Props) {
  const ru = language === 'ru';
  const context = normalizeRelationshipContext(result.relationshipContext);
  const storedParagraphs = result.storyParagraphs;
  const paragraphs = Array.isArray(storedParagraphs) && storedParagraphs.every((item) => item
    && COMPATIBILITY_STORY_TOPICS.includes(item.topic) && typeof item.text === 'string'
    && Array.isArray(item.evidenceIds) && item.evidenceIds.every((id) => typeof id === 'string')) ? storedParagraphs : [];
  const chapters = [...new Set(paragraphs.map((paragraph) => paragraph.topic))];
  const minutes = Math.max(1, Math.round((result.summary || '').split(/\s+/u).filter(Boolean).length / 180));
  const titleFor = (topic: CompatibilityStoryTopic) => compatibilityTopicTitle(topic, context, language);
  const evidence = new Map((result.evidence || []).map((item) => [item.id, item]));
  const jumpToChapter = (topic: CompatibilityStoryTopic) => {
    const heading = document.getElementById(`compat-story-${topic}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  return <article className="compat-story-reader" aria-label={ru ? 'Разбор вашей пары' : 'Your pair reading'}>
    <div className="compat-story-reading-note">
      <span>{ru ? `${minutes} мин чтения` : `${minutes} min read`}</span>
      <span>{ru ? `«Ты» в тексте — ${subjectName}. ${partnerName} — по имени.` : `“You” means ${subjectName}. ${partnerName} is named.`}</span>
    </div>
    {chapters.length ? <nav className="compat-story-contents" aria-label={ru ? 'Разделы совместимости' : 'Compatibility chapters'}>
      <p id="compat-story-contents-title" tabIndex={-1}>{ru ? 'Что хочется узнать?' : 'What would you like to know?'}</p>
      {chapters.map((topic, index) => <button type="button" key={topic} onClick={() => jumpToChapter(topic)}>
        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{titleFor(topic)}</span><span aria-hidden="true">↗</span>
      </button>)}
    </nav> : null}
    {chapters.length ? chapters.map((topic, index) => {
      const items = paragraphs.filter((paragraph) => paragraph.topic === topic);
      const facts = [...new Set(items.flatMap((paragraph) => paragraph.evidenceIds))].map((id) => evidence.get(id)).filter((item) => item != null);
      return <section key={topic} className="compat-story-chapter" aria-labelledby={`compat-story-${topic}`}>
        <header><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2 id={`compat-story-${topic}`} tabIndex={-1}>{titleFor(topic)}</h2></header>
        {items.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph.text}</p>)}
        {facts.length ? <details className="compat-story-why">
          <summary>{ru ? 'Почему так?' : 'Why?'}</summary>
          <p>{ru ? 'Эта часть разбора опирается на связи двух карт:' : 'This chapter draws on these connections between the two charts:'}</p>
          <ul>{facts.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
        </details> : null}
        <button type="button" className="compat-story-back" onClick={() => { const title = document.getElementById('compat-story-contents-title'); title?.focus({ preventScroll: true }); title?.scrollIntoView({ block: 'start', behavior: 'auto' }); }}>{ru ? 'К разделам ↑' : 'Back to chapters ↑'}</button>
      </section>;
    }) : <div className="compat-story-chapter">{(result.summary || '').split(/\n\s*\n/u).filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</div>}
    {result.limitations?.length ? <details className="compat-story-accuracy"><summary>{ru ? 'Что зависит от точности времени' : 'What depends on birth-time accuracy'}</summary><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details> : null}
  </article>;
}
