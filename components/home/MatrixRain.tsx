import React, { useEffect, useRef } from 'react';

const GLYPHS = '0123456789АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ';
const FONT_SIZE = 13;
const FRAME_MS = 60;

/**
 * Falling grey characters on white behind the «Матрица судьбы» card. Draws only while the
 * card is on screen, and stays a still frame for people who reduce motion.
 */
export function MatrixRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    let drops: number[] = [];
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      const columns = Math.ceil(width / FONT_SIZE);
      drops = Array.from({ length: columns }, () => Math.floor(Math.random() * (height / FONT_SIZE)));
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      context.fillStyle = 'rgba(255, 255, 255, 0.16)';
      context.fillRect(0, 0, width, height);
      context.font = `${FONT_SIZE}px ui-monospace, Menlo, monospace`;
      drops.forEach((row, column) => {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        context.fillStyle = Math.random() > 0.94 ? '#6f6a64' : 'rgba(111, 106, 100, 0.5)';
        context.fillText(glyph, column * FONT_SIZE, row * FONT_SIZE);
        drops[column] = row * FONT_SIZE > height && Math.random() > 0.97 ? 0 : row + 1;
      });
    };

    resize();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      for (let step = 0; step < 24; step += 1) draw();
      return undefined;
    }

    let timer: number | null = null;
    const start = () => { if (timer == null) timer = window.setInterval(draw, FRAME_MS); };
    const stop = () => { if (timer != null) { window.clearInterval(timer); timer = null; } };
    const visibility = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()));
    if (visibility) visibility.observe(canvas);
    else start();
    const sizing = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    sizing?.observe(canvas);

    return () => { stop(); visibility?.disconnect(); sizing?.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
