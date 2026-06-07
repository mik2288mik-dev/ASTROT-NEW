import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, SynastryResult, UserProfile } from '../types';
import type { SignCompatibilityResult } from '../lib/synastry/signCompatibility';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getZodiacSign } from '../constants';
import { getCharts, type ChartListItem } from '../services/storageService';
import { calculateExtendedSynastry, getSignCompatibility } from '../services/astrologyService';
import { toDateInputValue } from '../lib/date-utils';

type SynastryPrefill = { source: 'saved-chart' | 'manual'; partnerChartId?: number; partnerName?: string; partnerDate?: string; partnerTime?: string; partnerPlace?: string } | null;
type Props = { profile: UserProfile; chartData?: NatalChartData | null; chartId?: number | null; requestPremium: () => void; initialPrefill?: SynastryPrefill; onOpenCharts?: () => void; onCreateNatalChart?: () => void; onUpdateProfile?: (profile: UserProfile) => void };
const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

function Section({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return <section className="rounded-[22px] border border-black/10 bg-white p-5"><h3 className="text-lg font-semibold text-[#202024]">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[#68646e]">{text}</p></section>;
}
function SignSelect({ value, onChange, label, language }: { value: string; onChange: (value: string) => void; label: string; language: 'ru' | 'en' }) {
  return <label className="block text-xs font-semibold text-[#68646e]">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-base text-[#202024]">{SIGNS.map((sign) => <option key={sign} value={sign}>{getZodiacSign(language, sign)}</option>)}</select></label>;
}

export const Synastry: React.FC<Props> = ({ profile, chartData, chartId, requestPremium, initialPrefill, onOpenCharts, onCreateNatalChart }) => {
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

  return <div className="min-h-full bg-[#faf9f7] px-4 pb-28 pt-5"><div className="mx-auto max-w-[28rem] space-y-4">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c6bb1]">Союз</p><h1 className="mt-2 text-3xl font-semibold text-[#202024]">Проверь вашу связь</h1><p className="mt-2 text-sm leading-relaxed text-[#68646e]">Почему вас тянет, где вы задеваете друг друга и как говорить яснее.</p></header>
    <div className="grid grid-cols-2 rounded-2xl bg-black/5 p-1"><button className={`rounded-xl px-3 py-3 text-sm font-semibold ${mode === 'signs' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('signs')}>Совместимость знаков</button><button className={`rounded-xl px-3 py-3 text-sm font-semibold ${mode === 'personal' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('personal')}>Что между вами</button></div>

    {mode === 'signs' ? <>
      <div className="grid grid-cols-2 gap-3"><SignSelect label="Знак 1" value={signA} onChange={setSignA} language={language} /><SignSelect label="Знак 2" value={signB} onChange={setSignB} language={language} /></div>
      <button onClick={() => void runSigns()} disabled={loading} className="w-full rounded-2xl bg-[#202024] px-4 py-4 font-semibold text-white disabled:opacity-50">{loading ? 'Собираю…' : 'Проверить вашу связь'}</button>
      {signResult ? <div className="space-y-3"><Section title="Что вас тянет" text={signResult.attraction} /><Section title="Где может быть сложно" text={signResult.difficulty} /><Section title="Как лучше общаться" text={signResult.communication} /><p className="px-2 text-xs leading-relaxed text-[#827d88]">{signResult.limitation}</p></div> : null}
    </> : !hasChart ? <section className="rounded-[24px] border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold">Создай натальную карту</h2><p className="mt-3 text-sm leading-relaxed text-[#68646e]">Чтобы увидеть «Что между вами», Lumia сначала нужна твоя карта. Бесплатная совместимость знаков остаётся доступна без неё.</p><button onClick={onCreateNatalChart} className="mt-5 w-full rounded-2xl bg-[#202024] px-4 py-4 font-semibold text-white">Создать натальную карту</button></section> : !premium ? <section className="rounded-[24px] border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold">Что между вами · Premium</h2><p className="mt-3 text-sm leading-relaxed text-[#68646e]">Разбор покажет, где вас тянет, где может возникать конфликт и что помогает укрепить связь.</p><button onClick={requestPremium} className="mt-5 w-full rounded-2xl bg-[#202024] px-4 py-4 font-semibold text-white">Открыть Premium</button></section> : <>
      {partners.length ? <label className="block text-xs font-semibold text-[#68646e]">Сохранённый человек<select value={partnerChartId || ''} onChange={(e) => setPartnerChartId(Number(e.target.value) || null)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3"><option value="">Добавить вручную</option>{partners.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}</select></label> : null}
      <div className="space-y-3 rounded-[24px] border border-black/10 bg-white p-5"><input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Имя" className="w-full rounded-2xl border border-black/10 px-4 py-3" /><input value={partnerDate} onChange={(e) => setPartnerDate(e.target.value)} type="date" className="w-full rounded-2xl border border-black/10 px-4 py-3" /><div className="grid grid-cols-2 gap-3"><input value={partnerTime} onChange={(e) => setPartnerTime(e.target.value)} type="time" className="w-full rounded-2xl border border-black/10 px-4 py-3" /><input value={partnerPlace} onChange={(e) => setPartnerPlace(e.target.value)} placeholder="Место, если известно" className="w-full rounded-2xl border border-black/10 px-4 py-3" /></div>{accuracy ? <p className="text-xs leading-relaxed text-[#827d88]">{accuracy}</p> : null}<div className="flex gap-2">{onOpenCharts ? <button onClick={onOpenCharts} className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold">Мои карты</button> : null}<button onClick={() => void runPersonal()} disabled={loading} className="flex-1 rounded-2xl bg-[#202024] px-4 py-3 font-semibold text-white disabled:opacity-50">{loading ? 'Собираю…' : 'Что между вами'}</button></div></div>
      {result ? <div className="space-y-3"><Section title="Как ощущается ваша связь" text={result.summary} /><Section title="Где вас тянет" text={result.fullAnalysis?.attraction} /><Section title="Где вы задеваете друг друга" text={result.fullAnalysis?.difficulties} /><Section title="Что может укрепить связь" text={result.fullAnalysis?.potential} />{result.fullAnalysis?.recommendations?.length ? <Section title="Как лучше общаться" text={result.fullAnalysis.recommendations.join(' ')} /> : null}</div> : null}
    </>}
    {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
  </div></div>;
};
