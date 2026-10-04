import { useEffect, useRef, type RefObject } from 'react';
import { skyPaletteForSunAltitude, type Rgb } from '../../lib/skyPalette';

type LiveSkyProps = {
  /** Высота Солнца над горизонтом, градусы. Задаёт цвет неба и видимость звёзд. */
  sunAltitude: number;
  /** Фаза Луны 0..360 (0 — новолуние, 180 — полнолуние). null — Луну не рисуем. */
  moonPhase?: number | null;
  /** Настоящие облака-картинки (прозрачный фон). Плывут медленно; если файлов нет — небо чистое. */
  clouds?: string[];
  className?: string;
  /** Element whose centre marks where the Moon hangs (a tap target over it). Top-right corner when absent. */
  moonAnchorRef?: RefObject<HTMLElement | null>;
};

const css = ([r, g, b]: Rgb, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Повторяемый «случайный» ряд: звёзды и кратеры не прыгают между перерисовками. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const STARS = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 360 }, () => ({
    x: rnd(), y: Math.pow(rnd(), 1.5),
    r: rnd() < 0.93 ? 0.25 + rnd() * 0.55 : 0.8 + rnd() * 0.7,
    a: 0.25 + rnd() * 0.75, phase: rnd() * Math.PI * 2, twinkles: rnd() < 0.12, warm: rnd() < 0.18,
  }));
})();

