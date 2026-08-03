import React, { memo, useMemo } from 'react';

function stripMdHeaders(line: string): { isHeading: boolean; text: string } {
  const m = line.match(/^(#{1,6})\s+(.+)$/);
  if (m) return { isHeading: true, text: m[2].trim() };
  const numbered = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
  if (numbered) return { isHeading: true, text: numbered[2].trim() };
  return { isHeading: false, text: line };
}

function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-astro-text">
          {bold[1]}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function isListLine(line: string): boolean {
  return /^(\s*[-*•]|\s*\d+[\.)])\s+/.test(line);
}

function listItemText(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, '').replace(/^\s*\d+[\.)]\s+/, '').trim();
}

function technicalBlock(line: string): { label: string; text: string } | null {
  const match = line.match(/^(Основание|Технические данные|Basis|Technical data)\s*[:—-]?\s*(.*)$/iu);
  if (!match) return null;
  return { label: match[1], text: match[2].trim() };
}

export interface FormattedAiTextProps {
  text: string;
  className?: string;
  paragraphClassName?: string;
  variant?: 'default' | 'article';
}

/**
 * Long-form AI prose: editorial line length, relaxed leading, clear list rhythm.
 */
export const FormattedAiText = memo<FormattedAiTextProps>(({ text, className = '', paragraphClassName = '', variant = 'default' }) => {
  const blocks = useMemo(() => {
    if (!text?.trim()) return [];
    const normalized = text.replace(/\r\n/g, '\n').trim();
    return normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  }, [text]);

  if (blocks.length === 0) return null;

  const articleP =
    'font-sans text-[17px] leading-[1.9] tracking-[0.012em] text-astro-text text-left [text-wrap:pretty] sm:text-[18px] sm:leading-[1.95]';
  const defaultPBase =
    'font-sans text-[16px] leading-[1.7] tracking-[0.01em] text-astro-text [text-wrap:pretty] sm:text-[17px] sm:leading-[1.72]';
  const defaultP = paragraphClassName || (variant === 'article' ? articleP : defaultPBase);
  const blockGap = variant === 'article' ? 'space-y-8 sm:space-y-9' : 'space-y-6';
  const listText =
    variant === 'article'
      ? 'font-sans text-[16px] leading-[1.8] [text-wrap:pretty] sm:text-[17px] sm:leading-[1.85]'
      : 'text-[16px] leading-[1.65]';
  const mdHeadingClass =
    variant === 'article'
      ? 'font-sans text-left text-[1.85rem] font-extrabold leading-[1.08] tracking-[-0.04em] text-astro-text [text-wrap:balance] sm:text-[2.3rem] sm:leading-[1.06]'
      : 'font-sans text-[1.35rem] font-bold leading-tight tracking-[-0.025em] text-astro-text sm:text-[1.55rem]';

  const rootClass =
    variant === 'article'
      ? `${blockGap} mx-auto w-full max-w-reading-wide ${className}`.trim()
      : `${blockGap} ${className}`.trim();

  return (
    <div className={rootClass}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        const allList = lines.length > 1 && lines.every(isListLine);
        if (allList) {
          return (
            <ul
              key={bi}
              className={`list-none space-y-3 border-l border-black/15 pl-4 text-left text-astro-text sm:space-y-3.5 sm:pl-5 ${listText}`}
            >
              {lines.map((line, li) => (
                <li key={li} className="relative pl-0 [text-wrap:pretty]">
                  <span className="absolute -left-3 top-[0.55em] h-1 w-1 rounded-full bg-[#171717] sm:-left-3.5" aria-hidden />
                  {parseInlineFormatting(listItemText(line))}
                </li>
              ))}
            </ul>
          );
        }

        const first = lines[0];
        const { isHeading, text: headText } = stripMdHeaders(first);
        if (isHeading) {
          const restLines = lines.slice(1);
          const restIsList = restLines.length > 0 && restLines.every(isListLine);
          const rest = restLines.join('\n');
          return (
            <div key={bi} className={variant === 'article' ? 'space-y-4 sm:space-y-5' : 'space-y-3'}>
              <h3 className={mdHeadingClass}>
                {parseInlineFormatting(headText)}
              </h3>
              {restIsList ? (
                <ul className={`list-none space-y-3 border-l border-black/15 pl-4 text-left text-astro-text ${listText}`}>
                  {restLines.map((line, lineIndex) => (
                    <li key={lineIndex} className="relative [text-wrap:pretty]">
                      <span className="absolute -left-3 top-[0.55em] h-1 w-1 rounded-full bg-[#171717]" aria-hidden />
                      {parseInlineFormatting(listItemText(line))}
                    </li>
                  ))}
                </ul>
              ) : rest ? <p className={defaultP}>{parseInlineFormatting(rest)}</p> : null}
            </div>
          );
        }

        const technical = technicalBlock(first);
        if (technical) {
          const body = [technical.text, ...lines.slice(1)].filter(Boolean).join(' ');
          return (
            <aside key={bi} className="border-y border-black/10 bg-[#f3f3f1] px-4 py-3 text-left text-[14px] leading-[1.65] text-[#4f4f4b] sm:px-5 sm:text-[15px]">
              <strong className="mr-1 font-bold text-[#171717]">{technical.label}.</strong>
              {parseInlineFormatting(body)}
            </aside>
          );
        }

        const trailingList = lines.length > 1 && lines.slice(1).every(isListLine);
        if (trailingList) {
          return (
            <div key={bi} className="space-y-3">
              <p className={defaultP}>{parseInlineFormatting(first)}</p>
              <ul className={`list-none space-y-3 border-l border-black/15 pl-4 text-left text-astro-text ${listText}`}>
                {lines.slice(1).map((line, lineIndex) => (
                  <li key={lineIndex} className="relative [text-wrap:pretty]">
                    <span className="absolute -left-3 top-[0.55em] h-1 w-1 rounded-full bg-[#171717]" aria-hidden />
                    {parseInlineFormatting(listItemText(line))}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <p key={bi} className={defaultP}>
            {parseInlineFormatting(lines.join('\n'))}
          </p>
        );
      })}
    </div>
  );
});

FormattedAiText.displayName = 'FormattedAiText';
