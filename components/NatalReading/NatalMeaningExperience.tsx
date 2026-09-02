import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Heart,
  LockKeyhole,
  MessageCircle,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import {
  NATAL_REPORT_ANSWER_COUNT,
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
  type NatalReportPreview,
  type NatalReportStatement,
} from '../../lib/natalReading/reportCatalog';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import {
  NatalEvidenceSheet,
  type NatalExplanationTarget,
} from './NatalEvidenceSheet';

export type NatalExperienceView = 'foundation' | 'explore';
export type NatalExperienceOpenSource = 'section_grid' | 'related_question';

const DOMAIN_KEYS = [
  'character',
  'love',
  'communication',
  'work',
  'money',
] as const satisfies readonly NatalReportCategoryKey[];

type DomainKey = (typeof DOMAIN_KEYS)[number];

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  subjectName: string;
  view: NatalExperienceView;
  activeCategoryKey: NatalReportCategoryKey;
  mainPack: NatalReportCategoryPack | null;
  categoryPack: NatalReportCategoryPack | null;
  categoryLoading: boolean;
  categoryError: string | null;
  selectedAnswerKey: NatalReportAnswerKey | null;
  selectedPreview: NatalReportPreview | null;
  selectedAnswer: NatalReportAnswer | null;
  answerLoading: boolean;
  answerError: string | null;
  isPremium: boolean;
  canPromotePremium: boolean;
  bookmarkedAnswerKeys: ReadonlySet<NatalReportAnswerKey>;
  focusRequestId: number;
  onChangeView: (view: NatalExperienceView) => void;
  onSelectCategory: (categoryKey: NatalReportCategoryKey) => void;
  onOpenAnswer: (answerKey: NatalReportAnswerKey, source: NatalExperienceOpenSource) => void;
  onCloseAnswer: () => void;
  onRetryCategory: () => void;
  onRetryAnswer: () => void;
  onRequestPremium: (answerKey: NatalReportAnswerKey) => void;
  onToggleBookmark: (answerKey: NatalReportAnswerKey) => void;
  onOpenQuestions?: (categoryKey: NatalReportCategoryKey) => void;
};

const DOMAIN_COPY: Record<DomainKey, {
  ru: { description: string; ask: string; premium: string };
  en: { description: string; ask: string; premium: string };
}> = {
  character: {
    ru: {
      description: 'Как ты принимаешь решения, меняешь планы, злишься и держишь своё.',
      ask: 'Спросить про характер',
      premium: 'решения, раздражение, скуку, упрямство и реакцию на сорванные планы',
    },
    en: {
      description: 'How you decide, change plans, get irritated, and stand your ground.',
      ask: 'Ask about character',
      premium: 'decisions, irritation, boredom, persistence, and broken plans',
    },
  },
  love: {
    ru: {
      description: 'Кого ты выбираешь, как сближаешься, что удерживает интерес и что его обрывает.',
      ask: 'Спросить про отношения',
      premium: 'выбор партнёра, сближение, дистанцию, потерю интереса и подходящий тип отношений',
    },
    en: {
      description: 'Who you choose, how you get close, what keeps interest, and what ends it.',
      ask: 'Ask about relationships',
      premium: 'attraction, closeness, distance, loss of interest, and the relationship that fits you',
    },
  },
  communication: {
    ru: {
      description: 'Как ты знакомишься, говоришь прямо, споришь, переписываешься и миришься.',
      ask: 'Спросить про общение',
      premium: 'знакомства, переписку, критику, ссоры, недопонимание и просьбы о помощи',
    },
    en: {
      description: 'How you meet people, speak directly, argue, text, and make peace.',
      ask: 'Ask about communication',
      premium: 'first meetings, texting, criticism, arguments, misunderstandings, and asking for help',
    },
  },
  work: {
    ru: {
      description: 'Как ты начинаешь дела, переносишь рутину, работаешь с людьми и выдерживаешь сроки.',
      ask: 'Спросить про работу',
      premium: 'старт, рутину, команду, руководство, начальство, сроки, клиентов и своё дело',
    },
    en: {
      description: 'How you start, handle routine, work with people, and meet deadlines.',
      ask: 'Ask about work',
      premium: 'starting, routine, teamwork, leadership, authority, deadlines, clients, and your own business',
    },
  },
  money: {
    ru: {
      description: 'Как ты тратишь, копишь, рискуешь, называешь цену и делишь деньги с другими.',
      ask: 'Спросить про деньги',
      premium: 'траты, накопления, крупные решения, риск, цену своей работы и общие деньги',
    },
    en: {
      description: 'How you spend, save, take risks, name a price, and share money with others.',
      ask: 'Ask about money',
      premium: 'spending, saving, large decisions, risk, pricing your work, and shared money',
    },
  },
};

