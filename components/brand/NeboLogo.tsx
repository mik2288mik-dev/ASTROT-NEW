import React from 'react';
import styles from './NeboLogo.module.css';

export const NEBO_LOGO_SRC = '/assets/brand/nebo-cloud-logo.png';

type NeboLogoSize = 'compact' | 'header' | 'standard' | 'large' | 'loading';

type NeboLogoProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  size?: NeboLogoSize;
};

const sizeClass: Record<NeboLogoSize, string> = {
  compact: styles.compact,
  header: styles.header,
  standard: styles.standard,
  large: styles.large,
  loading: styles.loading,
};

export function NeboLogo({
  className = '',
  decorative = false,
  priority = false,
  size = 'standard',
}: NeboLogoProps) {
  return (
    <span
      className={`${styles.logo} ${sizeClass[size]}${className ? ` ${className}` : ''}`}
      aria-hidden={decorative || undefined}
    >
      <img
        className={styles.image}
        src={NEBO_LOGO_SRC}
        width={1448}
        height={1086}
        alt={decorative ? '' : 'NEBO'}
        draggable={false}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </span>
  );
}
