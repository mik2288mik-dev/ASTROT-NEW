import React, { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

export type CosmicSurfaceVariant = 'drawer' | 'sheet' | 'paywall';

const COSMIC_ASSET_BY_VARIANT: Record<CosmicSurfaceVariant, string> = {
  drawer: '/assets/cosmic/drawer.webp',
  sheet: '/assets/cosmic/sheet.webp',
  paywall: '/assets/cosmic/paywall.webp',
};

type CosmicSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'aside';
  variant: CosmicSurfaceVariant;
  children: ReactNode;
  planeClassName?: string;
};

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export const CosmicSurface = React.forwardRef<HTMLElement, CosmicSurfaceProps>(({
  as = 'div',
  variant,
  children,
  className,
  planeClassName,
  style,
  ...rest
}, ref) => {
  const Element = as;
  const surfaceStyle = {
    '--cosmic-surface-image': `url("${COSMIC_ASSET_BY_VARIANT[variant]}")`,
    ...style,
  } as CSSProperties;

  return (
    <Element
      {...rest}
      ref={ref as never}
      className={classNames('cosmic-surface', `cosmic-surface--${variant}`, className)}
      data-cosmic-surface={variant}
      style={surfaceStyle}
    >
      <div className="cosmic-surface__art" aria-hidden="true" />
      <div className={classNames('cosmic-surface__plane', planeClassName)}>
        {children}
      </div>
    </Element>
  );
});

CosmicSurface.displayName = 'CosmicSurface';
