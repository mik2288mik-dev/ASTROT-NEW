import React from 'react';

export interface TabItem {
  id: string;
  label: string;
}

interface FreshTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const FreshTabs: React.FC<FreshTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={`fresh-tabs ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`fresh-tab ${tab.id === activeTab ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          type="button"
          data-active={tab.id === activeTab}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
