import {
  HOME_CARD_VIDEO_REGISTRY,
  HOME_VIDEO_CARD_ORDER,
  resolveHomeCardVideosForDate,
  type HomeCardVideoRegistry,
  type HomeVideoCardId,
} from '../lib/homeCardVideos';

function familiesFor(dateKey: string, registry: HomeCardVideoRegistry = HOME_CARD_VIDEO_REGISTRY) {
  return Object.values(resolveHomeCardVideosForDate(dateKey, HOME_VIDEO_CARD_ORDER, registry))
    .map((asset) => asset.video?.visualFamily)
    .filter((family): family is string => Boolean(family));
}

function makeAsset(cardId: HomeVideoCardId, family: string, index = 1) {
  return {
    src: `/test/${cardId}/${family}-${index}.mp4`,
    poster: `/test/${cardId}/${family}-${index}.webp`,
    visualFamily: family,
  };
}

describe('home card video resolver', () => {
  it('does not return duplicate visual families in the home rail', () => {
    for (const dateKey of ['2026-05-27', '2026-05-28', '2026-06-01', '2026-12-31']) {
      const families = familiesFor(dateKey);
      expect(new Set(families).size).toBe(families.length);
    }
  });

  it('keeps mirrored or reverse variants with one visual family out of the same rail', () => {
    const registry: HomeCardVideoRegistry = {
      horoscope: [makeAsset('horoscope', 'same_cloud_source')],
      love: [makeAsset('love', 'same_cloud_source'), makeAsset('love', 'love_unique')],
      money: [makeAsset('money', 'money_unique')],
      work: [makeAsset('work', 'work_unique')],
      rhythm: [makeAsset('rhythm', 'rhythm_unique')],
    };

    const resolved = resolveHomeCardVideosForDate('2026-05-27', HOME_VIDEO_CARD_ORDER, registry);
    const families = familiesFor('2026-05-27', registry);

    expect(new Set(families).size).toBe(families.length);
    expect(resolved.horoscope.video?.visualFamily).toBe('same_cloud_source');
    expect(resolved.love.video?.visualFamily).not.toBe('same_cloud_source');
  });

  it('falls back to static posters instead of repeating a visual family', () => {
    const registry: HomeCardVideoRegistry = {
      horoscope: [makeAsset('horoscope', 'one_scene')],
      love: [makeAsset('love', 'one_scene')],
      money: [makeAsset('money', 'one_scene')],
      work: [makeAsset('work', 'one_scene')],
      rhythm: [makeAsset('rhythm', 'one_scene')],
    };

    const resolved = resolveHomeCardVideosForDate('2026-05-27', HOME_VIDEO_CARD_ORDER, registry);
    const videos = Object.values(resolved).filter((asset) => asset.video);
    const posters = Object.values(resolved).map((asset) => asset.poster);

    expect(videos).toHaveLength(1);
    expect(posters.every(Boolean)).toBe(true);
  });

  it('keeps the same selection for a given date', () => {
    expect(resolveHomeCardVideosForDate('2026-05-27', HOME_VIDEO_CARD_ORDER)).toEqual(
      resolveHomeCardVideosForDate('2026-05-27', HOME_VIDEO_CARD_ORDER),
    );
  });
});
