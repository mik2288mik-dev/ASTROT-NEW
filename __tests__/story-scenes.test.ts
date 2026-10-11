import { parseStoryScenes, storyParagraphs } from '../lib/stories/scenes';
import { scenesFromCues } from '../lib/stories/sceneCatalog';
import { buildEpisodePrompt, checkEpisodeConsistency, parseWrittenEpisode } from '../lib/stories/episodeWriter';
import { findStorySeries } from '../lib/stories/series';

const text = 'Вера положила конверт на прилавок.\n\nПиксель уселся возле связки ключей.\n\nВера раскрыла книгу под лампой.';
const scene = { id: 'envelope-1', anchor: 'Вера положила конверт', kind: 'video', src: '/video/stories/quiet-envelope.mp4', poster: '/assets/stories/scenes/quiet-envelope.webp', alt: 'Руки и конверт', side: 'right' };

describe('story scene contract', () => {
  it('keeps the full prose and sorts matching scenes by their passage', () => {
    const scenes = parseStoryScenes([{ ...scene, id: 'book-1', anchor: 'Вера раскрыла книгу' }, scene], text);
    expect(scenes.map((item) => item.id)).toEqual(['envelope-1', 'book-1']);
    expect(storyParagraphs(text).join('\n\n')).toBe(text);
  });
  it('falls back to text when an old server omits media or media is malformed', () => {
    expect(parseStoryScenes(undefined, text)).toEqual([]);
    for (const invalid of [{ src: 'https://example.com/a.mp4' }, { src: '/video/stories/../a.mp4' }, { kind: 'sprite' }, { anchor: 'Такого места в тексте нет' }]) {
      expect(parseStoryScenes([{ ...scene, ...invalid }], text)).toEqual([]);
    }
    expect(parseStoryScenes([scene, { ...scene, id: 'second' }], text)).toHaveLength(1);
    expect(parseStoryScenes([scene], `${text}\n\nВера положила конверт на стол.`)).toEqual([]);
  });
  it('never attaches a clip from another series or an invented clip', () => {
    expect(scenesFromCues('quiet-lane', text, [{ assetId: 'family-cat', anchor: scene.anchor, side: 'right' }])).toEqual([]);
    expect(scenesFromCues('quiet-lane', text, [{ assetId: 'quiet-envelope', anchor: scene.anchor, side: 'right' }])[0]).toMatchObject({ kind: 'image', src: '/assets/stories/scenes/quiet-envelope-motion.webp' });
  });
  it('continues the actual ending and accepts writer answers from before scenes existed', () => {
    const prompt = buildEpisodePrompt(findStorySeries('quiet-lane')!, 11, [{ number: 10, title: 'Часы', summary: 'Нашли часы.', facts: [], hook: 'В часах оказалось имя владельца.' }]);
    expect(prompt.input).toContain('Последняя серия закончилась так: В часах оказалось имя владельца.');
    expect(prompt.input).toContain('quiet-envelope');
    expect(prompt.input).not.toContain('ВИДЕОСЦЕНЫ');
    const old = parseWrittenEpisode(JSON.stringify({ title: 'Часы', text, summary: 'Итог', hook: 'Вера раскрыла книгу под лампой.', facts: [], charactersUsed: ['Вера'], newCharacters: [] }));
    expect(old?.sceneCues).toEqual([]);
    expect(checkEpisodeConsistency(findStorySeries('quiet-lane')!, { ...old!, text: text + '\n\nДругой финал.' }, [])).toContain('Нет крючка в конце серии');
  });
  it('accepts animated WebP and GIF without accepting a video disguised as an image', () => {
    for (const extension of ['webp', 'gif']) {
      const picture = { ...scene, kind: 'image', src: `/assets/stories/scenes/quiet-envelope-motion.${extension}` };
      expect(parseStoryScenes([picture], text)).toEqual([picture]);
    }
    expect(parseStoryScenes([{ ...scene, kind: 'image' }], text)).toEqual([]);
    expect(parseStoryScenes([{ ...scene, src: '/assets/stories/scenes/quiet-envelope-motion.webp' }], text)).toEqual([]);
  });
});
