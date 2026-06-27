import { lookupCityCoordinates } from '../lib/cityGazetteer';

describe('cityGazetteer.lookupCityCoordinates', () => {
  it('resolves common Russian cities', () => {
    expect(lookupCityCoordinates('Москва')).toEqual({ lat: 55.7558, lon: 37.6173 });
    expect(lookupCityCoordinates('Санкт-Петербург')).toEqual({ lat: 59.9311, lon: 30.3609 });
  });

  it('ignores the region/country part after a comma (autocomplete label format)', () => {
    expect(lookupCityCoordinates('Москва, Россия')).toEqual({ lat: 55.7558, lon: 37.6173 });
    expect(lookupCityCoordinates('Казань, Республика Татарстан, Россия')).toEqual({ lat: 55.7963, lon: 49.1088 });
  });

  it('is case-insensitive and handles ё, the "г." prefix and colloquial names', () => {
    expect(lookupCityCoordinates('москва')).toEqual({ lat: 55.7558, lon: 37.6173 });
    expect(lookupCityCoordinates('г. Орёл')).toEqual(lookupCityCoordinates('Орел'));
    expect(lookupCityCoordinates('Питер')).toEqual({ lat: 59.9311, lon: 30.3609 });
    expect(lookupCityCoordinates('СПб')).toEqual({ lat: 59.9311, lon: 30.3609 });
  });

  it('resolves Latin spellings and CIS/world cities', () => {
    expect(lookupCityCoordinates('Moscow')).toEqual({ lat: 55.7558, lon: 37.6173 });
    expect(lookupCityCoordinates('Kyiv')).toEqual({ lat: 50.4501, lon: 30.5234 });
    expect(lookupCityCoordinates('Минск')).toEqual({ lat: 53.9006, lon: 27.5590 });
    expect(lookupCityCoordinates('Алматы')).toEqual({ lat: 43.2220, lon: 76.8512 });
    expect(lookupCityCoordinates('Лондон')).toEqual({ lat: 51.5074, lon: -0.1278 });
  });

  it('returns null for unknown or empty input (falls back to online geocoding)', () => {
    expect(lookupCityCoordinates('')).toBeNull();
    expect(lookupCityCoordinates('Неведомоеселоназвание12345')).toBeNull();
  });
});
