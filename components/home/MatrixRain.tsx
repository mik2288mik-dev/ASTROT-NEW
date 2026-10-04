import { useEffect, useRef } from 'react';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFZ';

/** Живой «код Матрицы» в плитке: зелёные символы падают по чёрному фону. */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = 14;
    let width = 0; let height = 0; let dpr = 1; let drops: number[] = [];
    let frame = 0; let visible = true; let last = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth; height = host.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#030805'; ctx.fillRect(0, 0, width, height);
      drops = Array.from({ length: Math.ceil(width / step) }, () => Math.random() * (height / step));
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(3, 8, 5, 0.16)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `600 ${step - 1}px ui-monospace, monospace`;
      for (let column = 0; column < drops.length; column++) {
        const y = drops[column] * step;
        const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillStyle = Math.random() < 0.06 ? '#D8FFE0' : 'rgba(64, 214, 110, 0.75)';
        ctx.fillText(char, column * step, y);
        drops[column] = y > height && Math.random() > 0.96 ? 0 : drops[column] + 1;
      }
    };

    const refill = () => { resize(); for (let i = 0; i < 40; i++) draw(); }; // сразу заполненный экран, а не пустой
    refill();
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || time - last < 70) return;
      last = time; draw();
    };
    if (!reduced) frame = requestAnimationFrame(loop);
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
