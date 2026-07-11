import React, { createContext, memo, useContext, useEffect, useMemo, useState } from 'react';
import { fetchStickerCatalog, peekStickerCatalog } from '../../services/stickerService';
import {
  getStickerTimeKey,
  hashSeed,
  selectScreenStickers,
  type SurfaceRequest,
} from '../../lib/stickers/select';
import type { StickerCatalog, StickerPlacement, Surface } from '../../lib/stickers/types';

/**
 * Экранный провайдер стикеров: делает ОДИН выбор на весь экран (соблюдая общий лимит totalMax),
 * раздаёт размещения по блокам через <StickerSlot surface=… />.
 *
 * Раскладка детерминирована ВРЕМЕННЫМ КЛЮЧОМ (московская дата + половина суток) — меняется
 * 2 раза в сутки, а НЕ на каждый заход (rule 6): 10 открытий в одном полудне → одна и та же
 * раскладка. Seed берётся на клиенте (после загрузки каталога) → без SSR-рассинхрона.
 */

type Ctx = { placements: Record<Surface, StickerPlacement[]> } | null;
const StickerCtx = createContext<Ctx>(null);

export type StickerScreenProps = {
  requests: SurfaceRequest[];
  maxMaskots?: number; // максимум маскотов на всю страницу (по умолчанию 1)
  children: React.ReactNode;
};

export function StickerScreen({ requests, maxMaskots = 1, children }: StickerScreenProps) {
  const [catalog, setCatalog] = useState<StickerCatalog | null>(() => peekStickerCatalog());
  // seed=0 до маунта (ничего не рисуем без каталога); на клиенте — из временно́го ключа.
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setSeed(hashSeed(getStickerTimeKey()) || 1);
    let alive = true;
    fetchStickerCatalog().then((c) => { if (alive) setCatalog(c); });
    return () => { alive = false; };
  }, []);

  // Пересобираем только когда меняется каталог/seed/состав запросов — не на каждый рендер.
  const reqKey = JSON.stringify(requests) + `|${maxMaskots}`;
  const value = useMemo<Ctx>(() => {
    const empty = { placements: {} as Record<Surface, StickerPlacement[]> };
    if (!catalog || seed === 0) return empty;
    // Стикеры — декоративны: любая ошибка выбора НЕ должна ронять экран, просто нет стикеров.
    try {
      return { placements: selectScreenStickers(catalog, { seed, requests, maxMaskots }) };
    } catch {
      return empty;
    }

  }, [catalog, seed, reqKey]);

  return <StickerCtx.Provider value={value}>{children}</StickerCtx.Provider>;
}

/**
 * Слот стикеров внутри карточки. Рисует декоративный слой поверх карточки; сам слой не
 * перехватывает клики (pointer-events:none). Карточка-хост должна быть overflow:visible,
 * чтобы «-peek» позиции не обрезались (см. styles/stickers.css → .has-stickers).
 */
export const StickerSlot = memo(function StickerSlot({ surface }: { surface: Surface }) {
  const ctx = useContext(StickerCtx);
  const placements = ctx?.placements?.[surface] || [];
  if (!placements.length) return null;
  return (
    <span className={`sticker-layer sticker-layer--${surface}`} aria-hidden>
      {placements.map((p) => (
        <img
          key={p.entry.id}
          className={`sticker sticker--${p.position}`}
          src={p.entry.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ))}
    </span>
  );
});
