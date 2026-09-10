import React from 'react';
import { LumiaBottomTabBar as ClassicBar, shouldShowLumiaBottomNavigation } from '../lumia-ui/LumiaBottomTabBar';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { useNeboDesign } from './useNeboDesign';
import { Glyph } from './Primitives';
export function NeboBottomTabBar(props: React.ComponentProps<typeof ClassicBar>) {
  const design = useNeboDesign(props.profile);
  if (!design.active) return <ClassicBar {...props}/>;
  if (!shouldShowLumiaBottomNavigation(props.view)) return null;
  const current = props.view === 'dashboard' ? 0 : props.view === 'horoscope' ? 1 : ['chart','matrix','personality'].includes(props.view) ? 2 : props.view === 'synastry' ? 3 : 4;
  const labels = props.profile.language === 'en' ? ['Today','Zodiac','Natal chart','Compare','Menu'] : ['Сегодня','Зодиак','Натальная карта','Сравнить','Меню'];
  const actions = [props.onOpenToday, props.onOpenZodiac, props.onOpenNatal, props.onOpenCompatibility, props.onOpenServices];
  return <div className="nebo-tabs-host"><nav className="nebo-tabs" aria-label={props.profile.language === 'en' ? 'Primary navigation' : 'Основная навигация'}>{labels.map((label,index) => <button key={index} type="button" aria-current={current === index ? 'page' : undefined} onClick={() => { lumiaSelectionHaptic(); actions[index](); }}>
    {index === 0 ? <svg viewBox="0 0 24 24" width="23" height="23" fill={current === index ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg> : <Glyph name={(['sun','moon','chart','people','menu'] as const)[index]} size={23}/>}
    <span>{label}</span></button>)}</nav></div>;
}
