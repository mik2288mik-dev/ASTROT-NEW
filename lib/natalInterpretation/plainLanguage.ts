// Natal-only editorial guard. Ordinary words remain allowed; reject the
// mechanical phrases that turn calculator fields into opaque prose.
const TECHNICAL_PROSE = /(?:самоподач\p{L}*|самопроявлен\p{L}*|самовыражени\p{L}*|внутренн\p{L}*\s+пересмотр\p{L}*|(?:менее|более)\s+привычн\p{L}*\s+направлен\p{L}*|реакци\p{L}*\s+(?:чаще\s+)?(?:ид[её]т|идут|выражается)\s+(?:напрямую|прямо)|(?:включаются|работают)\s+вместе|могут\s+требовать\s+(?:разных|разного)|ощущаются\s+как\s+два\s+полюса|считыва\p{L}*\s+(?:настроени\p{L}*|контекст)|фонов\p{L}*\s+(?:настройк\p{L}*|поправк\p{L}*)|\b(?:background\s+(?:modifier|setting)|inner\s+review|two\s+functions|less\s+familiar\s+direction)\b)/iu;

export function natalPlainLanguageError(text: string): string | null {
  if (TECHNICAL_PROSE.test(text)) return 'technical pseudo-prose';
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map(sentence => sentence.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()).filter(Boolean) || [];
  if (new Set(sentences).size !== sentences.length) return 'repeated sentence';
  return null;
}
