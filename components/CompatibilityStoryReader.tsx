import React from 'react';
import type { SynastryResult } from '../types';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle, type CompatibilityStoryTopic } from '../lib/synastry/storyTopics';

type Props = { result: SynastryResult; language: 'ru' | 'en'; subjectName: string; partnerName: string };

/** Saved prose and its evidence; rendering makes no request. */
export function CompatibilityStoryReader({ result, language }: Props) {
  const ru = language === 'ru';
  const storedParagraphs = result.storyParagraphs;
  const paragraphs = Array.isArray(storedParagraphs) && storedParagraphs.every((item) => item
    && COMPATIBILITY_STORY_TOPICS.includes(item.topic) && typeof item.text === 'string'
    && Array.isArray(item.evidenceIds) && item.evidenceIds.every((id) => typeof id === 'string')) ? storedParagraphs : [];
  const orderedParagraphs = COMPATIBILITY_STORY_TOPICS.flatMap((topic) => paragraphs.filter((paragraph) => paragraph.topic === topic));
  const titleFor = (topic: CompatibilityStoryTopic) => compatibilityTopicTitle(topic, result.relationshipContext || 'romance', language);
  const evidence = new Map((result.evidence || []).map((item) => [item.id, item]));
  const allFacts = [...new Set(paragraphs.flatMap((paragraph) => paragraph.evidenceIds))]
    .map((id) => evidence.get(id))
    .filter((item): item is NonNullable<typeof item> => item != null);
  return <article className="compat-story-reader" aria-label={ru ? 'Разбор вашей пары' : 'Your pair reading'}>
    {orderedParagraphs.length ? orderedParagraphs.map((paragraph) => <section key={paragraph.topic} className="compat-story-chapter" aria-labelledby={`compat-story-${paragraph.topic}`}>
      <header><h2 id={`compat-story-${paragraph.topic}`} tabIndex={-1}>{titleFor(paragraph.topic)}</h2></header>
      <p>{paragraph.text}</p>
    </section>) : <div className="compat-story-chapter">{(result.summary || '').split(/\n\s*\n/u).filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</div>}
    {(allFacts.length || result.limitations?.length) ? <details className="compat-story-why compat-story-why--final">
      <summary>{ru ? 'Почему так?' : 'Why?'}</summary>
      {allFacts.length ? <><p>{ru ? 'Этот разбор опирается на связи двух карт:' : 'This reading draws on these connections between the two charts:'}</p><ul>{allFacts.map((item) => <li key={item.id}>{item.label}</li>)}</ul></> : null}
      {result.limitations?.length ? <><p>{ru ? 'Что зависит от точности времени:' : 'What depends on birth-time accuracy:'}</p><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
    </details> : null}
  </article>;
}
