import React, { useEffect, useRef } from 'react';

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
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeTab]);

  return (
    <div className={`fresh-tabs ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={tab.id === activeTab ? activeTabRef : null}
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
