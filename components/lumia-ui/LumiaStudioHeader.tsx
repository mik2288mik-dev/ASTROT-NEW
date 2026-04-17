import React from 'react';
import { cn } from '../../lib/cn';
import { StudioBrandBlock } from './StudioBrandBlock';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  onOpenStore: () => void;
  settingsAriaLabel: string;
  storeLabel: string;
  className?: string;
  children?: React.ReactNode;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  onOpenStore,
  settingsAriaLabel,
  storeLabel,
  className,
  children,
}) => {
  return (
    <header
      className={cn(
        'lumia-tg-header-bar relative z-40 shrink-0 bg-white',
        className
      )}
    >
      <div className="pt-0.5 pb-0">
        <StudioBrandBlock
          onOpenSettings={onOpenSettings}
          onOpenStore={onOpenStore}
          settingsAriaLabel={settingsAriaLabel}
          storeLabel={storeLabel}
          tagline="ТВОЙ ПУТЬ К СЕБЕ"
        />

        {children ? (
          <div className="mt-2.5 pt-2.5">{children}</div>
        ) : null}
      </div>
    </header>
  );
};
