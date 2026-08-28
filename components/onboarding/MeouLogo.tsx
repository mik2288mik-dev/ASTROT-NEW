import React from 'react';
import { NeboLogo } from '../brand/NeboLogo';

type MeouLogoProps = {
  large?: boolean;
  className?: string;
};

export const MeouLogo: React.FC<MeouLogoProps> = ({ large = false, className = '' }) => (
  <NeboLogo
    className={`meou-wordmark${large ? ' meou-wordmark--large' : ''}${className ? ` ${className}` : ''}`}
    size={large ? 'large' : 'standard'}
    priority
  />
);
