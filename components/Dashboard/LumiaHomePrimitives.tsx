import React from 'react';
import { Lock } from 'lucide-react';
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

type StoryCircleProps = Omit<ButtonProps, 'children'> & {
  label: string;
  imageSrc?: string;
  icon?: React.ReactNode;
  active?: boolean;
  locked?: boolean;
};

export function LumiaHomeStoryCircle({
  label,
  imageSrc,
  icon,
  active = false,
  locked = false,
  className,
  type = 'button',
  ...props
}: StoryCircleProps) {
  return (
    <button
      type={type}
      className={cn('lumia-home-story-button', className)}
      data-active={active ? 'true' : undefined}
      data-locked={locked ? 'true' : undefined}
      aria-label={props['aria-label'] || label}
      {...props}
    >
      <span className="lumia-home-story-ring" aria-hidden>
        {imageSrc ? (
          <img src={imageSrc} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="lumia-home-story-placeholder">{icon}</span>
        )}
        <span className="lumia-home-story-image-wash" />
        {locked ? (
          <span className="lumia-home-story-lock">
            <Lock size={12} strokeWidth={2.25} />
          </span>
        ) : null}
      </span>
      <span className="lumia-home-story-label">{label}</span>
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
