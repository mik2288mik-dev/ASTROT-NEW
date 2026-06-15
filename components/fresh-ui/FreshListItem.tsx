import React from 'react';

interface FreshListItemProps {
  sign?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  /** Если передан progress (0–100), показывается прогресс-бар вместо subtitle */
  progress?: number;
  progressColor?: string;
  onClick?: () => void;
}

export const FreshListItem: React.FC<FreshListItemProps> = ({
  sign,
  title,
  subtitle,
  badgeText,
  badgeBg,
  badgeColor,
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
        <div className="fresh-item-sign">{sign}</div>
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

      {badgeText && (
        <div
          className="fresh-item-badge"
          style={{
            background: badgeBg || '#F3F4F6',
            color: badgeColor || '#6B7280',
          }}
        >
          {badgeText}
        </div>
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
