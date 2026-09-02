import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, LockKeyhole } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import {
  NATAL_REPORT_CATEGORIES,
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
  type NatalReportStatement,
} from '../../lib/natalReading/reportCatalog';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { NatalWhySheet } from './NatalWhySheet';
import styles from '../../styles/NatalMeaningExperience.module.css';

type OpenSource = 'section_grid' | 'continue' | 'history' | 'related_question' | 'paywall_return';

type Props = {
  mode: 'foundation' | 'explore';
  language: 'ru' | 'en';
  profile: UserProfile;
  chartData: NatalChartData;
  categoryKey: NatalReportCategoryKey;
  categoryPack: NatalReportCategoryPack | null;
  categoryLoading: boolean;
  categoryError: string | null;
  selectedAnswerKey: NatalReportAnswerKey | null;
  selectedPreview: NatalReportCategoryPack['previews'][number] | null;
  selectedAnswer: NatalReportAnswer | null;
  answerLoading: boolean;
  answerError: string | null;
  isPremium: boolean;
  canPromoteAccess: boolean;
  onSelectCategory: (categoryKey: NatalReportCategoryKey) => void;
  onOpenExplore: (categoryKey: NatalReportCategoryKey) => void;
  onOpenAnswer: (answerKey: NatalReportAnswerKey, source: OpenSource) => void;
  onCloseAnswer: () => void;
  onRetryCategory: () => void;
  onRetryAnswer: () => void;
  onRequestAccess: (answerKey: NatalReportAnswerKey) => void;
  onOpenQuestions?: (categoryKey?: NatalReportCategoryKey) => void;
};

type WhyTarget = {
  text: string;
  evidenceIds: string[];
};

const DEEP_CATEGORIES = NATAL_REPORT_CATEGORIES.filter(
  (category) => category.key !== 'main',
);

const CATEGORY_DESCRIPTIONS: Record<
  Exclude<NatalReportCategoryKey, 'main'>,
  { ru: string; en: string }
> = {
  character: {
    ru: 'Как ты решаешь, реагируешь и меняешь планы.',
    en: 'How you decide, react, and change plans.',
  },
  love: {
    ru: 'Кого выбираешь, как сближаешься и что отталкивает.',
    en: 'Who you choose, how you get close, and what puts you off.',
  },
  communication: {
    ru: 'Как говоришь, споришь и просишь о помощи.',
    en: 'How you speak, argue, and ask for help.',
  },
  work: {
    ru: 'Как начинаешь, выдерживаешь рутину и работаешь с людьми.',
    en: 'How you start, handle routine, and work with people.',
  },
  money: {
    ru: 'Как тратишь, рискуешь и называешь свою цену.',
    en: 'How you spend, take risks, and name your price.',
  },
};

function LoadingState() {
  return (
    <div className={styles.loading} role="status" aria-busy="true">
      <span className={styles.loadingLine} />
      <span className={styles.loadingLine} />
      <span className={styles.loadingLine} />
      <span className={styles.loadingLine} />
    </div>
  );
}

function ErrorState({
  language,
  message,
  onRetry,
}: {
  language: 'ru' | 'en';
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <section className={styles.error} role="alert">
      <h2>{language === 'ru' ? 'Не открылось' : 'It did not open'}</h2>
      <p>
        {message || (language === 'ru'
          ? 'Попробуй ещё раз. Если сеть в порядке, мы уже увидим ошибку.'
          : 'Try again. If the connection is fine, the error will already be visible to us.')}
      </p>
      <button type="button" className={styles.primaryAction} onClick={onRetry}>
        {language === 'ru' ? 'Повторить' : 'Try again'}
      </button>
    </section>
  );
}

