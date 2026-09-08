import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import type { UserProfile, NatalChartData } from '../../types';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getChartData } from '../../services/storageService';
import { NatalQuestionExperience } from '../NatalReading/NatalQuestionExperience';
import { NeboFutureJourney } from './NeboFutureJourney';
import type { PersonalFutureForecast } from '../../lib/personalFutureForecastContract';
import type { NatalReportCategoryKey } from '../../lib/natalReading/reportCatalog';
import styles from './NeboPersonalExplore.module.css';

type QuestionsProps = React.ComponentProps<typeof NatalQuestionExperience>;
export type NeboPersonalExploreProps = {
  profile: UserProfile; chartData?: NatalChartData; chartId?: number;
  requestPremium: QuestionsProps['requestPremium'];
  questionsPreview?: QuestionsProps['uiPreview'];
  premiumContinuation?: QuestionsProps['premiumContinuation'];
  onPremiumContinuationHandled?: QuestionsProps['onPremiumContinuationHandled'];
  uiPreview?: boolean; futureReadings?: PersonalFutureForecast[];
  questionRequest?: number; questionCategory?: NatalReportCategoryKey;
};

/** Shared content of the lower sheet on Today and Natal Chart. */
export function NeboPersonalExplore(props: NeboPersonalExploreProps) {
  const en = props.profile.language === 'en';
  const premium = hasActivePremium(props.profile);
  const [chart, setChart] = useState<NatalChartData | null>(props.chartData || null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState<NatalReportCategoryKey>(props.questionCategory || 'main');
  useEffect(() => { if (props.questionRequest) { setCategory(props.questionCategory || 'main'); } }, [props.questionRequest, props.questionCategory]);
  useEffect(() => { setChart(props.chartData || null); setFailed(false); }, [props.profile.id, props.chartData]);
  useEffect(() => {
    if (!premium || props.chartData) return;
    if (props.uiPreview) { setFailed(true); return; }
    let active = true;
    setFailed(false);
    // Read the saved primary chart. This never calculates or repairs a chart.
    void getChartData().then(value => { if (active) { setChart(value); setFailed(!value); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [premium, props.profile.id, props.chartData, props.uiPreview, retry]);
  const openQuestionsPremium = () => void props.requestPremium('natal_questions', { placement: 'natal_questions', featureKey: 'natal_questions', triggerType: 'locked_feature', returnView: 'chart', returnAction: 'open_natal_questions' });
  return <section className={styles.explore} aria-label={en ? 'Personal readings' : 'Личные разборы'}>
    <div className={styles.questionHero}>
      <div><p>NEBO+</p><h2>{en ? 'Ask about yourself' : 'Спросить о себе'}</h2><span>{en ? 'Your question. An answer from your chart.' : 'Твой вопрос. Ответ по твоей карте.'}</span></div>
      <Image src="/assets/nebo-refined/reading-shortcuts/natal-closeup-v1.png" alt="" width={512} height={512} sizes="220px" className={styles.heroArt}/>
    </div>
    <div className={styles.questions}>
      {!premium ? <div className={styles.gate}>
        <div className={styles.starterStrip} aria-label={en ? 'Question ideas' : 'Вопросы для начала'}>{(en ? ['What comes easily to me?', 'What matters to me in love?', 'How do I make decisions?'] : ['Что мне даётся легко?', 'Что мне важно в любви?', 'Как я принимаю решения?']).map(text => <button key={text} type="button" onClick={openQuestionsPremium}>{text}</button>)}</div>
        <button type="button" className={styles.lockedInput} onClick={openQuestionsPremium}><span>{en ? 'Write your question…' : 'Напиши свой вопрос…'}</span><span aria-hidden="true">↑</span></button>
        <p className="nebo-muted">{en ? 'NEBO+ · Up to 5 questions a day' : 'NEBO+ · До 5 вопросов в день'}</p>
      </div>
        : chart ? <NatalQuestionExperience compact profile={props.profile} chartData={chart} chartId={props.chartId} contextCategory={category} onContextChange={setCategory} requestPremium={props.requestPremium} uiPreview={props.questionsPreview} premiumContinuation={props.premiumContinuation} onPremiumContinuationHandled={props.onPremiumContinuationHandled}/>
        : failed ? <div role="alert"><p>{en ? 'Could not load your saved chart.' : 'Не удалось загрузить твою сохранённую карту.'}</p><button type="button" className="nebo-soft-button" onClick={() => setRetry(value => value + 1)}>{en ? 'Try again' : 'Повторить'}</button></div>
        : <p role="status">{en ? 'Loading your chart…' : 'Загружаем твою карту…'}</p>}
    </div>
    <div className={styles.future}><NeboFutureJourney profile={props.profile} uiPreview={props.uiPreview} previewReadings={props.futureReadings} onRequestPremium={() => void props.requestPremium('future', { featureKey: 'personal_daily_full', triggerType: 'locked_feature' })}/></div>
  </section>;
}
