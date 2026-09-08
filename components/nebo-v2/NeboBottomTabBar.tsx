import chrome from './NeboChrome.module.css';
import React from 'react';
import { LumiaBottomTabBar as ClassicBar, shouldShowLumiaBottomNavigation } from '../lumia-ui/LumiaBottomTabBar';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { useNeboDesign } from './useNeboDesign';
import { Glyph } from './Primitives';
export function NeboBottomTabBar(props: React.ComponentProps<typeof ClassicBar>) {
  const design = useNeboDesign(props.profile);
  if (!design.active) return <ClassicBar {...props}/>;
  return <NeboTabBar {...props}/>;
}
/** Presentational navigation, also used by the isolated development preview. */
export function NeboTabBar(props: React.ComponentProps<typeof ClassicBar>) {
  if (!shouldShowLumiaBottomNavigation(props.view)) return null;
  const current = props.view === 'dashboard' ? 0 : props.view === 'horoscope' ? 1 : ['chart','matrix','personality'].includes(props.view) ? 2 : props.view === 'synastry' ? 3 : 4;
  const labels = props.profile.language === 'en' ? ['Today','Zodiac','Chart','Compare','Menu'] : ['Сегодня','Зодиак','Карта','Сравнить','Меню'];
  const actions = [props.onOpenToday, props.onOpenZodiac, props.onOpenNatal, props.onOpenCompatibility, props.onOpenServices];
  return <div className={`nebo-tabs-host ${chrome.bottom}`}><nav className="nebo-tabs" aria-label={props.profile.language === 'en' ? 'Primary navigation' : 'Основная навигация'}>{labels.map((label,index) => <button key={index} type="button" aria-current={current === index ? 'page' : undefined} onClick={() => { lumiaSelectionHaptic(); actions[index](); }}>
    {index === 0 ? <svg viewBox="0 0 24 24" width="23" height="23" fill={current === index ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg> : index === 2 ? <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.5"/>{Array.from({length:12},(_,i)=><path key={i} d="M12 2.5v3" transform={`rotate(${i*30} 12 12)`}/>)}<path d="m6.5 8.5 11 3.5-8 5 3-11 5 6" strokeWidth="1" strokeLinejoin="round"/></svg> : <Glyph name={(['sun','moon','chart','people','menu'] as const)[index]} size={23}/>}
    <span>{label}</span></button>)}</nav></div>;
}