function moonDisk(radius: number, dpr: number): HTMLCanvasElement {
  const size = Math.ceil(radius * 2 * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = size / 2;
  const base = ctx.createRadialGradient(r * 0.86, r * 0.8, r * 0.1, r, r, r);
  base.addColorStop(0, '#F4F0E6');
  base.addColorStop(0.72, '#DDD7C9');
  base.addColorStop(1, '#B5AE9F');
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  // Тёмные «моря» примерно там, где они на видимой стороне Луны.
  for (const [mx, my, mr] of [[0.62, 0.36, 0.2], [0.44, 0.48, 0.15], [0.56, 0.62, 0.13], [0.34, 0.33, 0.1], [0.7, 0.58, 0.09], [0.47, 0.27, 0.08]]) {
    const sea = ctx.createRadialGradient(mx * size, my * size, 0, mx * size, my * size, mr * size);
    sea.addColorStop(0, 'rgba(118,113,103,.55)');
    sea.addColorStop(1, 'rgba(118,113,103,0)');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, size, size);
  }
  const rnd = seeded(11);
  for (let i = 0; i < 36; i++) {
    ctx.fillStyle = 'rgba(92,87,80,.16)';
    ctx.beginPath();
    ctx.arc((0.15 + rnd() * 0.7) * size, (0.15 + rnd() * 0.7) * size, rnd() * r * 0.06 + dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function litPath(cx: number, cy: number, r: number, phase: number): Path2D {
  const f = (((phase % 360) + 360) % 360) / 360;
  const rx = r * Math.cos(2 * Math.PI * f);
  const waxing = f < 0.5;
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (rx > 0 ? 0 : 1) : (rx > 0 ? 1 : 0);
  return new Path2D(`M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${Math.abs(rx)} ${r} 0 0 ${inner} ${cx} ${cy - r} Z`);
}

/** Ясное небо за содержимым карточки: цвет по Солнцу, звёзды ночью, Луна в настоящей фазе. */
export function LiveSky({ sunAltitude, moonPhase = null, clouds = [], className, moonAnchorRef }: LiveSkyProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cloudKey = clouds.join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;
    const palette = skyPaletteForSunAltitude(sunAltitude);
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cloudImages = clouds.map((src) => { const image = new Image(); image.decoding = 'async'; image.src = src; return image; });
    let width = 0; let height = 0; let dpr = 1; let disk: HTMLCanvasElement | null = null;
    let frame = 0; let visible = true; let last = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth; height = host.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      disk = null;
    };

    const draw = (time: number) => {
      if (width < 1 || height < 1) return; // not laid out yet (hidden tab, first frame)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [zenith, middle, low, horizon] = palette.colors;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, css(zenith)); sky.addColorStop(0.48, css(middle)); sky.addColorStop(0.82, css(low)); sky.addColorStop(1, css(horizon));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      if (palette.glow) {
        /* sunlight on the side away from the Moon */ const gx = width * 0.18; const gy = height * palette.glow.y; const radius = Math.max(width, height) * 0.85;
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
        glow.addColorStop(0, css(palette.glow.color, palette.glow.alpha)); glow.addColorStop(1, css(palette.glow.color, 0));
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      }
      if (palette.stars > 0.01) {
        for (const star of STARS) {
          const twinkle = star.twinkles && !reduced ? 0.6 + 0.4 * Math.sin(time / 850 + star.phase) : 1;
          ctx.globalAlpha = star.a * twinkle * palette.stars * (1 - Math.min(1, star.y) * 0.55);
          ctx.fillStyle = star.warm ? '#FFE9CF' : '#EEF3FF';
          ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < cloudImages.length; i++) {
        const image = cloudImages[i];
        if (!image.complete || !image.naturalWidth) continue;
        const w = width * (0.55 + (i % 3) * 0.12); const h = w * (image.naturalHeight / image.naturalWidth);
        const speed = reduced ? 0 : 3 + i * 1.3;
        const x = ((time / 1000) * speed + i * width * 0.47) % (width + w) - w;
        ctx.globalAlpha = 0.9; ctx.drawImage(image, x, height - h * (0.55 + (i % 2) * 0.2), w, h); ctx.globalAlpha = 1;
      }
      if (moonPhase !== null && Number.isFinite(moonPhase) && width >= 40) {
        const r = Math.min(26, width * 0.07);
        const anchor = moonAnchorRef?.current;
        const hostBox = host.getBoundingClientRect();
        const anchorBox = anchor?.getBoundingClientRect();
        const cx = anchorBox && anchorBox.width ? anchorBox.left - hostBox.left + anchorBox.width / 2 : width - r * 2.1;
        const cy = anchorBox && anchorBox.height ? anchorBox.top - hostBox.top + anchorBox.height / 2 : r * 2.1;
        disk ??= moonDisk(r, dpr);
        if (palette.stars > 0.3) {
          const halo = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 4);
          halo.addColorStop(0, 'rgba(220,226,240,.18)'); halo.addColorStop(1, 'rgba(220,226,240,0)');
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 4, 0, Math.PI * 2); ctx.fill();
        }
        // Неосвещённая часть еле видна — пепельный свет.
        ctx.globalAlpha = 0.04 + palette.stars * 0.1; ctx.drawImage(disk, cx - r, cy - r, r * 2, r * 2);
        ctx.save(); ctx.clip(litPath(cx, cy, r, moonPhase));
        /* the Moon must read clearly in a day sky too */ ctx.globalAlpha = 1 - (1 - palette.stars) * 0.06; ctx.drawImage(disk, cx - r, cy - r, r * 2, r * 2);
        ctx.restore(); ctx.globalAlpha = 1;
      }
    };

    const animated = !reduced && (palette.stars > 0.05 || cloudImages.length > 0);
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || time - last < 50) return; // ~20 кадров в секунду, только пока карточку видно
      last = time; draw(time);
    };
    resize(); draw(performance.now());
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { resize(); draw(performance.now()); }) : null;
    resizeObserver?.observe(host);
    const visibility = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); })
      : null;
    visibility?.observe(host);
    if (animated) frame = requestAnimationFrame(loop);
    for (const image of cloudImages) image.onload = () => draw(performance.now());
    return () => { cancelAnimationFrame(frame); resizeObserver?.disconnect(); visibility?.disconnect(); };
    // cloudKey вместо массива: новые ссылки на тот же список не перезапускают отрисовку.
  }, [sunAltitude, moonPhase, cloudKey]);

  return <canvas ref={canvasRef} className={className ? `live-sky ${className}` : 'live-sky'} aria-hidden="true" />;
}
