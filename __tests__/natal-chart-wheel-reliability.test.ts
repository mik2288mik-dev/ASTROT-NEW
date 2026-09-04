import {
  buildNatalChartWheelModel,
  getNatalChartWheelCaption,
} from '../lib/natalChartWheelModel';

function chart(quality: 'exact' | 'approximate' | 'unknown') {
  const exact = quality === 'exact';
  const position = (key: string, longitude: number, reliability: string) => ({
    key,
    object: key,
    planet: key,
    longitude,
    degree: longitude % 30,
    sign: 'Aries',
    reliability,
  });
  const sun = position('sun', 10, exact ? 'exact' : 'stable_in_range');
  const moon = position('moon', 45, quality === 'unknown' || quality === 'approximate' ? 'variable_in_range' : 'exact');
  const ascendant = quality === 'unknown' ? null : {
    ...position('ascendant', 90, exact ? 'exact' : 'stable_in_range'),
    stableSign: true,
  };
  const mc = quality === 'unknown' ? null : {
    ...position('mc', 180, quality === 'approximate' ? 'variable_in_range' : 'exact'),
    stableSign: quality !== 'approximate',
  };
  const houses = quality === 'unknown' ? [] : [
    { house: 1, longitude: 90, reliability: exact ? 'exact' : 'stable_in_range', stableSign: true },
    { house: 2, longitude: 120, reliability: quality === 'approximate' ? 'variable_in_range' : 'exact', stableSign: exact },
  ];
  return {
    schemaVersion: 'natal-chart-data-v2',
    positions: { sun, moon },
    angles: { ascendant, mc, descendant: null, ic: null },
    houses,
    aspects: [],
    chartQuality: {
      birthTimeMode: quality,
      birthTimeQuality: quality,
      variableAngles: quality === 'approximate' ? ['mc'] : [],
      variableHouses: quality === 'approximate' ? [2] : [],
      stableHousePlacements: quality === 'approximate' ? ['sun'] : [],
    },
    birthTimeQuality: quality,
  } as any;
}

describe('natal chart wheel reliability', () => {
  it('keeps all exact coordinates unchanged', () => {
    const model = buildNatalChartWheelModel(chart('exact'));
    expect(model.bodies.map((value) => value.key)).toEqual(['sun', 'moon']);
    expect(model.angles.map((value) => value.key)).toEqual(['ascendant', 'mc']);
    expect(model.houses.map((value) => value.house)).toEqual([1, 2]);
    expect(getNatalChartWheelCaption('exact', 'ru', 0))
      .toBe('Точные положения рассчитанных объектов и аспекты из карты.');
  });

  it('shows stable approximate coordinates but hides variable ones', () => {
    const model = buildNatalChartWheelModel(chart('approximate'));
    expect(model.bodies.map((value) => value.key)).toEqual(['sun']);
    expect(model.angles.map((value) => value.key)).toEqual(['ascendant']);
    expect(model.houses.map((value) => value.house)).toEqual([1]);
    expect(getNatalChartWheelCaption('approximate', 'ru', 1)).not.toContain('Точные положения');
  });

  it('shows time-stable bodies for unknown time without houses or angles', () => {
    const model = buildNatalChartWheelModel(chart('unknown'));
    expect(model.bodies.map((value) => value.key)).toEqual(['sun']);
    expect(model.angles).toEqual([]);
    expect(model.houses).toEqual([]);
    expect(getNatalChartWheelCaption('unknown', 'ru', 1)).toContain('устойчивые');
  });
});
