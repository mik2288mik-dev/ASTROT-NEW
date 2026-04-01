import React from 'react';
import { cn } from '../../lib/cn';

export const LumiaCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn('glass-card rounded-[32px] p-6 airy-shadow', className)}>{children}</div>;
