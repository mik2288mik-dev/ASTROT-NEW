import React from 'react';
import type { SynastryResult } from '../types';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle, type CompatibilityStoryTopic } from '../lib/synastry/storyTopics';
import { CompatibilityAnswers } from './CompatibilityAnswers';

type Props = { result: SynastryResult; language: 'ru' | 'en'; subjectName: string; partnerName: string };

/** Saved prose and its evidence; rendering makes no request. */
export function CompatibilityStoryReader({ result, language }: Props) {
  const ru = language === 'ru';
  const storedParagraphs = Array.isArray(result.storyParagraphs) ? result.storyParagraphs : [];
  const validParagraphs = storedParagraphs.every((item) => item && typeof item.text === 'string'
    && Array.isArray(item.evidenceIds) && item.evidenceIds.every((id) => typeof id === 'string')) ? storedParagraphs : [];
  const answerTexts = new Map(validParagraphs.filter((item) => item.questionId).map((item) => [item.questionId!, item.text]));
  const questions = Array.isArray(result.questions) && answerTexts.size ? result.questions : [];
  // Readings saved before the question format keep their old chapters.
  const legacyParagraphs = questions.length ? [] : COMPATIBILITY_STORY_TOPICS.flatMap((topic) => validParagraphs.filter((paragraph) => paragraph.topic === topic));
  const titleFor = (topic: CompatibilityStoryTopic) => compatibilityTopicTitle(topic, result.relationshipContext || 'romance', language);
  const evidence = new Map((result.evidence || []).map((item) => [item.id, item]));
  const allFacts = [...new Set(validParagraphs.flatMap((paragraph) => paragraph.evidenceIds))]
    .map((id) => evidence.get(id))
    .filter((item): item is NonNullable<typeof item> => item != null);
  const influence = questions.length ? (result.directionalPatterns || []) : [];
  return <article className="compat-story-reader" aria-label={ru ? 'Разбор вашей пары' : 'Your pair reading'}>
    {questions.length ? <CompatibilityAnswers
      language={language}
      rows={questions.map((question) => ({ ...question, text: answerTexts.get(question.id) || null }))}
      unknownHint={ru ? 'Чтобы ответить, нужно точное время рождения обоих.' : 'Both exact birth times are needed to answer this.'}
    /> : legacyParagraphs.length ? legacyParagraphs.map((paragraph) => <section key={paragraph.topic} className="compat-story-chapter" aria-labelledby={`compat-story-${paragraph.topic}`}>
      <header><h2 id={`compat-story-${paragraph.topic}`} tabIndex={-1}>{titleFor(paragraph.topic!)}</h2></header>
      <p>{paragraph.text}</p>
    </section>) : <div className="compat-story-chapter">{(result.summary || '').split(/\n\s*\n/u).filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</div>}
    {influence.length ? <section className="compat-answers-influence" aria-label={ru ? 'Кто на кого как влияет' : 'Who affects whom'}>
      <h3>{ru ? 'Кто на кого как влияет' : 'Who affects whom'}</h3>
      {influence.map((item) => <React.Fragment key={item.id}><h4>{item.title}</h4><p>{item.fact}</p></React.Fragment>)}
    </section> : null}
    {(allFacts.length || result.limitations?.length) ? <details className="compat-story-why compat-story-why--final">
      <summary>{ru ? 'Почему так?' : 'Why?'}</summary>
      {allFacts.length ? <><p>{ru ? 'Этот разбор опирается на связи двух карт:' : 'This reading draws on these connections between the two charts:'}</p><ul>{allFacts.map((item) => <li key={item.id}>{item.label}</li>)}</ul></> : null}
      {result.limitations?.length ? <><p>{ru ? 'Что зависит от точности времени:' : 'What depends on birth-time accuracy:'}</p><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
    </details> : null}
  </article>;
}
