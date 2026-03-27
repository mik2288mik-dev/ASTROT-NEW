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
}

/**
 * Renders AI prose with readable structure: paragraphs, simple lists, optional **bold**, stripped # headings.
 */
export const FormattedAiText = memo<FormattedAiTextProps>(({ text, className = '', paragraphClassName = '' }) => {
  const blocks = useMemo(() => {
    if (!text?.trim()) return [];
    const normalized = text.replace(/\r\n/g, '\n').trim();
    return normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  }, [text]);

  if (blocks.length === 0) return null;

  const defaultP = paragraphClassName || 'text-[15px] leading-relaxed text-astro-text whitespace-pre-line';

  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        const allList = lines.length > 1 && lines.every(isListLine);
        if (allList) {
          return (
            <ul key={bi} className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-astro-text">
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
              <h3 className="text-sm font-semibold tracking-wide text-astro-text">{parseInlineFormatting(headText)}</h3>
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