function isDomainKey(value: NatalReportCategoryKey): value is DomainKey {
  return DOMAIN_KEYS.includes(value as DomainKey);
}

function categoryTitle(categoryKey: NatalReportCategoryKey, language: 'ru' | 'en'): string {
  return getNatalReportCategory(categoryKey)?.title[language]
    || (language === 'ru' ? 'Разбор' : 'Reading');
}

function domainCopy(categoryKey: DomainKey, language: 'ru' | 'en') {
  return DOMAIN_COPY[categoryKey][language];
}

function splitLead(text: string): { lead: string; body: string } {
  const normalized = String(text || '').trim();
  const match = normalized.match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/u);
  if (!match) return { lead: normalized, body: '' };
  return { lead: match[1].trim(), body: match[2].trim() };
}

function DomainIcon({ categoryKey }: { categoryKey: DomainKey }) {
  if (categoryKey === 'character') return <UserRound aria-hidden="true" />;
  if (categoryKey === 'love') return <Heart aria-hidden="true" />;
  if (categoryKey === 'communication') return <MessageCircle aria-hidden="true" />;
  if (categoryKey === 'work') return <BriefcaseBusiness aria-hidden="true" />;
  return <CircleDollarSign aria-hidden="true" />;
}

const MeaningMap: React.FC<{
  language: 'ru' | 'en';
  activeCategoryKey: NatalReportCategoryKey;
  compact?: boolean;
  onFoundation: () => void;
  onDomain: (categoryKey: DomainKey) => void;
}> = ({ language, activeCategoryKey, compact = false, onFoundation, onDomain }) => (
  <div className={`natal-v3-meaning-map${compact ? ' is-compact' : ''}`}>
    <svg className="natal-v3-meaning-map-lines" viewBox="0 0 320 250" aria-hidden="true">
      <line x1="160" y1="126" x2="160" y2="38" />
      <line x1="160" y1="126" x2="54" y2="112" />
      <line x1="160" y1="126" x2="266" y2="112" />
      <line x1="160" y1="126" x2="92" y2="210" />
      <line x1="160" y1="126" x2="228" y2="210" />
    </svg>

    <button
      type="button"
      className={`natal-v3-map-node is-foundation${activeCategoryKey === 'main' ? ' is-active' : ''}`}
      aria-pressed={activeCategoryKey === 'main'}
      onClick={onFoundation}
    >
      <span className="natal-v3-map-node-circle">{language === 'ru' ? 'Я' : 'Me'}</span>
      <span>{language === 'ru' ? 'Основа' : 'Foundation'}</span>
    </button>

    {DOMAIN_KEYS.map((categoryKey) => (
      <button
        key={categoryKey}
        type="button"
        className={`natal-v3-map-node is-${categoryKey}${activeCategoryKey === categoryKey ? ' is-active' : ''}`}
        aria-pressed={activeCategoryKey === categoryKey}
        onClick={() => onDomain(categoryKey)}
      >
        <span className="natal-v3-map-node-circle"><DomainIcon categoryKey={categoryKey} /></span>
        <span>{categoryTitle(categoryKey, language)}</span>
      </button>
    ))}
  </div>
);

