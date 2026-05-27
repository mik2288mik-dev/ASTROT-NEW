export type HomeVideoCardId = 'horoscope' | 'love' | 'money' | 'work' | 'rhythm';

export type HomeCardVideoAsset = {
  src: string;
  poster: string;
  visualFamily: string;
  enabled?: boolean;
};

export type ResolvedHomeCardVideo = {
  poster: string | null;
  video: HomeCardVideoAsset | null;
  visualFamily: string | null;
};

export type HomeCardVideoRegistry = Record<HomeVideoCardId, ReadonlyArray<HomeCardVideoAsset>>;

export const HOME_VIDEO_CARD_ORDER: readonly HomeVideoCardId[] = [
  'horoscope',
  'love',
  'money',
  'work',
  'rhythm',
];

export const HOME_CARD_VIDEO_REGISTRY: HomeCardVideoRegistry = {
  horoscope: [
    {
      src: '/assets/card-videos/horoscope/loop.mp4',
      poster: '/assets/card-videos/horoscope/poster.webp',
      visualFamily: 'orange_birds_moon',
    },
    {
      src: '/assets/card-videos/horoscope/loop-02.mp4',
      poster: '/assets/card-videos/horoscope/poster-02.webp',
      visualFamily: 'night_rice_fields',
    },
    {
      src: '/assets/card-videos/horoscope/loop-03.mp4',
      poster: '/assets/card-videos/horoscope/poster-03.webp',
      visualFamily: 'blue_clouds',
    },
  ],
  love: [
    {
      src: '/assets/card-videos/love/loop.mp4',
      poster: '/assets/card-videos/love/poster.webp',
      visualFamily: 'blue_clouds',
    },
    {
      src: '/assets/card-videos/love/loop-02.mp4',
      poster: '/assets/card-videos/love/poster-02.webp',
      visualFamily: 'turquoise_coast',
    },
    {
      src: '/assets/card-videos/love/loop-03.mp4',
      poster: '/assets/card-videos/love/poster-03.webp',
      visualFamily: 'orange_birds_moon',
    },
  ],
  money: [
    {
      src: '/assets/card-videos/money/loop.mp4',
      poster: '/assets/card-videos/money/poster.webp',
      visualFamily: 'green_mountain_path',
    },
    {
      src: '/assets/card-videos/money/loop-02.mp4',
      poster: '/assets/card-videos/money/poster-02.webp',
      visualFamily: 'green_hills_aerial',
    },
    {
      src: '/assets/card-videos/money/loop-03.mp4',
      poster: '/assets/card-videos/money/poster-03.webp',
      visualFamily: 'turquoise_coast',
    },
  ],
  work: [
    {
      src: '/assets/card-videos/work/loop.mp4',
      poster: '/assets/card-videos/work/poster.webp',
      visualFamily: 'green_hills_aerial',
    },
    {
      src: '/assets/card-videos/work/loop-02.mp4',
      poster: '/assets/card-videos/work/poster-02.webp',
      visualFamily: 'green_mountain_path',
    },
    {
      src: '/assets/card-videos/work/loop-03.mp4',
      poster: '/assets/card-videos/work/poster-03.webp',
      visualFamily: 'snow_horses',
    },
  ],
  rhythm: [
    {
      src: '/assets/card-videos/rhythm/loop.mp4',
      poster: '/assets/card-videos/rhythm/poster.webp',
      visualFamily: 'snow_forest',
    },
    {
      src: '/assets/card-videos/rhythm/loop-02.mp4',
      poster: '/assets/card-videos/rhythm/poster-02.webp',
      visualFamily: 'night_rice_fields',
    },
    {
      src: '/assets/card-videos/rhythm/loop-03.mp4',
      poster: '/assets/card-videos/rhythm/poster-03.webp',
      visualFamily: 'blue_clouds',
    },
  ],
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function orderedCandidates(
  candidates: ReadonlyArray<HomeCardVideoAsset>,
  dateKey: string,
  cardId: HomeVideoCardId,
  index: number,
) {
  const enabled = candidates.filter((candidate) => candidate.enabled !== false);
  if (enabled.length <= 1) return enabled;
  const start = hashString(`${dateKey}:${cardId}:${index}`) % enabled.length;
  return [...enabled.slice(start), ...enabled.slice(0, start)];
}

export function resolveHomeCardVideosForDate(
  dateKey: string,
  cardIds: readonly HomeVideoCardId[] = HOME_VIDEO_CARD_ORDER,
  registry: HomeCardVideoRegistry = HOME_CARD_VIDEO_REGISTRY,
): Record<HomeVideoCardId, ResolvedHomeCardVideo> {
  const usedVisualFamilies = new Set<string>();
  const resolved = {} as Record<HomeVideoCardId, ResolvedHomeCardVideo>;

  cardIds.forEach((cardId, index) => {
    const candidates = registry[cardId] || [];
    const fallbackPoster = candidates.find((candidate) => candidate.poster)?.poster || null;
    const ordered = orderedCandidates(candidates, dateKey, cardId, index);
    const video =
      ordered.find((candidate) => !usedVisualFamilies.has(candidate.visualFamily)) || null;

    if (video) {
      usedVisualFamilies.add(video.visualFamily);
      resolved[cardId] = {
        poster: video.poster || fallbackPoster,
        video,
        visualFamily: video.visualFamily,
      };
      return;
    }

    resolved[cardId] = {
      poster: fallbackPoster,
      video: null,
      visualFamily: null,
    };
  });

  return resolved;
}
