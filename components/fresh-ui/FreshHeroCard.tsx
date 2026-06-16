import React from 'react';

export type HeroColor = 'coral' | 'sky' | 'lavender' | 'mint' | 'coral2';

interface FreshHeroCardProps {
  /** Запасной цвет фона, пока нет картинки */
  color?: HeroColor;
  /** Картинка-фон карточки (поверх — скрим + текст). Тренд новых приложений. */
  image?: string;
  /** Чип в углу (без эмодзи) */
  chipText?: string;
  chipPosition?: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
  /** Главный заголовок поверх карточки (внизу слева) */
  title?: string;
  /** Мелкая подпись внизу справа (например, «Пик 13:00») */
  softText?: string;
  /** SVG-иконка (НЕ эмодзи) в правом нижнем углу */
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const FreshHeroCard: React.FC<FreshHeroCardProps> = ({
  color = 'coral',
  image,
  chipText,
  chipPosition = 'top-right',
  title,
  softText,
  icon,
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

  const hasImage = Boolean(image);

  return (
    <div
      className={`fresh-hero fresh-hero--${color} ${hasImage ? 'fresh-hero--image' : ''} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Картинка-фон + скрим для читаемости текста */}
      {hasImage && (
        <>
          <img className="fresh-hero-img" src={image} alt="" aria-hidden />
          <div className="fresh-hero-scrim" aria-hidden />
        </>
      )}

      {children}

      {/* Чип */}
      {chipText && (
        <div className="fresh-hero-chip" style={chipStyles[chipPosition]}>
          {chipText}
        </div>
      )}

      {/* Иконка (SVG) внизу справа */}
      {icon && <div className="fresh-hero-icon" aria-hidden>{icon}</div>}

      {/* Заголовок поверх карточки */}
      {title && <div className="fresh-hero-title">{title}</div>}

      {/* Мелкая подпись */}
      {softText && <div className="fresh-hero-soft">{softText}</div>}
    </div>
  );
};
