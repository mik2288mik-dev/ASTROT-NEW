import React from 'react';
import { NeboLogo } from '../brand/NeboLogo';

type MeouLogoProps = {
  large?: boolean;
  className?: string;
  fullCloud?: boolean;
};

export const MeouLogo: React.FC<MeouLogoProps> = ({
  large = false,
  className = '',
  fullCloud = false,
}) => (
  <NeboLogo
    className={`meou-wordmark${large ? ' meou-wordmark--large' : ''}${className ? ` ${className}` : ''}`}
    fullCloud={fullCloud}
    size={large ? 'large' : 'standard'}
    priority
  />
);
