import React from 'react';

type MeouLogoProps = {
  large?: boolean;
  className?: string;
};

export const MeouLogo: React.FC<MeouLogoProps> = ({ large = false, className = '' }) => (
  <div
    className={`meou-wordmark${large ? ' meou-wordmark--large' : ''}${className ? ` ${className}` : ''}`}
  >
    NEBO
  </div>
);
