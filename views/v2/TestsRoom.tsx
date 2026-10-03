import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Lock, RotateCcw } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { AssetSlot } from '../../components/lumia-ui/AssetSlot';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  buildChartInsight,
  findSelfTest,
  resultOf,
  scoreSelfTest,
  SELF_TESTS,
  type SelfTestDefinition,
  type SelfTestScore,
} from '../../lib/selfTests/engine';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';
import { loadExploreCharts, peekExploreCharts } from '../../components/PersonalForecastFeed/exploreCharts';

export const TEST_IMAGES: Record<string, string> = {
  temperament: '/assets/tests/temperament.webp',
  conflict: '/assets/tests/conflict.webp',
  love_language: '/assets/tests/love-language.webp',
  recharge: '/assets/tests/recharge.webp',
};

type Progress = { answers: number[]; updatedAt: string };
type SavedResult = { testId: string; top: string; second: string | null; ranking: SelfTestScore['ranking']; finishedAt: string };

type Screen =
  | { kind: 'list' }
  | { kind: 'run'; testId: string; answers: number[]; index: number }
  | { kind: 'result'; testId: string; score: SelfTestScore; finishedAt: string };

type TestsRoomProps = {
  profile: UserProfile;
  onBack: () => void;
  /** Opens a test right away (e.g. «Продолжить тест» from home). */
  initialTestId?: string | null;
  onOpenNatal?: () => void;
  /** «Неделя настроения» lives next to the tests. */
  onOpenMood?: () => void;
};

function asProgress(value: unknown): Progress | null {
  const progress = value as Progress | null;
  return progress && Array.isArray(progress.answers) ? progress : null;
}

function asResult(value: unknown): SavedResult | null {
  const result = value as SavedResult | null;
  return result && typeof result.testId === 'string' && typeof result.top === 'string' ? result : null;
}

