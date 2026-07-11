import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, SynastryResult, UserProfile } from '../types';
import type { SignCompatibilityResult } from '../lib/synastry/signCompatibility';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getZodiacSign } from '../constants';
import { getCharts, type ChartListItem } from '../services/storageService';
import { calculateExtendedSynastry, getSignCompatibility } from '../services/astrologyService';
import { toDateInputValue } from '../lib/date-utils';
import { shareToTelegram } from '../lib/botLink';
import { MonoArticleSection, MonoShareBar } from '../components/mono-ui';
import { FreshTabs } from '../components/fresh-ui';

type SynastryPrefill = { source: 'saved-chart' | 'manual'; partnerChartId?: number; partnerName?: string; partnerDate?: string; partnerTime?: string; partnerPlace?: string } | null;
type Props = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  requestPremium: () => void;
  initialPrefill?: SynastryPrefill;
  initialMode?: 'signs' | 'personal';
  relationshipType?: string;
  onOpenCharts?: () => void;
  onCreateNatalChart?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  embedded?: boolean;
};
const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

export const Synastry: React.FC<Props> = ({ profile, chartData, chartId, requestPremium, initialPrefill, initialMode, relationshipType, onOpenCharts, onCreateNatalChart, embedded }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId });
  const premium = hasActivePremium(profile);
  const [mode, setMode] = useState<'signs' | 'personal'>(initialPrefill ? 'personal' : (initialMode ?? 'signs'));
  const [signA, setSignA] = useState('aries'); const [signB, setSignB] = useState('libra');
  const [signResult, setSignResult] = useState<SignCompatibilityResult | null>(null);
  const [savedCharts, setSavedCharts] = useState<ChartListItem[]>([]); const [partnerChartId, setPartnerChartId] = useState<number | null>(null);
  const [partnerName, setPartnerName] = useState(''); const [partnerDate, setPartnerDate] = useState(''); const [partnerTime, setPartnerTime] = useState(''); const [partnerPlace, setPartnerPlace] = useState('');
  const [result, setResult] = useState<SynastryResult | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!profile.id) return; void getCharts(profile.id).then((data) => setSavedCharts(data.charts || [])).catch(() => setSavedCharts([])); }, [profile.id]);
  const partners = useMemo(() => savedCharts.filter((chart) => !chart.is_primary), [savedCharts]);
  useEffect(() => {
    if (!initialPrefill) return; setMode('personal'); setPartnerChartId(initialPrefill.partnerChartId || null); setPartnerName(initialPrefill.partnerName || ''); setPartnerDate(toDateInputValue(initialPrefill.partnerDate || '')); setPartnerTime(initialPrefill.partnerTime || ''); setPartnerPlace(initialPrefill.partnerPlace || '');
  }, [initialPrefill]);
  useEffect(() => { const chart = partners.find((item) => item.id === partnerChartId); if (!chart) return; setPartnerName(chart.name); setPartnerDate(toDateInputValue(chart.birth_date)); setPartnerTime(chart.birth_time || ''); setPartnerPlace(chart.birth_place || ''); }, [partnerChartId, partners]);

  async function runSigns() { setLoading(true); setError(null); try { setSignResult(await getSignCompatibility(signA, signB, language)); } catch { setError(ru ? 'Не удалось загрузить разбор. Попробуй ещё раз.' : 'Could not load the reading. Try again.'); } finally { setLoading(false); } }
  async function runPersonal() {
    if (!hasChart) { onCreateNatalChart?.(); return; } if (!premium) { requestPremium(); return; }
    if (!partnerName.trim() || !partnerDate) { setError(ru ? 'Добавь имя и дату рождения человека.' : 'Add the person’s name and birth date.'); return; }
    setLoading(true); setError(null); try { const output = await calculateExtendedSynastry(profile, partnerName, partnerDate, partnerTime || undefined, partnerPlace || undefined, relationshipType ?? 'отношения', partnerChartId || undefined); setResult(output.result); } catch (e: any) { setError(e?.message || (ru ? 'Не удалось собрать разбор.' : 'Could not create the reading.')); } finally { setLoading(false); }
  }
  const accuracy = !partnerTime || !partnerPlace ? (ru ? 'Без точного времени или места рождения разбор не учитывает часть домов и может быть менее точным.' : 'Without an exact birth time or place, some chart details are unavailable and the reading may be less precise.') : null;

  const modeTabs = [
    { id: 'signs', label: ru ? 'По знакам' : 'By signs' },
    { id: 'personal', label: ru ? 'Что между вами' : 'Between you' },
  ];

  const hasResults = mode === 'signs' ? !!signResult : !!result;

  return (
    <div className="fresh-page">
      {!embedded ? (
        <div className="fresh-page-title-block" style={{ textAlign: 'center', paddingTop: 0, paddingBottom: 12 }}>
          <div className="fresh-page-kicker">{ru ? 'Союз' : 'Union'}</div>
          <div className="fresh-page-title">{ru ? 'Совместимость' : 'Compatibility'}</div>
        </div>
      ) : null}

      <FreshTabs tabs={modeTabs} activeTab={mode} onTabChange={(id) => setMode(id as 'signs' | 'personal')} />

      {mode === 'signs' ? (
        <>
          <div className="union-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label className="fresh-field-label">{ru ? 'Знак 1' : 'Sign 1'}</label>
              <select className="fresh-input" value={signA} onChange={(e) => setSignA(e.target.value)}>
                {SIGNS.map((sign) => <option key={sign} value={sign}>{getZodiacSign(language, sign)}</option>)}
              </select>
            </div>
            <div>
              <label className="fresh-field-label">{ru ? 'Знак 2' : 'Sign 2'}</label>
              <select className="fresh-input" value={signB} onChange={(e) => setSignB(e.target.value)}>
                {SIGNS.map((sign) => <option key={sign} value={sign}>{getZodiacSign(language, sign)}</option>)}
              </select>
            </div>
          </div>
          <button type="button" className="fresh-btn-primary" disabled={loading} onClick={() => void runSigns()}>
            {loading ? (ru ? 'Собираю…' : 'Loading…') : (ru ? 'Проверить совместимость' : 'Check compatibility')}
          </button>
          {signResult ? (
            <div className="union-pad space-y-3" style={{ marginTop: 18 }}>
              <MonoArticleSection title={ru ? 'Что вас тянет' : 'What draws you'}>{signResult.attraction}</MonoArticleSection>
              <MonoArticleSection title={ru ? 'Где может быть сложно' : 'Where it gets hard'}>{signResult.difficulty}</MonoArticleSection>
              <MonoArticleSection title={ru ? 'Как лучше общаться' : 'How to communicate'}>{signResult.communication}</MonoArticleSection>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--fresh-muted)' }}>{signResult.limitation}</p>
            </div>
          ) : null}
        </>
      ) : !hasChart ? (
        <div className="union-pad">
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--fresh-muted)', margin: '0 0 14px' }}>
            {ru ? 'Чтобы увидеть «Что между вами», астрологу сначала нужна твоя карта. Совместимость по знакам остаётся бесплатной без неё.' : 'To see what is between you, the astrologer needs your chart first. Sign compatibility stays free without it.'}
          </p>
          <button type="button" className="fresh-btn-primary" style={{ margin: 0, width: '100%' }} onClick={onCreateNatalChart}>{ru ? 'Создать карту' : 'Create chart'}</button>
        </div>
      ) : !premium ? (
        <div className="union-pad">
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--fresh-muted)', margin: '0 0 14px' }}>
            {ru ? 'Полный разбор покажет, что вас притягивает, где возникают трения и что помогает укрепить связь.' : 'The full reading shows attraction, friction points, and what strengthens your bond.'}
          </p>
          <button type="button" className="fresh-btn-primary" style={{ margin: 0, width: '100%' }} onClick={requestPremium}>{ru ? 'Открыть Premium' : 'Open Premium'}</button>
        </div>
      ) : (
        <>
          {partners.length ? (
            <div className="union-pad" style={{ marginBottom: 14 }}>
              <label className="fresh-field-label">{ru ? 'Сохранённый человек' : 'Saved person'}</label>
              <select className="fresh-input" value={partnerChartId || ''} onChange={(e) => setPartnerChartId(Number(e.target.value) || null)}>
                <option value="">{ru ? 'Добавить вручную' : 'Add manually'}</option>
                {partners.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
              </select>
            </div>
          ) : null}
          <div className="union-form">
            <div>
              <label className="fresh-field-label">{ru ? 'Имя' : 'Name'}</label>
              <input className="fresh-input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder={ru ? 'Имя человека' : 'Person name'} />
            </div>
            <div>
              <label className="fresh-field-label">{ru ? 'Дата рождения' : 'Birth date'}</label>
              <input className="fresh-input" type="date" value={partnerDate} onChange={(e) => setPartnerDate(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="fresh-field-label">{ru ? 'Время' : 'Time'}</label>
                <input className="fresh-input" type="time" value={partnerTime} onChange={(e) => setPartnerTime(e.target.value)} />
              </div>
              <div>
                <label className="fresh-field-label">{ru ? 'Место' : 'Place'}</label>
                <input className="fresh-input" value={partnerPlace} onChange={(e) => setPartnerPlace(e.target.value)} placeholder={ru ? 'Город' : 'City'} />
              </div>
            </div>
            {accuracy ? <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--fresh-muted)' }}>{accuracy}</p> : null}
          </div>
          <button type="button" className="fresh-btn-primary" style={{ marginTop: 14 }} disabled={loading} onClick={() => void runPersonal()}>
            {loading ? (ru ? 'Собираю…' : 'Loading…') : (ru ? 'Что между вами' : 'Between you')}
          </button>
          {onOpenCharts ? <button type="button" className="union-secondary" onClick={onOpenCharts}>{ru ? 'Мои карты' : 'My charts'}</button> : null}
          {result ? (
            <div className="union-pad space-y-3" style={{ marginTop: 18 }}>
              <MonoArticleSection title={ru ? 'Как ощущается ваша связь' : 'How your bond feels'}>{result.summary}</MonoArticleSection>
              <MonoArticleSection title={ru ? 'Что вас притягивает' : 'What draws you'}>{result.fullAnalysis?.attraction}</MonoArticleSection>
              <MonoArticleSection title={ru ? 'Где вы задеваете друг друга' : 'Where you trigger each other'}>{result.fullAnalysis?.difficulties}</MonoArticleSection>
              <MonoArticleSection title={ru ? 'Что может укрепить связь' : 'What can strengthen it'}>{result.fullAnalysis?.potential}</MonoArticleSection>
              {result.fullAnalysis?.recommendations?.length ? (
                <MonoArticleSection title={ru ? 'Как лучше общаться' : 'How to talk'}>{result.fullAnalysis.recommendations.join(' ')}</MonoArticleSection>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="union-pad" style={{ color: '#B91C1C', fontSize: 14, lineHeight: 1.5, marginTop: 14 }}>{error}</p> : null}

      {hasResults ? (
        <MonoShareBar label={ru ? 'Поделиться' : 'Share'} withTabClearance onShare={() => {
          shareToTelegram(ru ? 'Проверь совместимость в «Твой Гороскоп»' : 'Check compatibility in Your Horoscope');
        }} />
      ) : null}
    </div>
  );
};
