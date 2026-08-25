const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type CompatibilityRingGeometry = {
  score: number;
  normalized: number;
  centerDistance: number;
  centerOffset: number;
};

/**
 * Equal-diameter rings: a higher score always produces a smaller distance
 * between their centers. Values are CSS pixels for the mobile result visual.
 */
export function getCompatibilityRingGeometry(score: number, maxCenterDistance = 112): CompatibilityRingGeometry {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, 0, 100);
  const normalized = safeScore / 100;
  const centerDistance = maxCenterDistance * (1 - normalized);
  return {
    score: Math.round(safeScore),
    normalized,
    centerDistance: Number(centerDistance.toFixed(2)),
    centerOffset: Number((centerDistance / 2).toFixed(2)),
  };
}