const ReadingLoading: React.FC<{ language: 'ru' | 'en' }> = ({ language }) => (
  <div className="natal-v3-reading-loading" role="status" aria-busy="true">
    <span className="sr-only">
      {language === 'ru' ? 'Готовим разбор карты' : 'Preparing the chart reading'}
    </span>
    <span />
    <span />
    <span />
    <span />
  </div>
);

const ReadingError: React.FC<{
  language: 'ru' | 'en';
  message: string | null;
  onRetry: () => void;
}> = ({ language, message, onRetry }) => (
  <section className="natal-v3-reading-error" role="alert">
    <h2>{language === 'ru' ? 'Разбор не загрузился' : 'The reading did not load'}</h2>
    <p>{message || (language === 'ru'
      ? 'Не получилось открыть эту часть карты.'
      : 'This part of the chart could not be opened.')}</p>
    <button type="button" onClick={onRetry}>
      {language === 'ru' ? 'Попробовать снова' : 'Try again'}
    </button>
  </section>
);

const StatementBlock: React.FC<{
  statement: NatalReportStatement;
  language: 'ru' | 'en';
  onMeaning: () => void;
  onWhy: () => void;
}> = ({ statement, language, onMeaning, onWhy }) => {
  const copy = splitLead(statement.text);
  return (
    <article className="natal-v3-statement">
      <p className="natal-v3-statement-lead">{copy.lead}</p>
      {copy.body ? <p className="natal-v3-statement-body">{copy.body}</p> : null}
      <div className="natal-v3-statement-actions">
        <button type="button" className="natal-v3-inline-action" onClick={onMeaning}>
          {language === 'ru' ? 'Как это выглядит' : 'How this looks'}
        </button>
        <button type="button" className="natal-v3-inline-action" onClick={onWhy}>
          {language === 'ru' ? 'Почему так?' : 'Why?'}
        </button>
      </div>
    </article>
  );
};

