import React from 'react';

export type HeroColor = 'coral' | 'sky' | 'lavender' | 'mint' | 'coral2';

interface FreshHeroCardProps {
  color?: HeroColor;
  stickyText?: string;
  stickyRotation?: number;
  chipText?: string;
  chipPosition?: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
  bigText?: string;
  bigTextSize?: number;
  softText?: string;
  emojiBottom?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const FreshHeroCard: React.FC<FreshHeroCardProps> = ({
  color = 'coral',
  stickyText,
  stickyRotation = -2,
  chipText,
  chipPosition = 'top-right',
  bigText,
  bigTextSize = 54,
  softText,
  emojiBottom,
  className = '',
  style,
  children,
  onClick,
}) => {
  const chipStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: 14, right: 14 },
    'top-left': { top: 14, left: 14 },
    'bottom-right': { bottom: 14, right: 14 },
    'bottom-left': { bottom: 14, left: 14 },
  };

  return (
    <div
      className={`fresh-hero fresh-hero--${color} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Стикер */}
      {stickyText && (
        <div
          className="fresh-sticky"
          style={{
            top: 16,
            left: 14,
            transform: `rotate(${stickyRotation}deg)`,
          }}
          dangerouslySetInnerHTML={{ __html: stickyText.replace(/\n/g, '<br/>') }}
        />
      )}

      {/* Чип */}
      {chipText && (
        <div className="fresh-hero-chip" style={chipStyles[chipPosition]}>
          {chipText}
        </div>
      )}

      {/* Большой текст / символ */}
      {bigText && (
        <div
          className="fresh-hero-big"
          style={{ fontSize: bigTextSize, bottom: 28, right: 14 }}
        >
          {bigText}
        </div>
      )}

      {/* Мелкий текст */}
      {softText && (
        <div className="fresh-hero-soft" style={{ bottom: 14, right: 14 }}>
          {softText}
        </div>
      )}

      {/* Эмодзи снизу слева */}
      {emojiBottom && (
        <div style={{ position: 'absolute', bottom: 14, left: 16, fontSize: 22 }}>
          {emojiBottom}
        </div>
      )}

      {children}
    </div>
  );
};
