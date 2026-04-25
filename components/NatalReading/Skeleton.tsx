import React from 'react';

const shimmerKeyframes = `
  @keyframes lumia-shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: 200px 0; }
  }
`;

const shimmerStyle: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #f3f3f3 0px, #ececec 80px, #f3f3f3 160px)',
  backgroundSize: '320px 100%',
  animation: 'lumia-shimmer 1.6s linear infinite',
};

export const ShimmerStyles = () => (
  // eslint-disable-next-line react/no-unknown-property
  <style>{shimmerKeyframes}</style>
);

export function SkeletonLine({
  width = '100%',
  height = '0.95em',
}: {
  width?: string;
  height?: string;
}) {
  return (
    <span
      className="inline-block rounded-[3px] align-middle"
      style={{ width, height, ...shimmerStyle }}
      aria-hidden
    />
  );
}

export function SkeletonBlock({
  height = '14em',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-[2px] ${className}`}
      style={{ height, ...shimmerStyle }}
      aria-hidden
    />
  );
}

export function SkeletonParagraph({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height="0.85em"
        />
      ))}
    </div>
  );
}
