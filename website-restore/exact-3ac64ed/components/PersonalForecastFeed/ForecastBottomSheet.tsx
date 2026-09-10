import React, { type ReactNode } from 'react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';

export type ForecastBottomSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  onClose: () => void;
};

/**
 * Compatibility adapter for forecast callers. The shared CosmicSheet owns the
 * portal, focus trap, Escape/backdrop close behavior and focus restoration.
 */
export function ForecastBottomSheet(props: ForecastBottomSheetProps) {
  return (
    <CosmicSheet
      {...props}
      className={['forecast-bottom-sheet-panel', props.className]
        .filter(Boolean)
        .join(' ')}
      contentClassName={['forecast-bottom-sheet-content', props.contentClassName]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
