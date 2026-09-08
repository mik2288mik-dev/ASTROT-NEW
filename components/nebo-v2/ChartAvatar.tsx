import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { CAT_AVATAR_COUNT, catAvatarSource, defaultCatAvatar, type ChartAvatarChoice } from '../../lib/chartAvatar';
import { getChartAvatarStore } from '../../services/chartAvatarService';
import styles from './ChartAvatar.module.css';

type Props = { ownerId?: string; chartId?: number | string; self?: boolean; name?: string; size?: number; editable?: boolean; preview?: boolean };
export function ChartAvatar({ ownerId = '', chartId, self = true, name = '', size = 48, editable = false, preview = false }: Props) {
  const subjectKey = self ? 'self' : `chart:${chartId}`;
  const store = useMemo(() => getChartAvatarStore(ownerId, preview), [ownerId, preview]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const choice = snapshot.avatars[subjectKey];
  const fallback = catAvatarSource(defaultCatAvatar(`${ownerId}:${subjectKey}`));
  const source = choice?.kind === 'photo' ? choice.dataUrl : choice?.kind === 'cat' ? catAvatarSource(choice.id) : self && snapshot.telegramUrl ? snapshot.telegramUrl : fallback;
  const [broken, setBroken] = useState(false), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), busyRef = useRef(false);
  useEffect(() => { void store.load().catch(() => undefined); }, [store]);
  useEffect(() => setBroken(false), [source]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const save = async (avatar: ChartAvatarChoice) => {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { await store.save(subjectKey, avatar); setOpen(false); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не получилось сохранить аватар.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Выбери JPG, PNG или WebP до 10 МБ.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const photo = new window.Image(); photo.src = url; await photo.decode();
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Не получилось открыть фото.');
      const side = Math.min(photo.naturalWidth, photo.naturalHeight);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(photo, (photo.naturalWidth - side) / 2, (photo.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      await save({ kind: 'photo', dataUrl: canvas.toDataURL('image/jpeg', .85) });
    } catch { setError('Не получилось открыть фото. Выбери другое.'); }
    finally { URL.revokeObjectURL(url); if (input.current) input.current.value = ''; }
  };
  const picture = <Image src={broken ? fallback : source} width={size} height={size} sizes={`${size}px`} alt="" unoptimized={source.startsWith('data:') || source.startsWith('https:')} onError={() => setBroken(true)}/>;
  return <>
    {editable ? <button type="button" className={styles.avatar} style={{ width: size, height: size }} onClick={() => { setError(''); setOpen(true); }} aria-label={`Изменить аватар${name ? `: ${name}` : ''}`}>{picture}</button> : <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">{picture}</span>}
    {editable && <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }} onClose={() => setOpen(false)} aria-label="Выбрать аватар">
      <div className={styles.heading}><h2>Твой аватар</h2><button type="button" aria-label="Закрыть выбор аватара" disabled={busy} onClick={() => setOpen(false)}>×</button></div>
      <p>Выбери котика или добавь своё фото.</p>
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => input.current?.click()}>Загрузить фото</button>{self && snapshot.telegramUrl && <button type="button" disabled={busy} onClick={() => void save({ kind: 'telegram' })}>Фото Telegram</button>}</div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void upload(event.target.files?.[0])}/>
      {open && <div className={styles.grid}>{Array.from({ length: CAT_AVATAR_COUNT }, (_, i) => i + 1).map(id => <button type="button" key={id} disabled={busy} aria-label={`Котик ${id}`} aria-pressed={choice?.kind === 'cat' ? choice.id === id : !choice && source === catAvatarSource(id)} onClick={() => void save({ kind: 'cat', id })}><Image src={catAvatarSource(id)} width={80} height={80} sizes="80px" alt=""/></button>)}</div>}
      {busy && <p role="status">Сохраняем…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    </dialog>}
  </>;
}
