import React from 'react';
import { cn } from '../../lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function LumiaHomePrimaryButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-primary-button', className)} {...props}>
      {children}
    </button>
  );
}

export function LumiaHomeSecondaryButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-secondary-button', className)} {...props}>
      {children}
    </button>
  );
}

export function LumiaHomeIconButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-icon-button', className)} {...props}>
      {children}
    </button>
  );
}

type LargeCardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function LumiaHomeLargeCard({ className, children, ...props }: LargeCardProps) {
  return (
    <section className={cn('lumia-home-large-card', className)} {...props}>
      {children}
    </section>
  );
}

type BottomNavItemProps = ButtonProps & {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  center?: boolean;
};

export function LumiaHomeBottomNavItem({
  label,
  icon,
  active = false,
  center = false,
  className,
  type = 'button',
  ...props
}: BottomNavItemProps) {
  return (
    <button
      type={type}
      className={cn('lumia-home-bottom-nav-item', className)}
      data-active={active ? 'true' : undefined}
      data-center={center ? 'true' : undefined}
      aria-label={props['aria-label'] || label}
      {...props}
    >
      <span className="lumia-home-bottom-nav-icon" aria-hidden>
        {icon}
      </span>
      <span className="lumia-home-bottom-nav-label">{label}</span>
    </button>
  );
}
