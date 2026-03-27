/**
 * Remove opening duplicate greeting from AI natal intro when it mirrors the screen header.
 */

function normalizeForCompare(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/[!?.…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function stripRedundantIntroGreeting(raw: string, name: string | undefined): string {
  if (!raw?.trim()) return raw;
  const n = name?.trim();
  if (!n) return raw;

  let text = raw.trim();
  const nl = n.toLowerCase();

  const greetingPatterns = [
    `привет, ${nl}`,
    `привет ${nl}`,
    `здравствуй, ${nl}`,
    `здравствуй ${nl}`,
    `добрый день, ${nl}`,
    `hi, ${nl}`,
    `hey, ${nl}`,
    `hello, ${nl}`,
    `dear ${nl}`,
  ];

  const stripLeadingBlock = (): boolean => {
    const parts = text.split(/\n{2,}/);
    if (parts.length === 0) return false;
    const block0 = parts[0].trim();
    const lines = block0.split('\n').map((l) => l.replace(/\*\*/g, '').trim()).filter(Boolean);
    if (lines.length === 0) return false;

    const firstLineNorm = normalizeForCompare(lines[0]);
    if (firstLineNorm.length > 160) return false;

    const matchesGreeting = greetingPatterns.some((p) => firstLineNorm.startsWith(p));
    if (!matchesGreeting) return false;

    // Single-line greeting block → drop whole first paragraph
    if (lines.length === 1) {
      text = parts.slice(1).join('\n\n').trim();
      return true;
    }

    // Multi-line first block: drop first line if it's only the greeting
    const restOfBlock = lines.slice(1).join('\n').trim();
    if (restOfBlock) {
      text = [restOfBlock, ...parts.slice(1)].join('\n\n').trim();
    } else {
      text = parts.slice(1).join('\n\n').trim();
    }
    return true;
  };

  // Up to 2 passes (greeting paragraph + optional second redundant line)
  for (let i = 0; i < 2; i++) {
    if (!stripLeadingBlock()) break;
  }

  return text || raw;
}
