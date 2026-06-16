import React from 'react';

interface FreshListItemProps {
  /** Иконка слева (SVG-нода, напр. PlanetIcon) */
  sign?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Иконка справа (SVG-нода, напр. ZodiacIcon) — чистая, без цветной плашки */
  badge?: React.ReactNode;
  /** Если передан progress (0–100), показывается прогресс-бар вместо subtitle */
  progress?: number;
  progressColor?: string;
  onClick?: () => void;
}

export const FreshListItem: React.FC<FreshListItemProps> = ({
  sign,
  title,
  subtitle,
  badge,
  progress,
  progressColor = '#7C3AED',
  onClick,
}) => {
  return (
    <div
      className="fresh-item"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {sign && (
        <div className="fresh-item-sign" aria-hidden>{sign}</div>
      )}

      <div className="fresh-item-info">
        <div className="fresh-item-title">{title}</div>
        {subtitle && !progress && (
          <div className="fresh-item-sub">{subtitle}</div>
        )}
        {progress !== undefined && (
          <div className="fresh-progress">
            <div
              className="fresh-progress-fill"
              style={{ width: `${progress}%`, background: progressColor }}
            />
          </div>
        )}
      </div>

      {badge && (
        <div className="fresh-item-badge-ico" aria-hidden>{badge}</div>
      )}
    </div>
  );
};

interface FreshItemListProps {
  children: React.ReactNode;
  className?: string;
}

export const FreshItemList: React.FC<FreshItemListProps> = ({ children, className = '' }) => {
  return (
    <div className={`fresh-item-list ${className}`}>
      {children}
    </div>
  );
};