const AnswerSheet: React.FC<{
  language: 'ru' | 'en';
  answerKey: NatalReportAnswerKey;
  preview: NatalReportPreview | null;
  answer: NatalReportAnswer | null;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  canPromotePremium: boolean;
  bookmarked: boolean;
  focusRequestId: number;
  onClose: () => void;
  onRetry: () => void;
  onRequestPremium: (answerKey: NatalReportAnswerKey) => void;
  onToggleBookmark: (answerKey: NatalReportAnswerKey) => void;
  onOpenRelated: (answerKey: NatalReportAnswerKey) => void;
  onWhy: (target: NatalExplanationTarget) => void;
}> = ({
  language,
  answerKey,
  preview,
  answer,
  loading,
  error,
  isPremium,
  canPromotePremium,
  bookmarked,
  focusRequestId,
  onClose,
  onRetry,
  onRequestPremium,
  onToggleBookmark,
  onOpenRelated,
  onWhy,
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const definition = getNatalReportAnswer(answerKey);
  const canRead = isPremium || isNatalReportAnswerFree(answerKey);
  const title = answer?.title || preview?.title || definition?.title[language] || '';
  const categoryKey: NatalReportCategoryKey = definition?.categoryKey || 'main';
  const evidenceIds = answer?.evidenceIds || preview?.evidenceIds || [];
  const related = answer?.related || preview?.related || definition?.related || [];
  const includes = answer?.fullAnswerIncludes
    || preview?.fullAnswerIncludes
    || definition?.fullAnswerIncludes[language]
    || [];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [answerKey, focusRequestId]);

  return (
    <div
      className="natal-v3-sheet-layer natal-v3-answer-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="natal-v3-sheet natal-v3-answer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="natal-v3-answer-title"
      >
        <div className="natal-v3-sheet-handle" aria-hidden="true" />
        <button
          type="button"
          className="natal-v3-sheet-close"
          aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        <header className="natal-v3-sheet-heading">
          <p>{categoryTitle(categoryKey, language)}</p>
          <h2 id="natal-v3-answer-title" ref={headingRef} tabIndex={-1}>{title}</h2>
        </header>

        {canRead && answer ? (
          <>
            <div className="natal-v3-answer-copy">
              {answer.paragraphs.map((paragraph, index) => (
                <p key={`${answer.answerKey}-${index}`} className={index === 0 ? 'is-lead' : undefined}>
                  {paragraph.text}
                </p>
              ))}
            </div>
            <div className="natal-v3-answer-actions">
              <button
                type="button"
                onClick={() => onWhy({
                  mode: 'why',
                  title,
                  text: answer.paragraphs[0]?.text || title,
                  evidenceIds,
                })}
              >
                {language === 'ru' ? 'Почему так?' : 'Why?'}
              </button>
              <button
                type="button"
                aria-pressed={bookmarked}
                onClick={() => onToggleBookmark(answerKey)}
              >
                <Bookmark aria-hidden="true" />
                {language === 'ru'
                  ? bookmarked ? 'Сохранено' : 'Сохранить'
                  : bookmarked ? 'Saved' : 'Save'}
              </button>
            </div>
          </>
        ) : canRead && loading ? (
          <ReadingLoading language={language} />
        ) : canRead && error ? (
          <ReadingError language={language} message={error} onRetry={onRetry} />
        ) : canRead ? (
          <ReadingError language={language} message={null} onRetry={onRetry} />
        ) : (
          <section className="natal-v3-locked-answer">
            <p className="natal-v3-locked-preview">
              {preview?.preview || (language === 'ru'
                ? 'Начало ответа уже готово. Полный текст откроется вместе со всем разделом.'
                : 'The beginning is ready. The full answer opens with the complete section.')}
            </p>
            {includes.length ? (
              <div className="natal-v3-locked-includes">
                <h3>{language === 'ru' ? 'В полном ответе' : 'The full answer covers'}</h3>
                <ul>{includes.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
            {canPromotePremium ? (
              <button
                id={`natal-answer-unlock-${answerKey}`}
                type="button"
                className="natal-v3-primary-action"
                onClick={() => onRequestPremium(answerKey)}
              >
                {language === 'ru' ? 'Открыть подробную карту' : 'Open the detailed chart'}
              </button>
            ) : null}
          </section>
        )}

        {canRead && answer && related.length ? (
          <section className="natal-v3-related-answers">
            <h3>{language === 'ru' ? 'Ещё по этой теме' : 'More on this topic'}</h3>
            <ul>
              {related.slice(0, 3).map((relatedKey) => {
                const relatedDefinition = getNatalReportAnswer(relatedKey);
                if (!relatedDefinition) return null;
                return (
                  <li key={relatedKey}>
                    <button type="button" onClick={() => onOpenRelated(relatedKey)}>
                      <span>{relatedDefinition.title[language]}</span>
                      {!isPremium && !isNatalReportAnswerFree(relatedKey)
                        ? <LockKeyhole aria-hidden="true" />
                        : <ChevronRight aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
};

export const NatalMeaningExperience: React.FC<Props> = ({
  profile,
  chartData,
  subjectName,
  view,
  activeCategoryKey,
  mainPack,
  categoryPack,
  categoryLoading,
  categoryError,
  selectedAnswerKey,
  selectedPreview,
  selectedAnswer,
  answerLoading,
  answerError,
  isPremium,
  canPromotePremium,
  bookmarkedAnswerKeys,
  focusRequestId,
  onChangeView,
  onSelectCategory,
  onOpenAnswer,
  onCloseAnswer,
  onRetryCategory,
  onRetryAnswer,
  onRequestPremium,
  onToggleBookmark,
  onOpenQuestions,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const reliability = getPermanentNatalReliability(chartData);
  const [mainExpanded, setMainExpanded] = useState(false);
  const [observationsExpanded, setObservationsExpanded] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);

  useEffect(() => {
    setMainExpanded(false);
    setObservationsExpanded(false);
    setQuestionsExpanded(false);
    setExplanation(null);
  }, [activeCategoryKey, view]);

  const accuracyLabel = reliability.quality === 'exact'
    ? (language === 'ru' ? 'Время рождения учтено точно' : 'Exact birth time used')
    : reliability.quality === 'approximate'
      ? (language === 'ru' ? 'Учтена погрешность времени' : 'Birth-time uncertainty checked')
      : (language === 'ru' ? 'Разбор без выдуманного времени' : 'No invented birth time');

  const openFoundation = () => {
    onSelectCategory('main');
    onChangeView('foundation');
  };
  const openDomain = (categoryKey: DomainKey) => {
    onSelectCategory(categoryKey);
    onChangeView('explore');
  };

  const renderStatement = (statement: NatalReportStatement, index: number) => (
    <StatementBlock
      key={`${activeCategoryKey}-statement-${index}`}
      statement={statement}
      language={language}
      onMeaning={() => {
        const copy = splitLead(statement.text);
        setExplanation({
          mode: 'meaning',
          title: view === 'foundation'
            ? (language === 'ru' ? 'Как это выглядит в жизни' : 'How this looks in life')
            : categoryTitle(activeCategoryKey, language),
          text: copy.body || statement.text,
          evidenceIds: statement.evidenceIds,
        });
      }}
      onWhy={() => setExplanation({
        mode: 'why',
        title: view === 'foundation'
          ? (language === 'ru' ? 'Главное о тебе' : 'The main thing about you')
          : categoryTitle(activeCategoryKey, language),
        text: statement.text,
        evidenceIds: statement.evidenceIds,
      })}
    />
  );

  const activeDomainKey: DomainKey = isDomainKey(activeCategoryKey)
    ? activeCategoryKey
    : 'character';
  const activeDomainCopy = domainCopy(activeDomainKey, language);
  const openPreviews = (categoryPack?.previews || []).filter((preview) => (
    isPremium || isNatalReportAnswerFree(preview.answerKey)
  ));
  const lockedPreviews = isPremium
    ? []
    : (categoryPack?.previews || []).filter((preview) => !isNatalReportAnswerFree(preview.answerKey));
  const visibleOpenPreviews = questionsExpanded ? openPreviews : openPreviews.slice(0, 5);

  return (
    <article className="natal-v3-experience" aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}>
      {view === 'foundation' ? (
        categoryLoading && !mainPack ? (
          <ReadingLoading language={language} />
        ) : categoryError || !mainPack ? (
          <ReadingError language={language} message={categoryError} onRetry={onRetryCategory} />
        ) : (
          <>
            <header className="natal-v3-page-heading">
              <p>{language === 'ru' ? 'Основа' : 'Foundation'}</p>
              <h1>{language === 'ru' ? 'Главное о тебе' : 'The main thing about you'}</h1>
              <span>
                {language === 'ru'
                  ? 'Сначала — то, что повторяется в разных частях карты. Потом можно разобрать каждую часть отдельно.'
                  : 'First, what repeats across the chart. Then you can open each part separately.'}
              </span>
              <button
                type="button"
                className="natal-v3-accuracy-link"
                onClick={() => setExplanation({
                  mode: 'accuracy',
                  title: accuracyLabel,
                })}
              >
                {accuracyLabel}
                <ChevronRight aria-hidden="true" />
              </button>
            </header>

            <section className="natal-v3-map-section" aria-labelledby="natal-v3-map-title">
              <div className="natal-v3-section-heading">
                <h2 id="natal-v3-map-title">{language === 'ru' ? 'Что можно разобрать' : 'What you can explore'}</h2>
                <p>{language === 'ru' ? 'Нажми на нужную часть. Основа всегда остаётся в центре.' : 'Choose a part. The foundation always stays in the centre.'}</p>
              </div>
              <MeaningMap
                language={language}
                activeCategoryKey="main"
                onFoundation={openFoundation}
                onDomain={openDomain}
              />
            </section>

            <section className="natal-v3-foundation-copy" aria-labelledby="natal-v3-foundation-title">
              <div className="natal-v3-section-heading">
                <h2 id="natal-v3-foundation-title">
                  {language === 'ru' ? `Основа о ${subjectName || 'тебе'}` : `Foundation for ${subjectName || 'you'}`}
                </h2>
              </div>
              {(mainExpanded ? mainPack.summary : mainPack.summary.slice(0, 3)).map(renderStatement)}
              {mainPack.summary.length > 3 ? (
                <button
                  type="button"
                  className="natal-v3-expand-action"
                  aria-expanded={mainExpanded}
                  onClick={() => setMainExpanded((value) => !value)}
                >
                  {mainExpanded
                    ? (language === 'ru' ? 'Свернуть' : 'Show less')
                    : (language === 'ru' ? `Показать ещё ${mainPack.summary.length - 3}` : `Show ${mainPack.summary.length - 3} more`)}
                  <ChevronDown aria-hidden="true" />
                </button>
              ) : null}
            </section>

            {mainPack.observations.length ? (
              <section className="natal-v3-observations" aria-labelledby="natal-v3-observations-title">
                <div className="natal-v3-section-heading">
                  <h2 id="natal-v3-observations-title">
                    {language === 'ru' ? 'Как это обычно выглядит' : 'How this usually looks'}
                  </h2>
                </div>
                <ul>
                  {(observationsExpanded ? mainPack.observations : mainPack.observations.slice(0, 3)).map((statement, index) => (
                    <li key={`main-observation-${index}`}>
                      <button
                        type="button"
                        onClick={() => setExplanation({
                          mode: 'meaning',
                          title: language === 'ru' ? 'Обычная ситуация' : 'An ordinary situation',
                          text: statement.text,
                          evidenceIds: statement.evidenceIds,
                        })}
                      >
                        <span>{statement.text}</span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                {mainPack.observations.length > 3 ? (
                  <button
                    type="button"
                    className="natal-v3-expand-action"
                    aria-expanded={observationsExpanded}
                    onClick={() => setObservationsExpanded((value) => !value)}
                  >
                    {observationsExpanded
                      ? (language === 'ru' ? 'Свернуть' : 'Show less')
                      : (language === 'ru' ? 'Показать остальные' : 'Show the rest')}
                    <ChevronDown aria-hidden="true" />
                  </button>
                ) : null}
              </section>
            ) : null}

            {mainPack.previews.some((preview) => isNatalReportAnswerFree(preview.answerKey)) ? (
              <section className="natal-v3-question-list" aria-labelledby="natal-v3-start-title">
                <div className="natal-v3-section-heading">
                  <h2 id="natal-v3-start-title">{language === 'ru' ? 'С чего продолжить' : 'Where to continue'}</h2>
                </div>
                <ul>
                  {mainPack.previews
                    .filter((preview) => isNatalReportAnswerFree(preview.answerKey))
                    .slice(0, 2)
                    .map((preview) => (
                      <li key={preview.answerKey}>
                        <button
                          id={`natal-catalog-row-${preview.answerKey}`}
                          type="button"
                          onClick={() => onOpenAnswer(preview.answerKey, 'section_grid')}
                        >
                          <span>
                            <strong>{preview.title}</strong>
                            <small>{preview.preview}</small>
                          </span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            {onOpenQuestions ? (
              <section className="natal-v3-ask-entry">
                <div>
                  <h2>{language === 'ru' ? 'Не нашёл свой вопрос?' : 'Did not find your question?'}</h2>
                  <p>{language === 'ru' ? 'Напиши его обычными словами. Ответ будет собран по этой же карте.' : 'Write it in your own words. The answer will use this same chart.'}</p>
                </div>
                <button type="button" onClick={() => onOpenQuestions('main')}>
                  <Send aria-hidden="true" />
                  {language === 'ru' ? 'Задать свой вопрос' : 'Ask your own question'}
                </button>
              </section>
            ) : null}
          </>
        )
      ) : (
        categoryLoading && !categoryPack ? (
          <ReadingLoading language={language} />
        ) : categoryError || !categoryPack ? (
          <ReadingError language={language} message={categoryError} onRetry={onRetryCategory} />
        ) : (
          <>
            <header className="natal-v3-page-heading natal-v3-domain-heading">
              <button type="button" className="natal-v3-back-action" onClick={openFoundation}>
                <ArrowLeft aria-hidden="true" />
                {language === 'ru' ? 'К основе' : 'Back to foundation'}
              </button>
              <p>{language === 'ru' ? 'Разобрать подробнее' : 'Explore in detail'}</p>
              <h1>{categoryTitle(activeDomainKey, language)}</h1>
              <span>{activeDomainCopy.description}</span>
            </header>

            <section className="natal-v3-map-section is-domain" aria-label={language === 'ru' ? 'Навигация по карте' : 'Chart navigation'}>
              <MeaningMap
                compact
                language={language}
                activeCategoryKey={activeDomainKey}
                onFoundation={openFoundation}
                onDomain={openDomain}
              />
            </section>

            {categoryPack.summary.length ? (
              <section className="natal-v3-foundation-copy" aria-labelledby="natal-v3-domain-summary-title">
                <div className="natal-v3-section-heading">
                  <h2 id="natal-v3-domain-summary-title">
                    {language === 'ru' ? 'Главное в этой части' : 'The main point here'}
                  </h2>
                </div>
                {categoryPack.summary.map(renderStatement)}
              </section>
            ) : null}

            {categoryPack.observations.length ? (
              <section className="natal-v3-observations" aria-labelledby="natal-v3-domain-observations-title">
                <div className="natal-v3-section-heading">
                  <h2 id="natal-v3-domain-observations-title">
                    {language === 'ru' ? 'Как это выглядит в жизни' : 'How this looks in life'}
                  </h2>
                </div>
                <ul>
                  {(observationsExpanded ? categoryPack.observations : categoryPack.observations.slice(0, 4)).map((statement, index) => (
                    <li key={`${activeDomainKey}-observation-${index}`}>
                      <button
                        type="button"
                        onClick={() => setExplanation({
                          mode: 'meaning',
                          title: categoryTitle(activeDomainKey, language),
                          text: statement.text,
                          evidenceIds: statement.evidenceIds,
                        })}
                      >
                        <span>{statement.text}</span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                {categoryPack.observations.length > 4 ? (
                  <button
                    type="button"
                    className="natal-v3-expand-action"
                    aria-expanded={observationsExpanded}
                    onClick={() => setObservationsExpanded((value) => !value)}
                  >
                    {observationsExpanded
                      ? (language === 'ru' ? 'Свернуть' : 'Show less')
                      : (language === 'ru' ? 'Показать остальные' : 'Show the rest')}
                    <ChevronDown aria-hidden="true" />
                  </button>
                ) : null}
              </section>
            ) : null}

            <section className="natal-v3-question-list" aria-labelledby="natal-v3-domain-questions-title">
              <div className="natal-v3-section-heading">
                <h2 id="natal-v3-domain-questions-title">
                  {language === 'ru' ? 'Что ещё можно узнать' : 'What else you can learn'}
                </h2>
                <p>{language === 'ru' ? 'Каждый вопрос открывает отдельный точный ответ, не новый общий текст.' : 'Each question opens one focused answer, not another general reading.'}</p>
              </div>

              {visibleOpenPreviews.length ? (
                <ul>
                  {visibleOpenPreviews.map((preview) => (
                    <li key={preview.answerKey}>
                      <button
                        id={`natal-catalog-row-${preview.answerKey}`}
                        type="button"
                        onClick={() => onOpenAnswer(preview.answerKey, 'section_grid')}
                      >
                        <span>
                          <strong>{preview.title}</strong>
                          <small>{preview.preview}</small>
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {openPreviews.length > 5 ? (
                <button
                  type="button"
                  className="natal-v3-expand-action"
                  aria-expanded={questionsExpanded}
                  onClick={() => setQuestionsExpanded((value) => !value)}
                >
                  {questionsExpanded
                    ? (language === 'ru' ? 'Свернуть вопросы' : 'Show fewer questions')
                    : (language === 'ru' ? `Показать ещё ${openPreviews.length - 5}` : `Show ${openPreviews.length - 5} more`)}
                  <ChevronDown aria-hidden="true" />
                </button>
              ) : null}

              {lockedPreviews.length ? (
                <section className="natal-v3-premium-section" aria-labelledby="natal-v3-premium-section-title">
                  <p>{language === 'ru' ? 'Подробно' : 'In detail'}</p>
                  <h3 id="natal-v3-premium-section-title">
                    {language === 'ru'
                      ? `Ещё ${lockedPreviews.length} ${lockedPreviews.length === 1 ? 'ответ' : lockedPreviews.length < 5 ? 'ответа' : 'ответов'} про ${categoryTitle(activeDomainKey, language).toLocaleLowerCase()}`
                      : `${lockedPreviews.length} more answers about ${categoryTitle(activeDomainKey, language).toLocaleLowerCase()}`}
                  </h3>
                  <span>
                    {language === 'ru'
                      ? `Внутри: ${activeDomainCopy.premium}.`
                      : `Includes ${activeDomainCopy.premium}.`}
                  </span>
                  <ul>
                    {lockedPreviews.slice(0, 4).map((preview) => <li key={preview.answerKey}>{preview.title}</li>)}
                  </ul>
                  {canPromotePremium ? (
                    <button
                      type="button"
                      className="natal-v3-primary-action"
                      onClick={() => onRequestPremium(lockedPreviews[0].answerKey)}
                    >
                      {language === 'ru' ? 'Открыть раздел полностью' : 'Open the full section'}
                    </button>
                  ) : null}
                  <small>
                    {language === 'ru'
                      ? `Один Premium открывает все ${NATAL_REPORT_ANSWER_COUNT} ответов в натальной карте.`
                      : `One Premium opens all ${NATAL_REPORT_ANSWER_COUNT} birth-chart answers.`}
                  </small>
                </section>
              ) : null}
            </section>

            {onOpenQuestions ? (
              <section className="natal-v3-ask-entry">
                <div>
                  <h2>{language === 'ru' ? 'Нужен другой ответ?' : 'Need a different answer?'}</h2>
                  <p>{language === 'ru' ? 'Задай свой вопрос именно по этой части карты.' : 'Ask your own question about this part of the chart.'}</p>
                </div>
                <button type="button" onClick={() => onOpenQuestions(activeDomainKey)}>
                  <Send aria-hidden="true" />
                  {activeDomainCopy.ask}
                </button>
              </section>
            ) : null}
          </>
        )
      )}

      {selectedAnswerKey ? (
        <AnswerSheet
          language={language}
          answerKey={selectedAnswerKey}
          preview={selectedPreview}
          answer={selectedAnswer}
          loading={answerLoading}
          error={answerError}
          isPremium={isPremium}
          canPromotePremium={canPromotePremium}
          bookmarked={bookmarkedAnswerKeys.has(selectedAnswerKey)}
          focusRequestId={focusRequestId}
          onClose={onCloseAnswer}
          onRetry={onRetryAnswer}
          onRequestPremium={onRequestPremium}
          onToggleBookmark={onToggleBookmark}
          onOpenRelated={(answerKey) => onOpenAnswer(answerKey, 'related_question')}
          onWhy={setExplanation}
        />
      ) : null}

      <NatalEvidenceSheet
        target={explanation}
        profile={profile}
        chartData={chartData}
        onClose={() => setExplanation(null)}
        onShowWhy={setExplanation}
      />
    </article>
  );
};
