import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ImageIcon, Plus, RefreshCw } from 'lucide-react';
import { admin2, type AdminCmsDetail, type AdminCmsRow, type AdminMe } from '../../services/admin2Service';
import { HOME_CARD_INTERNAL_TARGETS, parseHomeCard, safeHomeCardUrl, type HomeCard, type HomeCardInternalTarget } from '../../lib/homeCards';
import { invalidateHomeCards } from '../../services/homeCardsService';
import styles from '../../styles/admin2/HomeCardsEditor.module.css';

const TARGET_LABELS: Record<HomeCardInternalTarget, string> = { today: 'Сегодня', zodiac: 'Зодиак', natal: 'Натальная карта', compatibility: 'Совместимость', matrix: 'Матрица судьбы', saved: 'Сохранённое', premium: 'Premium', encyclopedia: 'Энциклопедия', settings: 'Настройки', support: 'Поддержка' };
const IMAGES = [
  { label: 'Солнце', url: '/assets/nebo-refined/today.png' },
  { label: 'Натальная карта', url: '/assets/nebo-refined/natal-chart.png' },
  { label: 'Совместимость', url: '/assets/nebo-refined/compatibility-rings.png' },
  { label: 'Сохранённое', url: '/assets/nebo-refined/saved-cards.png' },
];
const TONES: Array<{ value: HomeCard['tone']; label: string }> = [{ value: 'violet', label: 'Лавандовый' }, { value: 'sky', label: 'Голубой' }, { value: 'mint', label: 'Зелёный' }, { value: 'peach', label: 'Персиковый' }, { value: 'rose', label: 'Розовый' }];
const EMPTY: HomeCard = { schemaVersion: 1, title: '', caption: '', tone: 'violet', layout: 'popout', imageUrl: IMAGES[0].url, action: { kind: 'internal', target: 'natal' }, order: 0, audience: 'all', startsAt: null, endsAt: null };
const statusLabel = (status: string) => ({ published: 'Опубликована', draft: 'Черновик', archived: 'В архиве' }[status] || status);
const toLocalDate = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalDate = (value: string): string | null => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const messageOf = (error: unknown): string => error instanceof Error ? error.message : 'Не удалось сохранить изменения. Попробуйте ещё раз.';

