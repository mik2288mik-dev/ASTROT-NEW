import React from 'react';
import { cn } from '../../lib/cn';

type MonoArticleProps = {
  kicker?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  className?: string;
  serif?: boolean;
};

export function MonoArticle({ kicker, title, lead, children, className, serif }: MonoArticleProps) {
  return (
    <article className={cn('mx-auto w-full max-w-reading px-4', className)}>
      {kicker ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">{kicker}</p>
      ) : null}
      <h1
        className={cn(
          'mt-2 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-mono-ink',
          serif && 'font-lora',
        )}
      >
        {title}
      </h1>
      {lead ? <p className="mt-4 text-[16px] leading-relaxed text-mono-muted">{lead}</p> : null}
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-mono-ink/90">{children}</div>
    </article>
  );
}

export function MonoArticleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-mono-card border border-mono-line bg-mono-white p-5">
      <h2 className="text-[17px] font-bold text-mono-ink">{title}</h2>
      <div className="mt-3 text-[14px] leading-relaxed text-mono-muted">{children}</div>
    </section>
  );
}

export function MonoQuoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="rounded-mono-card bg-mono-plate px-5 py-4 text-[15px] leading-relaxed text-mono-ink">
      {children}
    </blockquote>
  );
}
