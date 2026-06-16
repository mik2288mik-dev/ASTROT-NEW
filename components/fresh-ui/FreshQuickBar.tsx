import React from 'react';

export interface QuickBarItem {
  id: string;
  /** SVG-иконка (НЕ эмодзи) */
  icon: React.ReactNode;
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
          aria-label={item.label}
        >
          <div className="fresh-quick-icon" aria-hidden>{item.icon}</div>
          <span className="fresh-quick-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
