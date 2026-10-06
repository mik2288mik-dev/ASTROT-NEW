import { useEffect, useRef } from 'react';

const GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789';

const RAIN_SECONDS = 6;
const ASSEMBLE_SECONDS = 1.6;
const HOLD_SECONDS = 2.4;
const CYCLE_SECONDS = RAIN_SECONDS + ASSEMBLE_SECONDS + HOLD_SECONDS;

const WORDS = ['МАТРИЦА', 'СУДЬБЫ'];

/** Живой «код Матрицы» в плитке: падающие буквы на мгновение складываются в слова «МАТРИЦА СУДЬБЫ» и снова распадаются. */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;
    const step = 8;
    let width = 0; let height = 0; let dpr = 1; let drops: number[] = [];
    let frame = 0; let visible = true; let last = 0; let start = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth; height = host.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#030805'; ctx.fillRect(0, 0, width, height);
      drops = Array.from({ length: Math.ceil(width / step) }, () => Math.random() * (height / step));
    };

    const rain = () => {
      ctx.fillStyle = 'rgba(3, 8, 5, 0.16)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `600 ${step}px ui-monospace, monospace`;
      for (let column = 0; column < drops.length; column++) {
        const y = drops[column] * step;
        const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillStyle = Math.random() < 0.06 ? '#D8FFE0' : 'rgba(64, 214, 110, 0.75)';
        ctx.fillText(char, column * step, y);
        drops[column] = y > height && Math.random() > 0.94 ? 0 : drops[column] + 1;
      }
    };

    /** The rain fades out; the letters of the words flicker through random glyphs and lock in one by one. */
    const assemble = (progress: number) => {
      ctx.fillStyle = 'rgba(3, 8, 5, 0.3)';
      ctx.fillRect(0, 0, width, height);
      const size = Math.max(9, Math.floor(width / 5.4));
      ctx.font = `700 ${size}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const total = WORDS.join('').length;
      let k = 0;
      WORDS.forEach((word, line) => {
        const y = height / 2 + (line - (WORDS.length - 1) / 2) * size * 1.35;
        const advance = ctx.measureText('М').width;
        const left = width / 2 - (word.length * advance) / 2 + advance / 2;
        [...word].forEach((letter, i) => {
          const at = k / total;
          k += 1;
          if (progress < at) return;
          const locked = progress >= at + 0.3;
          ctx.fillStyle = locked ? '#8DFFAB' : '#D8FFE0';
          ctx.shadowColor = 'rgba(80, 255, 140, 0.9)';
          ctx.shadowBlur = locked ? 6 : 0;
          ctx.fillText(locked ? letter : GLYPHS[Math.floor(Math.random() * GLYPHS.length)], left + i * advance, y);
        });
      });
      ctx.shadowBlur = 0;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    };

    const tick = (time: number) => {
      if (!start) start = time;
      const t = ((time - start) / 1000) % CYCLE_SECONDS;
      if (t < RAIN_SECONDS) rain();
      else if (t < RAIN_SECONDS + ASSEMBLE_SECONDS) assemble((t - RAIN_SECONDS) / ASSEMBLE_SECONDS);
      else assemble(2);
    };

    // сразу заполненный экран, а не пустой; при «меньше движения» — сразу готовая матрица
    const refill = () => { resize(); for (let i = 0; i < 40; i++) rain(); };
    refill();
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || time - last < 70) return;
      last = time; tick(time);
    };
    frame = requestAnimationFrame(loop);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(refill) : null;
    resizeObserver?.observe(host);
    const visibility = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); })
      : null;
    visibility?.observe(host);
    return () => { cancelAnimationFrame(frame); resizeObserver?.disconnect(); visibility?.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="matrix-rain" aria-hidden="true" />;
}
