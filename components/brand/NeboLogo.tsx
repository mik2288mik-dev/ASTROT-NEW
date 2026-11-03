import React from 'react';
import styles from './NeboLogo.module.css';

/** The canvas NEBO mark (blue square with an arc and a star); it replaced the old cloud logo. */
export const NEBO_LOGO_SRC = '/assets/brand/nebo-mark.webp';

type NeboLogoSize = 'compact' | 'header' | 'standard' | 'large' | 'loading';

type NeboLogoProps = {
  className?: string;
  decorative?: boolean;
  fullCloud?: boolean;
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
  fullCloud = false,
  priority = false,
  size = 'standard',
}: NeboLogoProps) {
  return (
    <span
      className={`${styles.logo} ${sizeClass[size]}${fullCloud ? ` ${styles.fullCloud}` : ''}${className ? ` ${className}` : ''}`}
      aria-hidden={decorative || undefined}
    >
      <img
        className={styles.image}
        src={NEBO_LOGO_SRC}
        width={128}
        height={128}
        alt={decorative ? '' : 'NEBO'}
        draggable={false}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </span>
  );
}
