import React from 'react';
import type { UserProfile } from '../../types';
import { useNeboDesign } from './useNeboDesign';
export function NeboDesignControl({ profile }: { profile: UserProfile }) {
  const design = useNeboDesign(profile);
  const ru = profile.language !== 'en';
  if (profile.isAdmin !== true) return null;
  if (design.ready && !design.eligible && design.error) return <section className="nebo-design-control" role="status"><strong>{ru ? 'Новый дизайн NEBO' : 'New NEBO design'}</strong><p>{design.error}</p><button type="button" className="nebo-control-retry" onClick={() => { void design.store.hydrate(); }}>{ru ? 'Проверить ещё раз' : 'Check again'}</button></section>;
  if (!design.ready || !design.eligible) return null;
  return <section className="nebo-design-control" aria-label={ru ? 'Тест нового дизайна' : 'New design preview'}>
    <div><strong>{ru ? 'Новый дизайн NEBO' : 'New NEBO design'}</strong><small>{ru ? 'Только для администратора' : 'Administrator only'}</small></div>
    <div className="nebo-control-options" role="group" aria-label={ru ? 'Дизайн' : 'Design'}>
      <button type="button" aria-pressed={!design.active} onClick={design.store.escapeToClassic}>{ru ? 'Текущий' : 'Current'}</button>
      <button type="button" aria-pressed={design.active} disabled={design.saving} onClick={() => { void design.store.update({ design: 'nebo-v2' }); }}>{ru ? 'Новый' : 'New'}</button>
    </div>
    {design.active ? <div className="nebo-control-options" role="group" aria-label={ru ? 'Тема нового дизайна' : 'Preview theme'}>
      {(['system', 'light', 'dark'] as const).map((theme, index) => <button key={theme} type="button" disabled={design.saving} aria-pressed={design.preference.theme === theme} onClick={() => { void design.store.update({ theme }); }}>{(ru ? ['Как на устройстве', 'Светлая', 'Тёмная'] : ['System', 'Light', 'Dark'])[index]}</button>)}
    </div> : null}
    {design.saving ? <small role="status">{ru ? 'Сохраняем…' : 'Saving…'}</small> : null}
    {design.error ? <p role="alert">{design.error}</p> : null}
  </section>;
}