export default function HomeCardsEditor({ me }: { me: AdminMe }) {
  const canEdit = me.permissions.includes('content.edit');
  const canPublish = me.permissions.includes('content.publish');
  const [rows, setRows] = useState<AdminCmsRow[]>([]);
  const [selected, setSelected] = useState<AdminCmsDetail | null>(null);
  const [form, setForm] = useState<HomeCard>({ ...EMPTY });
  const [locale, setLocale] = useState<'ru' | 'en'>('ru');
  const [savedBody, setSavedBody] = useState(JSON.stringify(EMPTY));
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingSelection, setPendingSelection] = useState<number | 'new' | null>(null);
  const busyRef = useRef(false);
  const loadSequence = useRef(0);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(form) !== savedBody || (selected ? locale !== selected.locale : locale !== 'ru');
  const update = <K extends keyof HomeCard>(key: K, value: HomeCard[K]) => setForm((current) => ({ ...current, [key]: value }));
  const reloadList = async () => { setRows((await admin2.listCms('home_card')).items.filter((row) => row.type === 'home_card')); };
  useEffect(() => {
    let active = true;
    admin2.listCms('home_card').then((result) => { if (active) setRows(result.items.filter((row) => row.type === 'home_card')); })
      .catch(() => { if (active) setError('Не удалось получить карточки. Обновите список.'); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; loadSequence.current += 1; };
  }, []);

  const open = async (id: number | 'new') => {
    if (busyRef.current) return;
    const sequence = ++loadSequence.current;
    setPendingSelection(null); setError(''); setNotice('');
    if (id === 'new') {
      setSelected(null); setForm({ ...EMPTY }); setSavedBody(JSON.stringify(EMPTY)); setLocale('ru');
      editorHeading.current?.focus(); return;
    }
    busyRef.current = true; setBusy(true);
    try {
      const detail = await admin2.getCms(id);
      const card = parseHomeCard(detail.body);
      if (sequence !== loadSequence.current) return;
      setSelected(detail); setForm(card); setSavedBody(JSON.stringify(card)); setLocale(detail.locale === 'en' ? 'en' : 'ru');
      editorHeading.current?.focus();
    } catch (reason) { setError(messageOf(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const choose = (id: number | 'new') => { if (dirty) setPendingSelection(id); else void open(id); };
  const save = async (publish: boolean) => {
    if (busyRef.current || (!canEdit && (!publish || dirty)) || (publish && !canPublish)) return;
    let card: HomeCard;
    try { card = parseHomeCard(form); } catch (reason) { setError(messageOf(reason)); return; }
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      let id = selected?.id;
      let version = selected?.version;
      if (!id) { id = (await admin2.createCms({ type: 'home_card', locale, title: card.title, body: JSON.stringify(card) })).id; version = 1; }
      else if (dirty) { version = (await admin2.updateCms(id, JSON.stringify(card), card.title, version)).version; }
      // Refresh local edit state before publication, so a failed publish never creates a duplicate on retry.
      const saved: AdminCmsDetail = {
        id, type: 'home_card', locale, status: dirty || !selected ? 'draft' : selected.status,
        title: card.title, body: JSON.stringify(card), version: version || 1,
        category: selected?.category || null, updatedAt: new Date().toISOString(),
        publishedAt: selected?.publishedAt || null, versions: selected?.versions || [],
      };
      setSelected(saved); setForm(card); setSavedBody(JSON.stringify(card));
      invalidateHomeCards();
      if (publish) {
        await admin2.publishCms(id, version);
        setSelected({ ...saved, status: 'published' });
      }
      if (publish) invalidateHomeCards();
      setNotice(publish ? 'Карточка опубликована. Она появится в выбранные даты.' : 'Черновик сохранён. В приложении он появится после публикации.');
      await reloadList();
    } catch (reason) { setError(messageOf(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const archive = async () => {
    if (!selected || busyRef.current || !canEdit) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await admin2.archiveCms(selected.id);
      invalidateHomeCards(); setSelected({ ...selected, status: 'archived' });
      setNotice('Карточка убрана с главной. Её можно опубликовать снова.'); await reloadList();
    } catch (reason) { setError(messageOf(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const previewImage = (() => { try { return form.imageUrl ? safeHomeCardUrl(form.imageUrl, true) : undefined; } catch { return undefined; } })();

  return <section className={`admin2-card ${styles.root}`} aria-labelledby="home-cards-heading">
    <div className={styles.heading}><div><h2 id="home-cards-heading">Карточки на главной</h2><p>Анонсы, предложения и быстрые переходы для твоих пользователей.</p></div>
      <div className={styles.actions}><button className="admin2-button--secondary" type="button" disabled={busy} aria-label="Обновить список карточек" onClick={() => { setError(''); void reloadList().catch(() => setError('Не удалось обновить список.')); }}><RefreshCw size={18} /></button>
        {canEdit && <button className="admin2-button--primary" type="button" disabled={busy} onClick={() => choose('new')}><Plus size={18} /> Новая карточка</button>}</div></div>
    {error && <p className="admin2-error" role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status"><Check size={18} /> {notice}</p>}
    {pendingSelection !== null && <div className={styles.unsaved} role="alert"><p>В карточке есть несохранённые изменения.</p><div className={styles.actions}><button className="admin2-button--primary" type="button" onClick={() => setPendingSelection(null)}>Остаться</button><button className="admin2-button--secondary" type="button" onClick={() => void open(pendingSelection)}>Перейти без сохранения</button></div></div>}
    <div className={styles.workspace}>
      <aside className={styles.list} aria-label="Список карточек">
        {listLoading ? <p role="status">Загружаем карточки…</p> : !rows.length ? <p>Карточек пока нет. Начни с первой.</p> : rows.map((row) => <button type="button" key={row.id} disabled={busy} aria-pressed={selected?.id === row.id} onClick={() => choose(row.id)} className={styles.listItem}><strong>{row.title || 'Без названия'}</strong><span>{statusLabel(row.status)} · {row.locale.toUpperCase()}</span></button>)}
      </aside>
      <div className={styles.editor} aria-busy={busy}>
        <h3 ref={editorHeading} tabIndex={-1}>{selected ? 'Редактирование карточки' : 'Новая карточка'}</h3>
        <div className={styles.editLayout}>
          <form onSubmit={(event) => { event.preventDefault(); void save(false); }}>
            <fieldset disabled={!canEdit || busy} className={styles.fields}>
              <label>Заголовок<input className="admin2-input" value={form.title} maxLength={80} required onChange={(event) => update('title', event.target.value)} placeholder="Например, твоя натальная карта" /></label>
              <label>Подпись<textarea className="admin2-input" value={form.caption} maxLength={220} rows={3} onChange={(event) => update('caption', event.target.value)} placeholder="Что пользователь найдёт внутри" /></label>
              <div className={styles.pair}><label>Вид<select className="admin2-input" value={form.layout} onChange={(event) => update('layout', event.target.value as HomeCard['layout'])}><option value="popout">Объёмная картинка</option><option value="cover">Картинка справа</option><option value="compact">Компактная</option></select></label><label>Цвет<select className="admin2-input" value={form.tone} onChange={(event) => update('tone', event.target.value as HomeCard['tone'])}>{TONES.map((tone) => <option value={tone.value} key={tone.value}>{tone.label}</option>)}</select></label></div>
              <div><span className={styles.label}>Готовые картинки</span><div className={styles.imageChoices}>{IMAGES.map((image) => <button type="button" key={image.url} aria-pressed={form.imageUrl === image.url} onClick={() => update('imageUrl', image.url)}><img src={image.url} alt="" /><span>{image.label}</span></button>)}</div></div>
              <label>Адрес картинки<input className="admin2-input" value={form.imageUrl || ''} maxLength={2048} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://… или /assets/…" /><small>Выбери готовую или вставь HTTPS-ссылку на свою. В компактной карточке картинка необязательна.</small></label>
              <div className={styles.pair}><label>Переход<select className="admin2-input" value={form.action.kind} onChange={(event) => update('action', event.target.value === 'internal' ? { kind: 'internal', target: 'natal' } : { kind: 'external', url: '' })}><option value="internal">Раздел приложения</option><option value="external">Внешняя ссылка</option></select></label>
                {form.action.kind === 'internal' ? <label>Раздел<select className="admin2-input" value={form.action.target} onChange={(event) => update('action', { kind: 'internal', target: event.target.value as HomeCardInternalTarget })}>{HOME_CARD_INTERNAL_TARGETS.map((target) => <option key={target} value={target}>{TARGET_LABELS[target]}</option>)}</select></label> : <label>HTTPS-ссылка<input className="admin2-input" value={form.action.url} required placeholder="https://…" maxLength={2048} onChange={(event) => update('action', { kind: 'external', url: event.target.value })} /></label>}</div>
              <div className={styles.pair}><label>Кому показывать<select className="admin2-input" value={form.audience} onChange={(event) => update('audience', event.target.value as HomeCard['audience'])}><option value="all">Всем</option><option value="free">Без Premium</option><option value="premium">С Premium</option></select></label><label>Порядок<input className="admin2-input" type="number" min={0} max={9999} step={1} value={form.order} onChange={(event) => update('order', event.target.value === '' ? 0 : Number(event.target.value))} /><small>Меньшее число — ближе к началу.</small></label></div>
              <div className={styles.pair}><label>Начало показа<input className="admin2-input" type="datetime-local" value={toLocalDate(form.startsAt)} onChange={(event) => update('startsAt', fromLocalDate(event.target.value))} /></label><label>Конец показа<input className="admin2-input" type="datetime-local" value={toLocalDate(form.endsAt)} onChange={(event) => update('endsAt', fromLocalDate(event.target.value))} /></label></div>
              <p className={styles.hint}>Даты указаны в часовом поясе твоего устройства. Пустое начало — сразу после публикации, пустой конец — без срока.</p>
              <div className={styles.pair}><label>Метка<input className="admin2-input" maxLength={24} value={form.badge || ''} onChange={(event) => update('badge', event.target.value)} placeholder="Например, новое" /></label><label>Язык<select className="admin2-input" value={locale} disabled={!!selected} onChange={(event) => setLocale(event.target.value as 'ru' | 'en')}><option value="ru">Русский</option><option value="en">English</option></select></label></div>
            </fieldset>
            {selected?.status === 'published' && dirty && <p className={styles.hint}>Сохранение черновика временно уберёт карточку с главной. Чтобы сразу показать изменения, выбери «Сохранить и опубликовать».</p>}
            <div className={styles.actions}>{canEdit && <button className="admin2-button--secondary" type="submit" disabled={busy || (!!selected && !dirty)}>{busy ? 'Подожди…' : 'Сохранить черновик'}</button>}
              {canPublish && <button className="admin2-button--primary" type="button" disabled={busy || (!canEdit && (!selected || dirty)) || (selected?.status === 'published' && !dirty)} onClick={() => void save(true)}>{dirty && selected ? 'Сохранить и опубликовать' : 'Опубликовать'}</button>}
              {canEdit && selected && selected.status !== 'archived' && <button className="admin2-button--secondary" type="button" disabled={busy || dirty} onClick={() => void archive()}>В архив</button>}</div>
          </form>
          <aside className={styles.preview} aria-label="Предпросмотр карточки"><span className={styles.label}>Так карточка будет выглядеть</span>
            <div className={`${styles.previewCard} ${styles[form.tone]} ${styles[form.layout]}`}>
              <div className={styles.previewCopy}>{form.badge && <span className={styles.badge}>{form.badge}</span>}<strong>{form.title || 'Заголовок карточки'}</strong>{form.caption && <p>{form.caption}</p>}<ArrowRight size={20} aria-hidden="true" /></div>
              {previewImage ? <img src={previewImage} alt="" referrerPolicy="no-referrer" /> : form.layout !== 'compact' ? <ImageIcon size={42} aria-hidden="true" /> : null}
            </div>
            <p className={styles.hint}>{form.action.kind === 'internal' ? `Откроется: ${TARGET_LABELS[form.action.target]}` : 'Ссылка откроется во внешнем браузере.'}</p>
            <p className={styles.hint}>Предпросмотр показывает оформление. Проверка дат и доступности выполняется при публикации.</p>
          </aside>
        </div>
      </div>
    </div>
  </section>;
}