/** «Тесты о себе»: personal, never shared. Results and unfinished tests are kept in the profile. */
export function TestsRoom({ profile, onBack, initialTestId, onOpenNatal, onOpenMood }: TestsRoomProps) {
  const ru = profile.language !== 'en';
  const language: 'ru' | 'en' = ru ? 'ru' : 'en';
  const userId = String(profile.id || 'guest');
  const [items, setItems] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'tests'));
  const [chartData, setChartData] = useState<unknown>(
    () => peekExploreCharts(userId)?.find((chart) => chart.is_primary)?.chart_data ?? null,
  );
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });

  useEffect(() => {
    let active = true;
    void loadFeatureState(userId, 'tests').then((loaded) => { if (active) setItems(loaded); });
    void loadExploreCharts(userId).then((charts) => {
      if (active) setChartData(charts.find((chart) => chart.is_primary)?.chart_data ?? null);
    });
    return () => { active = false; };
  }, [userId]);

  const progressOf = useCallback((testId: string) => asProgress(items[`progress:${testId}`]), [items]);
  const history = useMemo(
    () => Object.entries(items)
      .filter(([key]) => key.startsWith('result:'))
      .map(([, value]) => asResult(value))
      .filter((value): value is SavedResult => Boolean(value && findSelfTest(value.testId)))
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
    [items],
  );

  const start = useCallback((test: SelfTestDefinition, fresh = false) => {
    lumiaSelectionHaptic();
    const progress = fresh ? null : progressOf(test.id);
    const answers = progress?.answers.slice(0, test.questions.length) ?? [];
    setScreen({ kind: 'run', testId: test.id, answers, index: Math.min(answers.length, test.questions.length - 1) });
  }, [progressOf]);

  useEffect(() => {
    if (!initialTestId) return;
    const test = findSelfTest(initialTestId);
    if (test) start(test);
    // Opened once from home; later changes come from inside the room.
  }, [initialTestId]);

  useEffect(() => {
    document.querySelector('.tests-room')?.closest('.lumia-main-scroll')?.scrollTo({ top: 0 });
  }, [screen.kind, screen.kind === 'run' ? screen.index : 0]);

  const answer = (test: SelfTestDefinition, current: Extract<Screen, { kind: 'run' }>, optionIndex: number) => {
    lumiaSelectionHaptic();
    const answers = [...current.answers.slice(0, current.index), optionIndex];
    if (answers.length < test.questions.length) {
      const progress: Progress = { answers, updatedAt: new Date().toISOString() };
      setItems((previous) => ({ ...previous, [`progress:${test.id}`]: progress }));
      void saveFeatureState(userId, 'tests', `progress:${test.id}`, progress);
      setScreen({ ...current, answers, index: current.index + 1 });
      return;
    }
    const score = scoreSelfTest(test, answers);
    const finishedAt = new Date().toISOString();
    const record: SavedResult = { testId: test.id, top: score.top, second: score.second, ranking: score.ranking, finishedAt };
    const resultKey = `result:${test.id}:${Date.now()}`;
    setItems((previous) => {
      const next = { ...previous, [resultKey]: record };
      delete next[`progress:${test.id}`];
      return next;
    });
    void saveFeatureState(userId, 'tests', resultKey, record);
    void saveFeatureState(userId, 'tests', `progress:${test.id}`, null);
    setScreen({ kind: 'result', testId: test.id, score, finishedAt });
  };

  const dateLabel = (iso: string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' }).format(new Date(iso));

  if (screen.kind === 'run') {
    const test = findSelfTest(screen.testId)!;
    const question = test.questions[screen.index];
    const chosen = screen.answers[screen.index];
    return (
      <div className="fresh-page tests-room tests-room--run">
        <AppTopBar title={test.title[language]} onBack={() => setScreen({ kind: 'list' })} />
        <section className="tests-run" aria-live="polite">
          <div className="tests-progress" role="progressbar" aria-valuemin={1} aria-valuemax={test.questions.length} aria-valuenow={screen.index + 1}>
            <span style={{ width: `${((screen.index + 1) / test.questions.length) * 100}%` }} />
          </div>
          <p className="tests-run-count">
            {ru ? `Вопрос ${screen.index + 1} из ${test.questions.length}` : `Question ${screen.index + 1} of ${test.questions.length}`}
          </p>
          <h1 className="tests-run-question">{question.text[language]}</h1>
          <div className="tests-run-options" role="radiogroup" aria-label={question.text[language]}>
            {question.options.map((option, optionIndex) => (
              <button
                key={option.text.ru}
                type="button"
                role="radio"
                aria-checked={chosen === optionIndex}
                className={`tests-run-option${chosen === optionIndex ? ' is-chosen' : ''}`}
                onClick={() => answer(test, screen, optionIndex)}
              >
                <span>{option.text[language]}</span>
                {chosen === optionIndex ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          {screen.index > 0 ? (
            <button type="button" className="tests-run-back" onClick={() => setScreen({ ...screen, index: screen.index - 1 })}>
              <ArrowLeft size={16} aria-hidden="true" />
              {ru ? 'Предыдущий вопрос' : 'Previous question'}
            </button>
          ) : null}
          <p className="tests-run-note">{ru ? 'Отвечай первое, что приходит в голову. Ответ сохраняется — можно закрыть и продолжить позже.' : 'Answer with your first thought. Answers are saved — you can close and continue later.'}</p>
        </section>
      </div>
    );
  }

  if (screen.kind === 'result') {
    const test = findSelfTest(screen.testId)!;
    const result = resultOf(test, screen.score.top);
    const second = screen.score.second ? resultOf(test, screen.score.second) : null;
    const insight = buildChartInsight(test, chartData, screen.score.top, language);
    return (
      <div className="fresh-page tests-room tests-room--result">
        <AppTopBar title={test.title[language]} onBack={() => setScreen({ kind: 'list' })} />
        <article className="tests-result">
          <p className="tests-result-kicker">{ru ? `Твой результат · ${dateLabel(screen.finishedAt)}` : `Your result · ${dateLabel(screen.finishedAt)}`}</p>
          <h1 className="tests-result-title">{result.title[language]}</h1>
          <p className="tests-result-lead">{result.lead[language]}</p>
          {second ? (
            <p className="tests-result-second">
              {ru ? `А ещё в тебе много от результата «${second.title.ru}» — они почти поровну.` : `There is also a lot of «${second.title.en}» in you — almost equal.`}
            </p>
          ) : null}
          <div className="tests-result-bars" aria-label={ru ? 'Как распределились ответы' : 'How your answers split'}>
            {screen.score.ranking.map((item) => (
              <div key={item.key} className="tests-result-bar">
                <span>{resultOf(test, item.key).title[language]}</span>
                <span className="tests-result-bar-track"><span style={{ width: `${item.percent}%` }} /></span>
                <b>{item.percent}%</b>
              </div>
            ))}
          </div>
          <section className="tests-result-block">
            <h2>{ru ? 'Твои сильные стороны' : 'Your strengths'}</h2>
            <ul>{result.strengths.map((item) => <li key={item.ru}>{item[language]}</li>)}</ul>
          </section>
          <section className="tests-result-block">
            <h2>{ru ? 'На что обратить внимание' : 'What to watch'}</h2>
            <ul>{result.watch.map((item) => <li key={item.ru}>{item[language]}</li>)}</ul>
          </section>
          <section className="tests-result-tip">
            <h2>{ru ? 'Попробуй' : 'Try this'}</h2>
            <p>{result.tip[language]}</p>
          </section>
          <section className="tests-result-chart" aria-labelledby="tests-result-chart-title">
            <h2 id="tests-result-chart-title">{ru ? 'А что говорит твоя карта' : 'What your chart says'}</h2>
            {insight ? (
              <p>{insight.text}</p>
            ) : (
              <>
                <p>{ru ? 'Сохрани свою натальную карту — и мы сравним результат теста с ней.' : 'Save your natal chart and we will compare the result with it.'}</p>
                {onOpenNatal ? <button type="button" className="tests-secondary" onClick={onOpenNatal}>{ru ? 'Открыть карту' : 'Open the chart'}</button> : null}
              </>
            )}
          </section>
          <p className="tests-result-private"><Lock size={14} aria-hidden="true" />{ru ? 'Результат видишь только ты. Он сохранён в твоём профиле.' : 'Only you can see this result. It is saved in your profile.'}</p>
          <div className="tests-result-actions">
            <button type="button" className="tests-primary" onClick={() => setScreen({ kind: 'list' })}>{ru ? 'Ко всем тестам' : 'All tests'}</button>
            <button type="button" className="tests-secondary" onClick={() => start(test, true)}>
              <RotateCcw size={16} aria-hidden="true" />
              {ru ? 'Пройти ещё раз' : 'Take it again'}
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="fresh-page tests-room">
      <AppTopBar title={ru ? 'Тесты о себе' : 'Tests about you'} onBack={onBack} />
      <section className="tests-intro">
        <h1>{ru ? 'Узнай себя чуть лучше' : 'Get to know yourself a bit better'}</h1>
        <p>{ru ? 'Короткие тесты на пару минут. Без правильных ответов и без оценок — а в конце сравним с твоей картой.' : 'Short tests, a couple of minutes each. No right answers, no grades — and at the end we compare with your chart.'}</p>
      </section>
      <div className="tests-list">
        {SELF_TESTS.map((test) => {
          const progress = progressOf(test.id);
          const last = history.find((item) => item.testId === test.id);
          return (
            <button key={test.id} type="button" className="tests-card" onClick={() => start(test)}>
              <AssetSlot src={TEST_IMAGES[test.id]} className="tests-card-art" />
              <span className="tests-card-copy">
                <strong>{test.title[language]}</strong>
                <small>{test.subtitle[language]}</small>
                <span className="tests-card-meta">
                  {progress
                    ? (ru ? `Продолжить · вопрос ${progress.answers.length + 1} из ${test.questions.length}` : `Continue · question ${progress.answers.length + 1} of ${test.questions.length}`)
                    : last
                      ? (ru ? `Твой результат: ${resultOf(test, last.top).title.ru}` : `Your result: ${resultOf(test, last.top).title.en}`)
                      : (ru ? `${test.minutes} мин · ${test.questions.length} вопросов` : `${test.minutes} min · ${test.questions.length} questions`)}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {onOpenMood ? (
        <div className="tests-list tests-list--extra">
          <button type="button" className="tests-card" onClick={onOpenMood}>
            <AssetSlot src="/assets/tests/mood-week.webp" className="tests-card-art" />
            <span className="tests-card-copy">
              <strong>{ru ? 'Неделя настроения' : 'Mood week'}</strong>
              <small>{ru ? '7 дней по четыре отметки — и отчёт, когда тебе лучше и труднее' : '7 days, four check-ins a day — and a report on your ups and downs'}</small>
              <span className="tests-card-meta">{ru ? '5 секунд в день, четыре раза' : '5 seconds, four times a day'}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {history.length ? (
        <section className="tests-history" aria-labelledby="tests-history-title">
          <h2 id="tests-history-title">{ru ? 'Мои результаты' : 'My results'}</h2>
          <ul>
            {history.slice(0, 20).map((item) => {
              const test = findSelfTest(item.testId)!;
              return (
                <li key={`${item.testId}:${item.finishedAt}`}>
                  <button
                    type="button"
                    onClick={() => setScreen({ kind: 'result', testId: item.testId, score: { ranking: item.ranking, top: item.top, second: item.second }, finishedAt: item.finishedAt })}
                  >
                    <span>
                      <strong>{resultOf(test, item.top).title[language]}</strong>
                      <small>{test.title[language]} · {dateLabel(item.finishedAt)}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <p className="tests-result-private"><Lock size={14} aria-hidden="true" />{ru ? 'Результаты личные: никто, кроме тебя, их не видит.' : 'Results are private: nobody but you sees them.'}</p>
    </div>
  );
}
