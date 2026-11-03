import React, { useState } from 'react';
import { X } from 'lucide-react';
import { RUNES, type Rune } from '../../lib/runes';

/** Canvas examples (TarotExample, RuneExample): an invented person's question and a ready answer. */
export const ORACLE_EXAMPLES = {
  tarot: {
    who: 'Кати',
    question: 'Стоит ли мне менять работу этой осенью?',
    keys: ['strength', 'star', 'wheel'] as const,
    texts: [
      'Ты долго держался на терпении и не позволял себе уйти, пока всё не будет сделано как надо. Это вытянуло работу, но и вымотало.',
      'Появилась ясность: ты уже знаешь, чего хочешь. Сейчас время восстановиться и спокойно смотреть вперёд.',
      'Ситуация сдвинется сама: придёт предложение или поменяются условия. Важно не пропустить этот момент.',
    ],
    meaning: 'Карты не про «бросай всё завтра». Они говорят, что старый способ держаться на терпении исчерпан, а новый вариант появится в ближайшие недели.',
    advice: 'Обнови резюме и скажи знакомым, что открыт к предложениям. Решение принимай, когда предложение будет на руках, а не заранее.',
  },
  runes: {
    who: 'Ильи',
    question: 'Что мне важно понять про работу?',
    keys: ['nauthiz', 'raidho', 'jera'] as const,
    texts: [
      'Долго приходилось терпеть то, что давно не подходит: нагрузку, условия, людей. Зато теперь понятно, что для тебя важно на самом деле.',
      'Всё уже сдвинулось: ты присматриваешься, ищешь, говоришь с людьми. Путь выбран верно, главное не останавливаться.',
      'Результат будет, но не сразу. То, что начнётся этой осенью, принесёт плоды к весне.',
    ],
    meaning: 'Руны не советуют уходить резко. Старое терпение закончилось, новый путь уже начат, и он окупится, если дать ему время.',
    advice: 'Запиши, чего ты хочешь от работы через полгода, и сверяйся с этим списком перед каждым решением.',
  },
} as const;

/** «Все 24 руны» (canvas Runes + RuneInfo): tap a stone to read what the rune means. */
export function RuneList() {
  const [open, setOpen] = useState<Rune | null>(null);
  return (
    <section className="nebo-rune-list" aria-labelledby="nebo-rune-list-title">
      <div className="nebo-rune-list-head">
        <h2 id="nebo-rune-list-title">Все 24 руны</h2>
        <small>нажми, чтобы прочитать</small>
      </div>
      <div className="nebo-rune-grid">
        {RUNES.map((rune) => (
          <button key={rune.slug} type="button" onClick={() => setOpen(rune)}>
            <span className="nebo-oracle-stone is-s"><b>{rune.glyph}</b></span>
            <small>{rune.name}</small>
          </button>
        ))}
      </div>
      {open ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setOpen(null)}>
          <div className="nebo-why nebo-rune-info" role="dialog" aria-modal="true" aria-label={open.name} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setOpen(null)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <span className="nebo-oracle-stone is-l nebo-rune-info-stone" aria-hidden><b>{open.glyph}</b></span>
            <p className="nebo-why-kicker">Руна {open.n} из 24</p>
            <h2>{open.name} · {open.keyword}</h2>
            <p className="nebo-numbers-pop-text">{open.day}</p>
            <div className="nebo-rune-info-advice"><b>Совет, если выпала</b><p>{open.advice}</p></div>
            <button type="button" className="nebo-period-cta" onClick={() => setOpen(null)}>Понятно</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ───────────── sharing a spread as a picture (canvas TarotShare) ─────────────

type ShareItem = { name: string; image: string | null; mark: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the story card: night background, the three cards or runes, title and the last meaning. */
async function drawShareCard(kind: 'tarot' | 'runes', items: ShareItem[], caption: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a1d72');
  bg.addColorStop(1, '#160f4a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 397) % W;
    const y = (i * 631) % H;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const cw = 280;
  const ch = 470;
  const top = 460;
  const angles = [-0.12, 0, 0.12];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    ctx.save();
    ctx.translate(W / 2 + (i - 1) * 250, top + ch / 2 + (i === 1 ? -20 : 10));
    ctx.rotate(angles[i]);
    roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    if (item.image) {
      try {
        const img = await loadImage(item.image);
        ctx.drawImage(img, -cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16);
      } catch { /* the white card stays */ }
    } else {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.fillStyle = '#f5d48a';
      ctx.font = '700 180px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.mark, 0, 0);
    }
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '700 40px Onest, "Segoe UI", sans-serif';
  ctx.fillText('NEBO', 110, 1230);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 84px Onest, "Segoe UI", sans-serif';
  ctx.fillText(kind === 'tarot' ? 'Мой расклад таро' : 'Мой расклад рун', 110, 1340);
  ctx.font = '500 52px Onest, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  wrap(ctx, caption, W - 220).slice(0, 4).forEach((line, index) => ctx.fillText(line, 110, 1440 + index * 70));
  ctx.font = '500 38px Onest, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Все звезды твои!', 110, 1800);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** «Поделиться» under a spread: send the picture to a chat or save it. */
export function OracleShare({ kind, items, caption }: { kind: 'tarot' | 'runes'; items: ShareItem[]; caption: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileName = kind === 'tarot' ? 'nebo-tarot.png' : 'nebo-runes.png';

  const share = async () => {
    setBusy(true);
    setNote('');
    try {
      const blob = await drawShareCard(kind, items, caption);
      if (!blob) throw new Error('NO_IMAGE');
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: 'Мой расклад в NEBO' });
      } else {
        save(blob);
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') setNote('Не получилось поделиться. Попробуй сохранить картинку.');
    } finally {
      setBusy(false);
    }
  };

  const save = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setNote('Картинка сохранена.');
  };

  const saveOnly = async () => {
    setBusy(true);
    try {
      const blob = await drawShareCard(kind, items, caption);
      if (blob) save(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="nebo-oracle-secondary" onClick={() => setOpen(true)}>Поделиться</button>
      {open ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="nebo-soft-pop nebo-oracle-share" role="dialog" aria-modal="true" aria-label="Поделиться" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <div className="nebo-oracle-share-card" aria-hidden>
              <div className="nebo-oracle-share-fan">
                {items.map((item) => (item.image
                  ? <img key={item.name} src={item.image} alt="" />
                  : <span key={item.name} className="nebo-oracle-stone is-m"><b>{item.mark}</b></span>))}
              </div>
              <small>NEBO</small>
              <strong>{kind === 'tarot' ? 'Мой расклад таро' : 'Мой расклад рун'}</strong>
              <em>{caption}</em>
            </div>
            <h2>Поделиться</h2>
            <p>Картинка для сторис или чата.</p>
            <button type="button" className="nebo-period-cta" disabled={busy} onClick={() => { void share(); }}>{busy ? 'Готовим картинку…' : 'Отправить'}</button>
            <button type="button" className="nebo-inbox-close" disabled={busy} onClick={() => { void saveOnly(); }}>Сохранить картинку</button>
            {note ? <p role="status">{note}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
