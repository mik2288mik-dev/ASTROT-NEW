import { getRuStoreProduct, RUSTORE_PRODUCTS } from '../lib/rustoreProductCatalog';

describe('RuStore one-time product catalog', () => {
  it('has unique ids and positive prices', () => {
    const ids = RUSTORE_PRODUCTS.map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const product of RUSTORE_PRODUCTS) expect(product.priceRub).toBeGreaterThan(0);
  });

  it('keeps purchases about yourself permanent and the rest consumable', () => {
    const permanent = RUSTORE_PRODUCTS.filter((product) => product.kind === 'permanent').map((product) => product.id);
    expect(permanent).toEqual(['natal_full', 'poster_birth_sky']);
    expect(RUSTORE_PRODUCTS).toHaveLength(9);
  });

  it('finds products by id and rejects unknown ones', () => {
    expect(getRuStoreProduct('reading_one')).toMatchObject({ priceRub: 99, units: 1 });
    expect(getRuStoreProduct('matrix_full')).toBeNull();
    expect(getRuStoreProduct('premium_month')).toBeNull();
  });
});
