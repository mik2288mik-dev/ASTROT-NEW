declare module 'swisseph' {
  // Constants
  export const SE_SUN: number;
  export const SE_MOON: number;
  export const SE_MERCURY: number;
  export const SE_VENUS: number;
  export const SE_MARS: number;
  export const SE_JUPITER: number;
  export const SE_SATURN: number;
  export const SE_URANUS: number;
  export const SE_NEPTUNE: number;
  export const SE_PLUTO: number;
  export const SEFLG_SWIEPH: number;
  export const SE_GREG_CAL: number;

  // Functions
  export function swe_set_ephe_path(path: string): void;
  
  export function swe_julday(
    year: number,
    month: number,
    day: number,
    hour: number,
    gregflag: number
  ): number;

  export function swe_calc_ut(
    tjd: number,
    ipl: number,
    iflag: number
  ): {
    flag: number;
    longitude: number;
    latitude: number;
    distance: number;
    speedLongitude: number;
    speedLatitude: number;
    speedDistance: number;
    error?: string;
  };

  export function swe_houses(
    tjd: number,
    geolat: number,
    geolon: number,
    hsys: string
  ): {
    house: number[];
    ascendant: number;
    mc: number;
    armc: number;
    vertex: number;
    equatorialAscendant: number;
    coAscendantKoch: number;
    coAscendantMunkasey: number;
    polarAscendant: number;
  };

  export function swe_close(): void;
}
