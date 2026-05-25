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

type QuickActionCardProps = Omit<ButtonProps, 'children'> & {
  title: string;
  body: string;
  icon: React.ReactNode;
  active?: boolean;
  locked?: boolean;
};

export function LumiaHomeQuickActionCard({
  title,
  body,
  icon,
  active = false,
  locked = false,
  className,
  type = 'button',
  ...props
}: QuickActionCardProps) {
  return (
    <button
      type={type}
      className={cn('lumia-home-quick-action-card', className)}
      data-active={active ? 'true' : undefined}
      data-locked={locked ? 'true' : undefined}
      aria-label={props['aria-label'] || title}
      {...props}
    >
      <span className="lumia-home-quick-action-icon" aria-hidden>
        {icon}
      </span>
      <span className="lumia-home-quick-action-copy">
        <span className="lumia-home-quick-action-title">{title}</span>
        <span className="lumia-home-quick-action-body">{body}</span>
      </span>
      {locked ? <span className="lumia-home-quick-action-lock">Premium</span> : null}
    </button>
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