function MeaningPoint({
  statement,
  example,
  language,
  onWhy,
}: {
  statement: NatalReportStatement;
  example?: NatalReportStatement | null;
  language: 'ru' | 'en';
  onWhy: (target: WhyTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={styles.meaningPoint}>
      <p className={styles.meaningText}>{statement.text}</p>
      <div className={styles.meaningActions}>
        {example?.text ? (
          <button
            type="button"
            className={styles.textAction}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? (language === 'ru' ? 'Свернуть' : 'Hide example')
              : (language === 'ru' ? 'Как это выглядит' : 'How this looks')}
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.textAction} ${styles.textActionStrong}`}
          onClick={() => onWhy({
            text: statement.text,
            evidenceIds: [...statement.evidenceIds],
          })}
        >
          {language === 'ru' ? 'Почему так?' : 'Why this?'}
        </button>
      </div>
      {expanded && example?.text ? (
        <p className={styles.meaningExample}>{example.text}</p>
      ) : null}
    </article>
  );
}

function FoundationOrbit({
  language,
  onOpen,
}: {
  language: 'ru' | 'en';
  onOpen: (categoryKey: NatalReportCategoryKey) => void;
}) {
  return (
    <nav
      className={styles.orbit}
      aria-label={language === 'ru' ? 'Что можно разобрать' : 'What you can explore'}
    >
      <div className={styles.orbitCenter}>
        {language === 'ru' ? 'Главное' : 'The core'}
      </div>
      {DEEP_CATEGORIES.map((category) => (
        <button
          key={category.key}
          type="button"
          className={[
            styles.orbitNode,
            category.key === 'character' ? styles.orbitCharacter : '',
            category.key === 'love' ? styles.orbitLove : '',
            category.key === 'communication' ? styles.orbitCommunication : '',
            category.key === 'work' ? styles.orbitWork : '',
            category.key === 'money' ? styles.orbitMoney : '',
          ].filter(Boolean).join(' ')}
          onClick={() => onOpen(category.key)}
        >
          {category.title[language]}
        </button>
      ))}
    </nav>
  );
}

function TopicPicker({
  activeCategory,
  language,
  onSelect,
}: {
  activeCategory: NatalReportCategoryKey;
  language: 'ru' | 'en';
  onSelect: (categoryKey: NatalReportCategoryKey) => void;
}) {
  return (
    <nav
      className={styles.topicPicker}
      aria-label={language === 'ru' ? 'Части разбора' : 'Reading topics'}
    >
      {DEEP_CATEGORIES.map((category) => {
        const active = category.key === activeCategory;
        return (
          <button
            key={category.key}
            type="button"
            className={`${styles.topicNode}${active ? ` ${styles.topicNodeActive}` : ''}`}
            data-tone={category.key}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(category.key)}
          >
            <span className={styles.topicNodeCircle}>{category.title[language]}</span>
            <span>{active ? (language === 'ru' ? 'Сейчас' : 'Open') : category.title[language]}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Foundation({
  language,
  categoryPack,
  onWhy,
  onOpenExplore,
  onOpenQuestions,
}: {
  language: 'ru' | 'en';
  categoryPack: NatalReportCategoryPack;
  onWhy: (target: WhyTarget) => void;
  onOpenExplore: (categoryKey: NatalReportCategoryKey) => void;
  onOpenQuestions?: (categoryKey?: NatalReportCategoryKey) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const points = showAll ? categoryPack.summary : categoryPack.summary.slice(0, 3);

  return (
    <>
      <header className={styles.foundationIntro}>
        <p className={styles.eyebrow}>
          {language === 'ru' ? 'Твоя карта без перевода с астрологического' : 'Your chart without astrology jargon'}
        </p>
        <h1>{language === 'ru' ? 'Главное о тебе' : 'The main things about you'}</h1>
        <p>
          {language === 'ru'
            ? 'Сначала — то, что повторяется чаще всего. Дальше можно разобрать любую часть.'
            : 'Start with what repeats most often. Then open any part in more detail.'}
        </p>
      </header>

      <FoundationOrbit language={language} onOpen={onOpenExplore} />

      <section aria-labelledby="natal-foundation-points">
        <div className={styles.sectionHeading}>
          <h2 id="natal-foundation-points">
            {language === 'ru' ? 'Что важно знать' : 'What is worth knowing'}
          </h2>
          <p>
            {language === 'ru'
              ? 'Коротко. Но не наугад.'
              : 'Brief, but not random.'}
          </p>
        </div>
        <div className={styles.meaningList}>
          {points.map((statement, index) => (
            <MeaningPoint
              key={`foundation-${index}`}
              statement={statement}
              example={categoryPack.observations[index] || null}
              language={language}
              onWhy={onWhy}
            />
          ))}
        </div>
        {categoryPack.summary.length > 3 ? (
          <button
            type="button"
            className={styles.showMore}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? (language === 'ru' ? 'Оставить главное' : 'Show only the main points')
              : (language === 'ru' ? 'Показать ещё' : 'Show more')}
          </button>
        ) : null}
      </section>

      <div className={styles.secondaryLinks}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => onOpenExplore('character')}
        >
          {language === 'ru' ? 'Разобрать по частям' : 'Explore each part'}
        </button>
        {onOpenQuestions ? (
          <button
            type="button"
            className={styles.askAction}
            onClick={() => onOpenQuestions('main')}
          >
            {language === 'ru' ? 'Задать свой вопрос' : 'Ask your own question'}
          </button>
        ) : null}
      </div>
    </>
  );
}

function Explore({
  language,
  categoryKey,
  categoryPack,
  isPremium,
  onWhy,
  onSelectCategory,
  onOpenAnswer,
  onOpenQuestions,
}: {
  language: 'ru' | 'en';
  categoryKey: NatalReportCategoryKey;
  categoryPack: NatalReportCategoryPack;
  isPremium: boolean;
  onWhy: (target: WhyTarget) => void;
  onSelectCategory: (categoryKey: NatalReportCategoryKey) => void;
  onOpenAnswer: (answerKey: NatalReportAnswerKey, source: OpenSource) => void;
  onOpenQuestions?: (categoryKey?: NatalReportCategoryKey) => void;
}) {
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    setShowAllQuestions(false);
  }, [categoryKey]);

  const category = getNatalReportCategory(categoryKey);
  const description = categoryKey === 'main'
    ? (language === 'ru' ? 'Самое заметное в карте.' : 'The clearest part of the chart.')
    : CATEGORY_DESCRIPTIONS[categoryKey][language];
  const visibleQuestions = showAllQuestions
    ? categoryPack.previews
    : categoryPack.previews.slice(0, 5);
  const mainStatements = categoryPack.summary.slice(0, 2);

  return (
    <>
      <TopicPicker
        activeCategory={categoryKey}
        language={language}
        onSelect={onSelectCategory}
      />

      <header className={styles.exploreIntro}>
        <p className={styles.eyebrow}>
          {language === 'ru' ? 'Разобрать подробнее' : 'Go deeper'}
        </p>
        <h1>{category?.title[language] || categoryPack.title}</h1>
        <p>{description}</p>
      </header>

      {mainStatements.length ? (
        <section className={styles.topicSummary} aria-label={categoryPack.title}>
          <div className={styles.meaningList}>
            {mainStatements.map((statement, index) => (
              <MeaningPoint
                key={`${categoryKey}-summary-${index}`}
                statement={statement}
                example={categoryPack.observations[index] || null}
                language={language}
                onWhy={onWhy}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.questionSection} aria-labelledby="natal-more-questions">
        <header className={styles.questionSectionHeader}>
          <h2 id="natal-more-questions">
            {language === 'ru' ? 'Что ещё можно узнать' : 'What else you can learn'}
          </h2>
        </header>
        <ul className={styles.questionList} role="list">
          {visibleQuestions.map((preview) => {
            const locked = !isPremium && !isNatalReportAnswerFree(preview.answerKey);
            return (
              <li key={preview.answerKey}>
                <button
                  type="button"
                  className={styles.questionRow}
                  onClick={() => onOpenAnswer(preview.answerKey, 'section_grid')}
                >
                  <span className={styles.questionCopy}>
                    <strong>{preview.title}</strong>
                    {preview.preview ? <span>{preview.preview}</span> : null}
                  </span>
                  <span className={styles.questionEnd}>
                    {locked ? <LockKeyhole className={styles.lock} aria-hidden="true" /> : null}
                    <ChevronRight aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {categoryPack.previews.length > 5 ? (
          <button
            type="button"
            className={styles.showMore}
            onClick={() => setShowAllQuestions((value) => !value)}
          >
            {showAllQuestions
              ? (language === 'ru' ? 'Свернуть список' : 'Show fewer')
              : (language === 'ru' ? 'Показать остальные' : 'Show the rest')}
          </button>
        ) : null}
      </section>

      {onOpenQuestions ? (
        <section className={styles.askStrip}>
          <h2>{language === 'ru' ? 'Не нашёл свой вопрос?' : 'Did not find your question?'}</h2>
          <p>
            {language === 'ru'
              ? 'Напиши своими словами. Ответ останется здесь.'
              : 'Write it in your own words. The answer will stay here.'}
          </p>
          <button
            type="button"
            className={styles.askAction}
            onClick={() => onOpenQuestions(categoryKey)}
          >
            {language === 'ru' ? 'Спросить по этой теме' : 'Ask about this topic'}
          </button>
        </section>
      ) : null}
    </>
  );
}

export const NatalMeaningExperience: React.FC<Props> = ({
  mode,
  language,
  profile,
  chartData,
  categoryKey,
  categoryPack,
  categoryLoading,
  categoryError,
  selectedAnswerKey,
  selectedPreview,
  selectedAnswer,
  answerLoading,
  answerError,
  isPremium,
  canPromoteAccess,
  onSelectCategory,
  onOpenExplore,
  onOpenAnswer,
  onCloseAnswer,
  onRetryCategory,
  onRetryAnswer,
  onRequestAccess,
  onOpenQuestions,
}) => {
  const [whyTarget, setWhyTarget] = useState<WhyTarget | null>(null);
  const selectedDefinition = selectedAnswerKey
    ? getNatalReportAnswer(selectedAnswerKey)
    : null;
  const answerTitle = selectedAnswer?.title
    || selectedPreview?.title
    || selectedDefinition?.title[language]
    || (language === 'ru' ? 'Ответ по карте' : 'Chart answer');
  const canReadAnswer = Boolean(
    selectedAnswerKey
    && (isPremium || isNatalReportAnswerFree(selectedAnswerKey)),
  );
  const answerPending = Boolean(
    selectedAnswerKey
    && canReadAnswer
    && !selectedAnswer
    && !answerError
    && answerLoading,
  );
  const answerEvidence = useMemo(
    () => selectedAnswer?.paragraphs.flatMap((paragraph) => paragraph.evidenceIds)
      || selectedPreview?.evidenceIds
      || [],
    [selectedAnswer, selectedPreview],
  );
  const answerStatement = selectedAnswer?.paragraphs[0]?.text
    || selectedPreview?.preview
    || answerTitle;
  const relatedKeys = (
    selectedAnswer?.related
    || selectedPreview?.related
    || selectedDefinition?.related
    || []
  ).slice(0, 3);

  if (categoryLoading && !categoryPack) {
    return <main className={styles.root}><LoadingState /></main>;
  }

  if (categoryError || !categoryPack) {
    return (
      <main className={styles.root}>
        <ErrorState language={language} message={categoryError} onRetry={onRetryCategory} />
      </main>
    );
  }

  return (
    <>
      <main className={styles.root}>
        {mode === 'foundation' ? (
          <Foundation
            language={language}
            categoryPack={categoryPack}
            onWhy={setWhyTarget}
            onOpenExplore={onOpenExplore}
            onOpenQuestions={onOpenQuestions}
          />
        ) : (
          <Explore
            language={language}
            categoryKey={categoryKey}
            categoryPack={categoryPack}
            isPremium={isPremium}
            onWhy={setWhyTarget}
            onSelectCategory={onSelectCategory}
            onOpenAnswer={onOpenAnswer}
            onOpenQuestions={onOpenQuestions}
          />
        )}
      </main>

      <CosmicSheet
        open={Boolean(selectedAnswerKey)}
        title={answerTitle}
        subtitle={selectedDefinition
          ? getNatalReportCategory(selectedDefinition.categoryKey)?.title[language]
          : undefined}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={onCloseAnswer}
        className="lz-sheet-panel--editorial"
        contentClassName="lz-sheet-scroll--editorial"
      >
        {canReadAnswer && selectedAnswer ? (
          <>
            <div className={styles.answerBody}>
              {selectedAnswer.paragraphs.map((paragraph, index) => (
                <p key={`${selectedAnswer.answerKey}-${index}`}>{paragraph.text}</p>
              ))}
            </div>
            <div className={styles.answerActions}>
              <button
                type="button"
                className={`${styles.textAction} ${styles.textActionStrong}`}
                onClick={() => setWhyTarget({
                  text: answerStatement,
                  evidenceIds: [...answerEvidence],
                })}
              >
                {language === 'ru' ? 'Почему так?' : 'Why this?'}
              </button>
            </div>
          </>
        ) : answerPending ? (
          <LoadingState />
        ) : canReadAnswer && answerError ? (
          <ErrorState language={language} message={answerError} onRetry={onRetryAnswer} />
        ) : canReadAnswer ? (
          <ErrorState language={language} message={null} onRetry={onRetryAnswer} />
        ) : (
          <section className={styles.answerLocked}>
            <p className={styles.answerPreview}>
              {selectedPreview?.preview || (language === 'ru'
                ? 'Продолжение уже готово. Оно откроется вместе с остальными частями карты.'
                : 'The continuation is ready. It opens together with the rest of the chart.')}
            </p>
            <p className={styles.answerLockedNote}>
              {language === 'ru'
                ? 'Без отдельной покупки каждого ответа.'
                : 'No separate purchase for every answer.'}
            </p>
            {canPromoteAccess && selectedAnswerKey ? (
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => onRequestAccess(selectedAnswerKey)}
              >
                {language === 'ru' ? 'Открыть продолжение' : 'Open the continuation'}
              </button>
            ) : null}
            {answerEvidence.length ? (
              <button
                type="button"
                className={styles.textAction}
                onClick={() => setWhyTarget({
                  text: answerStatement,
                  evidenceIds: [...answerEvidence],
                })}
              >
                {language === 'ru' ? 'Почему такой вывод?' : 'Why this conclusion?'}
              </button>
            ) : null}
          </section>
        )}

        {selectedAnswerKey && relatedKeys.length ? (
          <section className={styles.related}>
            <h3>{language === 'ru' ? 'Рядом с этим' : 'Related to this'}</h3>
            <ul className={styles.relatedList} role="list">
              {relatedKeys.map((answerKey) => {
                const definition = getNatalReportAnswer(answerKey);
                if (!definition) return null;
                const locked = !isPremium && !isNatalReportAnswerFree(answerKey);
                return (
                  <li key={answerKey}>
                    <button
                      type="button"
                      className={styles.answerLink}
                      onClick={() => onOpenAnswer(answerKey, 'related_question')}
                    >
                      <span>{definition.title[language]}</span>
                      <span className={styles.questionEnd}>
                        {locked ? <LockKeyhole className={styles.lock} aria-hidden="true" /> : null}
                        <ChevronRight aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </CosmicSheet>

      <NatalWhySheet
        open={Boolean(whyTarget)}
        statement={whyTarget?.text || ''}
        evidenceIds={whyTarget?.evidenceIds || []}
        profile={profile}
        chartData={chartData}
        onClose={() => setWhyTarget(null)}
      />
    </>
  );
};
