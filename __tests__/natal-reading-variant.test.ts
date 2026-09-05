import {
  readNatalReadingVariant,
  resolveNatalReadingRenderer,
  writeNatalReadingVariant,
  type NatalReadingVariantStorage,
} from '../lib/natalReading/readingVariant';

function memoryStorage(): NatalReadingVariantStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('admin natal reading variant', () => {
  it('always keeps non-admin users in safe auto mode', () => {
    const storage = memoryStorage();
    expect(writeNatalReadingVariant('user-1', false, 'catalog', storage)).toBe('auto');
    expect(readNatalReadingVariant('user-1', false, storage)).toBe('auto');
    expect(storage.values.size).toBe(0);
  });

  it('stores an admin choice separately for every user', () => {
    const storage = memoryStorage();
    expect(writeNatalReadingVariant('admin-1', true, 'catalog', storage)).toBe('catalog');
    expect(writeNatalReadingVariant('admin-2', true, 'classic', storage)).toBe('classic');
    expect(readNatalReadingVariant('admin-1', true, storage)).toBe('catalog');
    expect(readNatalReadingVariant('admin-2', true, storage)).toBe('classic');
    expect(readNatalReadingVariant('admin-3', true, storage)).toBe('auto');
  });

  it('opens the narrative catalog on a first visit and preserves only explicit classic selection', () => {
    expect(resolveNatalReadingRenderer('auto', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('auto', true)).toBe('catalog');
    expect(resolveNatalReadingRenderer('catalog', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('classic', true)).toBe('classic');
    expect(resolveNatalReadingRenderer('classic', false)).toBe('classic');
  });

  it('ignores a stored classic choice after admin access is removed', () => {
    const storage = memoryStorage();
    writeNatalReadingVariant('user-1', true, 'classic', storage);
    expect(resolveNatalReadingRenderer(readNatalReadingVariant('user-1', false, storage), false)).toBe('catalog');
  });
});
