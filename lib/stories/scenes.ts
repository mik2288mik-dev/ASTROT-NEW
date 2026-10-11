/** Additive media contract. Text remains the complete, independently readable episode. */
export type StoryScene = {
  id: string;
  /** Exact, unique passage in the paragraph beside which the scene belongs. */
  anchor: string;
  kind: 'video' | 'image';
  src: string;
  poster: string;
  alt: string;
  side: 'left' | 'right';
};

export const MAX_STORY_SCENES = 24;

export function storyParagraphs(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split(/\n{2,}/u).filter((paragraph) => paragraph.trim());
}

function mediaPath(value: unknown, video = false): value is string {
  return typeof value === 'string' && !value.includes('//') && (video
    ? /^\/video\/stories\/[a-z0-9/-]+\.mp4$/u
    : /^\/assets\/stories\/scenes\/[a-z0-9/-]+\.(?:webp|gif)$/u).test(value);
}

/** Reject malformed/unanchored media without ever changing or hiding the prose. */
export function parseStoryScenes(value: unknown, text: string): StoryScene[] {
  if (!Array.isArray(value)) return [];
  const paragraphs = storyParagraphs(text);
  const usedParagraphs = new Set<number>();
  const ids = new Set<string>();
  const scenes: StoryScene[] = [];
  for (const item of value.slice(0, MAX_STORY_SCENES)) {
    if (!item || typeof item !== 'object') continue;
    const scene = item as Record<string, unknown>;
    if (typeof scene.id !== 'string' || !/^[a-z0-9-]{1,80}$/u.test(scene.id) || ids.has(scene.id)) continue;
    if (typeof scene.anchor !== 'string' || scene.anchor.trim().length < 12 || scene.anchor.length > 300) continue;
    if (scene.kind !== 'video' && scene.kind !== 'image') continue;
    if (!mediaPath(scene.src, scene.kind === 'video') || !mediaPath(scene.poster)) continue;
    if (typeof scene.alt !== 'string' || !scene.alt.trim() || scene.alt.length > 300) continue;
    if (scene.side !== 'left' && scene.side !== 'right') continue;
    const matches = paragraphs.flatMap((paragraph, index) => paragraph.includes(scene.anchor as string) ? [index] : []);
    if (matches.length !== 1 || usedParagraphs.has(matches[0])) continue;
    usedParagraphs.add(matches[0]);
    ids.add(scene.id);
    scenes.push({ id: scene.id, anchor: scene.anchor, kind: scene.kind, src: scene.src,
      poster: scene.poster as string, alt: scene.alt.trim(), side: scene.side });
  }
  return scenes.sort((a, b) => paragraphs.findIndex((p) => p.includes(a.anchor)) - paragraphs.findIndex((p) => p.includes(b.anchor)));
}
