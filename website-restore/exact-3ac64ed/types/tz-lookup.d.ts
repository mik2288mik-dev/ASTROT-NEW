declare module 'tz-lookup' {
  /**
   * Looks up the timezone for a given latitude and longitude.
   * @param lat - Latitude in degrees (-90 to 90)
   * @param lon - Longitude in degrees (-180 to 180)
   * @returns IANA timezone string (e.g., 'America/New_York', 'Europe/Moscow')
   */
  function tzLookup(lat: number, lon: number): string;
  export default tzLookup;
}
