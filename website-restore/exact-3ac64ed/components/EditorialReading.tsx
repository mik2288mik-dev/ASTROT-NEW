import React from 'react';

type EditorialSectionHeadingProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  level?: 2 | 3;
  className?: string;
};

type EditorialPanelProps = {
  label: React.ReactNode;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

type EditorialProseProps = {
  text: string;
  className?: string;
};

type EditorialBulletTextProps = {
  text: string;
};

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

function proseParagraphs(text: string): string[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const authored = normalized.split(/\n{2,}/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (authored.length > 1 || authored[0].length < 280) return authored;

  const sentences = authored[0].match(/[^.!?…]+(?:[.!?…]+[»”"']*|$)/g)?.map((part) => part.trim()).filter(Boolean) || authored;
  if (sentences.length < 3) return authored;

  const paragraphs: string[] = [];
  let current = '';
  sentences.forEach((sentence) => {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && candidate.length > 250) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs;
}

export function EditorialSectionHeading({
  title,
  subtitle,
  level = 2,
  className,
}: EditorialSectionHeadingProps) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <header className={classes('editorial-reading-heading', className)}>
      <div className="editorial-reading-heading-copy">
        <Heading>{title}</Heading>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function EditorialSummary({ label, title, children, className }: EditorialPanelProps) {
  return (
    <section className={classes('editorial-reading-summary', className)}>
      <div className="editorial-reading-panel-label">{label}</div>
      {title ? <h2>{title}</h2> : null}
      <div className="editorial-reading-panel-body">{children}</div>
    </section>
  );
}

export function EditorialEvidence({ label, title, children, className }: EditorialPanelProps) {
  return (
    <aside className={classes('editorial-reading-evidence', className)}>
      <div className="editorial-reading-panel-label">{label}</div>
      {title ? <h3>{title}</h3> : null}
      <div className="editorial-reading-panel-body">{children}</div>
    </aside>
  );
}

export function EditorialProse({ text, className }: EditorialProseProps) {
  const paragraphs = proseParagraphs(text);
  if (!paragraphs.length) return null;

  return (
    <div className={classes('editorial-reading-prose', className)}>
      {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}
    </div>
  );
}

export function EditorialBulletText({ text }: EditorialBulletTextProps) {
  const value = String(text || '').trim();
  const markdownLead = value.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
  if (markdownLead) {
    return <><strong>{markdownLead[1]}</strong>{markdownLead[2] ? ` ${markdownLead[2]}` : ''}</>;
  }

  const phraseLead = value.match(/^(.{2,48}?)(:\s+|—\s+|–\s+)(.+)$/);
  if (phraseLead) {
    return <><strong>{phraseLead[1]}{phraseLead[2].trim()}</strong> {phraseLead[3]}</>;
  }

  return <>{value}</>;
}
