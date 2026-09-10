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

  it('uses classic as the auto fallback and catalog only when it is ready', () => {
    expect(resolveNatalReadingRenderer('auto', false)).toBe('classic');
    expect(resolveNatalReadingRenderer('auto', true)).toBe('catalog');
    expect(resolveNatalReadingRenderer('catalog', false)).toBe('catalog');
    expect(resolveNatalReadingRenderer('classic', true)).toBe('classic');
  });
});
