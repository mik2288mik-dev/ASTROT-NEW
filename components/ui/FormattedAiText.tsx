import React, { memo, useMemo } from 'react';

function stripMdHeaders(line: string): { isHeading: boolean; text: string } {
  const m = line.match(/^(#{1,6})\s+(.+)$/);
  if (m) return { isHeading: true, text: m[2].trim() };
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

export interface FormattedAiTextProps {
  text: string;
  className?: string;
  paragraphClassName?: string;
  /** Larger type + spacing for hero / long reads (natal intro, daily body) */
  variant?: 'default' | 'article';
}

/**
 * Renders AI prose with readable structure: paragraphs, simple lists, optional **bold**, stripped # headings.
 */
export const FormattedAiText = memo<FormattedAiTextProps>(({ text, className = '', paragraphClassName = '', variant = 'default' }) => {
  const blocks = useMemo(() => {
    if (!text?.trim()) return [];
    const normalized = text.replace(/\r\n/g, '\n').trim();
    return normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  }, [text]);

  if (blocks.length === 0) return null;

  const articleP =
    'text-[17px] sm:text-lg leading-[1.65] sm:leading-[1.7] text-astro-text tracking-normal [text-wrap:pretty]';
  const defaultPBase =
    'text-[16px] sm:text-[17px] leading-[1.65] sm:leading-[1.7] text-astro-text tracking-normal [text-wrap:pretty]';
  const defaultP = paragraphClassName || (variant === 'article' ? articleP : defaultPBase);
  const blockGap = variant === 'article' ? 'space-y-6' : 'space-y-5';
  const listText = variant === 'article' ? 'text-[16px] sm:text-[17px] leading-[1.65]' : 'text-[16px] leading-[1.65]';

  return (
    <div className={`${blockGap} ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        const allList = lines.length > 1 && lines.every(isListLine);
        if (allList) {
          return (
            <ul key={bi} className={`list-disc space-y-2.5 pl-5 text-astro-text sm:pl-6 ${listText}`}>
              {lines.map((line, li) => (
                <li key={li} className="pl-0.5 marker:text-astro-highlight">
                  {parseInlineFormatting(listItemText(line))}
                </li>
              ))}
            </ul>
          );
        }

        const first = lines[0];
        const { isHeading, text: headText } = stripMdHeaders(first);
        if (isHeading) {
          const rest = lines.slice(1).join('\n');
          return (
            <div key={bi} className="space-y-2">
              <h3 className="text-[15px] font-semibold tracking-wide text-astro-text sm:text-base">
                {parseInlineFormatting(headText)}
              </h3>
              {rest ? (
                <p className={defaultP}>{parseInlineFormatting(rest)}</p>
              ) : null}
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
