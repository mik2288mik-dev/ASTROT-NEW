import React from 'react';

export interface QuickBarItem {
  id: string;
  emoji: string;
  label: string;
  onClick: () => void;
}

interface FreshQuickBarProps {
  items: QuickBarItem[];
  className?: string;
}

export const FreshQuickBar: React.FC<FreshQuickBarProps> = ({ items, className = '' }) => {
  return (
    <div className={`fresh-quick-bar ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          className="fresh-quick-item"
          onClick={item.onClick}
          type="button"
        >
          <div className="fresh-quick-icon">{item.emoji}</div>
          <span className="fresh-quick-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
