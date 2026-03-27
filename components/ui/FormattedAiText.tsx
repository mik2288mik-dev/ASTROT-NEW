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
    'font-sans text-[17px] leading-[1.72] tracking-[0.01em] text-astro-text [text-wrap:pretty] sm:text-[18px] sm:leading-[1.75]';
  const defaultPBase =
    'font-sans text-[16px] leading-[1.7] tracking-[0.01em] text-astro-text [text-wrap:pretty] sm:text-[17px] sm:leading-[1.72]';
  const defaultP = paragraphClassName || (variant === 'article' ? articleP : defaultPBase);
  const blockGap = variant === 'article' ? 'space-y-7' : 'space-y-6';
  const listText =
    variant === 'article'
      ? 'text-[16px] leading-[1.68] sm:text-[17px] sm:leading-[1.72]'
      : 'text-[16px] leading-[1.65]';

  return (
    <div className={`${blockGap} ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        const allList = lines.length > 1 && lines.every(isListLine);
        if (allList) {
          return (
            <ul
              key={bi}
              className={`list-none space-y-3 border-l-2 border-astro-highlight/25 pl-4 text-astro-text sm:space-y-3.5 sm:pl-5 ${listText}`}
            >
              {lines.map((line, li) => (
                <li key={li} className="relative pl-0 [text-wrap:pretty]">
                  <span className="absolute -left-3 top-[0.55em] h-1 w-1 rounded-full bg-astro-highlight/50 sm:-left-3.5" aria-hidden />
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
            <div key={bi} className="space-y-3">
              <h3 className="font-sans text-[15px] font-semibold tracking-wide text-astro-text sm:text-base">
                {parseInlineFormatting(headText)}
              </h3>
              {rest ? <p className={defaultP}>{parseInlineFormatting(rest)}</p> : null}
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
