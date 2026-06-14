import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, SynastryResult, UserProfile } from '../types';
import type { SignCompatibilityResult } from '../lib/synastry/signCompatibility';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getZodiacSign } from '../constants';
import { getCharts, type ChartListItem } from '../services/storageService';
import { calculateExtendedSynastry, getSignCompatibility } from '../services/astrologyService';
import { toDateInputValue } from '../lib/date-utils';
import {
  MonoPage,
  MonoArticleSection,
  MonoButton,
  MonoIllustCouple,
  MonoInput,
  MonoSegment,
  MonoSelect,
  MonoShareBar,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../components/mono-ui';

type SynastryPrefill = { source: 'saved-chart' | 'manual'; partnerChartId?: number; partnerName?: string; partnerDate?: string; partnerTime?: string; partnerPlace?: string } | null;
type Props = { profile: UserProfile; chartData?: NatalChartData | null; chartId?: number | null; requestPremium: () => void; initialPrefill?: SynastryPrefill; onOpenCharts?: () => void; onCreateNatalChart?: () => void; onUpdateProfile?: (profile: UserProfile) => void; embedded?: boolean };
const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

export const Synastry: React.FC<Props> = ({ profile, chartData, chartId, requestPremium, initialPrefill, onOpenCharts, onCreateNatalChart, embedded }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId });
  const premium = hasActivePremium(profile);
  const [mode, setMode] = useState<'signs' | 'personal'>(initialPrefill ? 'personal' : 'signs');
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

  async function runSigns() { setLoading(true); setError(null); try { setSignResult(await getSignCompatibility(signA, signB, language)); } catch { setError(language === 'ru' ? 'Не удалось загрузить разбор. Попробуй ещё раз.' : 'Could not load the reading. Try again.'); } finally { setLoading(false); } }
  async function runPersonal() {
    if (!hasChart) { onCreateNatalChart?.(); return; } if (!premium) { requestPremium(); return; }
    if (!partnerName.trim() || !partnerDate) { setError(language === 'ru' ? 'Добавь имя и дату рождения партнёра.' : 'Add the partner name and birth date.'); return; }
    setLoading(true); setError(null); try { const output = await calculateExtendedSynastry(profile, partnerName, partnerDate, partnerTime || undefined, partnerPlace || undefined, 'отношения', partnerChartId || undefined); setResult(output.result); } catch (e: any) { setError(e?.message || (language === 'ru' ? 'Не удалось собрать разбор.' : 'Could not create the reading.')); } finally { setLoading(false); }
  }
  const accuracy = !partnerTime || !partnerPlace ? (language === 'ru' ? 'Без точного времени или места рождения разбор не учитывает часть домов и может быть менее точным.' : 'Without an exact birth time or place, some chart details are unavailable and the reading may be less precise.') : null;

  const modeOptions = language === 'ru'
    ? [{ value: 'signs' as const, label: 'Совместимость знаков' }, { value: 'personal' as const, label: 'Что между вами' }]
    : [{ value: 'signs' as const, label: 'Sign compatibility' }, { value: 'personal' as const, label: 'Between you' }];

  const hasResults = mode === 'signs' ? !!signResult : !!result;

  return (
    <MonoPage className="px-4" withTabClearance>
      <div className="relative mx-auto max-w-[28rem] space-y-4 pb-24">
        <MonoStagger className="space-y-4">
        <MonoStaggerItem>
        {!embedded ? (
        <div className="relative overflow-hidden rounded-mono-card bg-mono-plate px-5 py-6">
          <MonoIllustCouple className="absolute right-2 top-2 opacity-30" size={100} />
          <MonoTag>{language === 'ru' ? 'Союз' : 'Union'}</MonoTag>
          <h1 className="mt-3 max-w-[70%] font-lora text-[28px] font-bold leading-tight text-mono-ink">
            {language === 'ru' ? 'Проверь вашу связь' : 'Check your bond'}
          </h1>
          <p className="mt-2 max-w-[85%] text-[14px] leading-relaxed text-mono-muted">
            {language === 'ru' ? 'Почему вас тянет, где вы задеваете друг друга и как говорить яснее.' : 'Why you connect, where friction shows up, and how to talk clearer.'}
          </p>
        </div>
        ) : null}
        </MonoStaggerItem>

        <MonoStaggerItem>
        <MonoSegment value={mode} onChange={setMode} options={modeOptions} />
        </MonoStaggerItem>

        <MonoStaggerItem>
        {mode === 'signs' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MonoSelect label={language === 'ru' ? 'Знак 1' : 'Sign 1'} value={signA} onChange={(e) => setSignA(e.target.value)}>
                {SIGNS.map((sign) => <option key={sign} value={sign}>{getZodiacSign(language, sign)}</option>)}
              </MonoSelect>
              <MonoSelect label={language === 'ru' ? 'Знак 2' : 'Sign 2'} value={signB} onChange={(e) => setSignB(e.target.value)}>
                {SIGNS.map((sign) => <option key={sign} value={sign}>{getZodiacSign(language, sign)}</option>)}
              </MonoSelect>
            </div>
            <MonoButton variant="accent" fullWidth disabled={loading} onClick={() => void runSigns()}>
              {loading ? (language === 'ru' ? 'Собираю…' : 'Loading…') : (language === 'ru' ? 'Проверить связь' : 'Check compatibility')}
            </MonoButton>
            {signResult ? (
              <div className="space-y-3">
                <MonoArticleSection title={language === 'ru' ? 'Что вас тянет' : 'What draws you'}>{signResult.attraction}</MonoArticleSection>
                <MonoArticleSection title={language === 'ru' ? 'Где может быть сложно' : 'Where it gets hard'}>{signResult.difficulty}</MonoArticleSection>
                <MonoArticleSection title={language === 'ru' ? 'Как лучше общаться' : 'How to communicate'}>{signResult.communication}</MonoArticleSection>
                <p className="px-2 text-xs leading-relaxed text-mono-muted">{signResult.limitation}</p>
              </div>
            ) : null}
          </>
        ) : !hasChart ? (
          <MonoArticleSection title={language === 'ru' ? 'Создай натальную карту' : 'Create your natal chart'}>
            <p>{language === 'ru' ? 'Чтобы увидеть «Что между вами», Lumia сначала нужна твоя карта. Бесплатная совместимость знаков остаётся доступна без неё.' : 'To see what is between you, Lumia needs your chart first. Sign compatibility stays free without it.'}</p>
            <MonoButton className="mt-5" fullWidth onClick={onCreateNatalChart}>{language === 'ru' ? 'Создать карту' : 'Create chart'}</MonoButton>
          </MonoArticleSection>
        ) : !premium ? (
          <MonoArticleSection title={language === 'ru' ? 'Что между вами · Premium' : 'Between you · Premium'}>
            <p>{language === 'ru' ? 'Разбор покажет, где вас тянет, где может возникать конфликт и что помогает укрепить связь.' : 'The reading shows attraction, friction points, and what strengthens your bond.'}</p>
            <MonoButton className="mt-5" fullWidth onClick={requestPremium}>{language === 'ru' ? 'Открыть Premium' : 'Open Premium'}</MonoButton>
          </MonoArticleSection>
        ) : (
          <>
            {partners.length ? (
              <MonoSelect label={language === 'ru' ? 'Сохранённый человек' : 'Saved person'} value={partnerChartId || ''} onChange={(e) => setPartnerChartId(Number(e.target.value) || null)}>
                <option value="">{language === 'ru' ? 'Добавить вручную' : 'Add manually'}</option>
                {partners.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
              </MonoSelect>
            ) : null}
            <div className="space-y-3 rounded-mono-card border border-mono-line bg-mono-white p-5">
              <MonoInput value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder={language === 'ru' ? 'Имя' : 'Name'} />
              <MonoInput value={partnerDate} onChange={(e) => setPartnerDate(e.target.value)} type="date" />
              <div className="grid grid-cols-2 gap-3">
                <MonoInput value={partnerTime} onChange={(e) => setPartnerTime(e.target.value)} type="time" />
                <MonoInput value={partnerPlace} onChange={(e) => setPartnerPlace(e.target.value)} placeholder={language === 'ru' ? 'Место' : 'Place'} />
              </div>
              {accuracy ? <p className="text-xs leading-relaxed text-mono-muted">{accuracy}</p> : null}
              <div className="flex gap-2">
                {onOpenCharts ? <MonoButton variant="outline" onClick={onOpenCharts}>{language === 'ru' ? 'Мои карты' : 'My charts'}</MonoButton> : null}
                <MonoButton className="flex-1" variant="accent" disabled={loading} onClick={() => void runPersonal()}>
                  {loading ? (language === 'ru' ? 'Собираю…' : 'Loading…') : (language === 'ru' ? 'Что между вами' : 'Between you')}
                </MonoButton>
              </div>
            </div>
            {result ? (
              <div className="space-y-3">
                <MonoArticleSection title={language === 'ru' ? 'Как ощущается ваша связь' : 'How your bond feels'}>{result.summary}</MonoArticleSection>
                <MonoArticleSection title={language === 'ru' ? 'Где вас тянет' : 'What draws you'}>{result.fullAnalysis?.attraction}</MonoArticleSection>
                <MonoArticleSection title={language === 'ru' ? 'Где вы задеваете друг друга' : 'Where you trigger each other'}>{result.fullAnalysis?.difficulties}</MonoArticleSection>
                <MonoArticleSection title={language === 'ru' ? 'Что может укрепить связь' : 'What can strengthen it'}>{result.fullAnalysis?.potential}</MonoArticleSection>
                {result.fullAnalysis?.recommendations?.length ? (
                  <MonoArticleSection title={language === 'ru' ? 'Как лучше общаться' : 'How to talk'}>{result.fullAnalysis.recommendations.join(' ')}</MonoArticleSection>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {error ? <p className="rounded-mono-card bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </MonoStaggerItem>
        </MonoStagger>
      </div>

      {hasResults ? (
        <MonoShareBar label={language === 'ru' ? 'Поделиться' : 'Share'} onShare={() => {
          try {
            const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
            tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent('https://t.me/lumia_astrology_bot')}`);
          } catch { /* optional */ }
        }} />
      ) : null}
    </MonoPage>
  );
};
