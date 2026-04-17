import React from 'react';
import { cn } from '../../lib/cn';
import { StudioBrandBlock } from './StudioBrandBlock';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  onOpenStore: () => void;
  settingsAriaLabel: string;
  storeLabel: string;
  className?: string;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  onOpenStore,
  settingsAriaLabel,
  storeLabel,
  className,
}) => {
  return (
    <header className={cn('mb-4', className)}>
      <StudioBrandBlock
        onOpenSettings={onOpenSettings}
        onOpenStore={onOpenStore}
        settingsAriaLabel={settingsAriaLabel}
        storeLabel={storeLabel}
        tagline="ТВОЙ ПУТЬ К СЕБЕ"
      />
    </header>
  );
};
