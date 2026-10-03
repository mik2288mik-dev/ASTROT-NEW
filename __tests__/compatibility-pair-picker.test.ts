import fs from 'fs';
import path from 'path';
import { buildCompatibilityLiveSample } from '../lib/synastry/compatibilityLiveSample';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('compatibility picker', () => {
  it('builds a live sample on the person’s own sign: scale, four topics and a closing quote', () => {
    const sample = buildCompatibilityLiveSample('virgo', true)!;
    expect(sample.you).toBe('virgo');
    expect(sample.youName).toBe('Дева');
    expect(sample.partner).not.toBe('virgo');
    expect(sample.score).toBeGreaterThanOrEqual(35);
    expect(sample.score).toBeLessThanOrEqual(96);
    expect(sample.topics).toHaveLength(4);
    expect(sample.topics.every((topic) => topic.text.length > 20)).toBe(true);
    expect(sample.quote.length).toBeGreaterThan(10);
    const all = [sample.verdict, sample.quote, ...sample.topics.flatMap((topic) => [topic.title, topic.text])].join(' ');
    expect(all).not.toMatch(/\p{Extended_Pictographic}|Алина/u);
  });

  it('replaces the static «Алина & Максим» preview with the live sample', () => {
    const room = read('views/v2/UnionRoom.tsx');
    expect(room).not.toContain('Алина & Максим');
    expect(room).toContain('<CompatibilityLiveSample yourSign={yourSign} ru={ru} />');
  });

  it('draws two avatars, the saved people strip, icon tiles and a pinned «Сравнить нас»', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const picker = read('components/compatibility/CompatibilityPairPicker.tsx');
    expect(room).toContain('<CompatibilityPairAvatars');
    expect(room).toContain('<CompatibilitySavedPeople');
    expect(room).toContain('compat-context-tile');
    expect(room).toContain('compat-entry-submit-bar');
    expect(picker).toContain('compat-pair-avatar-sign');
    expect(picker).toContain('compat-pair-picker-plus');
  });
});
