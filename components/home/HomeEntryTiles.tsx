import React, { useState } from 'react';
import { Wind } from 'lucide-react';
import { AssetSlot } from '../lumia-ui/AssetSlot';
import { MatrixRain } from './MatrixRain';

export type HomeEntryTileId = 'future' | 'compatibility' | 'matrix' | 'antistress' | 'tests' | 'sounds' | 'stories';

export type HomeEntryTile = {
  id: HomeEntryTileId;
  onOpen?: () => void;
};

const LABELS: Record<HomeEntryTileId, { ru: string; en: string }> = {
  future: { ru: 'Будущее', en: 'Future' },
  compatibility: { ru: 'Совместимость', en: 'Compatibility' },
  matrix: { ru: 'Матрица', en: 'Matrix' },
  antistress: { ru: 'Антистресс', en: 'Anti-stress' },
  tests: { ru: 'Тесты', en: 'Tests' },
  sounds: { ru: 'Звуки', en: 'Sounds' },
  stories: { ru: 'Рассказы', en: 'Stories' },
};

export const HOME_TILE_ICONS: Record<HomeEntryTileId, string> = {
  future: '/assets/home-tiles/future.webp',
  compatibility: '/assets/home-tiles/compatibility.webp',
  matrix: '/assets/home-tiles/matrix.webp',
  antistress: '/assets/home-tiles/antistress.webp',
  tests: '/assets/home-tiles/tests.webp',
  sounds: '/assets/home-tiles/sounds.webp',
  stories: '/assets/home-tiles/stories.webp',
};

/** The picture of a tile; until its file exists the tile shows a plain icon instead of an empty pad. */
function TileArt({ id }: { id: HomeEntryTileId }) {
  const [missing, setMissing] = useState(false);
  if (id === 'antistress' && missing) return <Wind className="home-entry-tile-fallback" size={34} strokeWidth={1.8} aria-hidden="true" />;
  if (id === 'antistress') {
    return <img className="home-entry-tile-art-img" src={HOME_TILE_ICONS[id]} alt="" draggable={false} onError={() => setMissing(true)} />;
  }
  return <AssetSlot src={HOME_TILE_ICONS[id]} fit="contain" className="home-entry-tile-art" />;
}

/**
 * Entries into every section, right under the home header. The row scrolls
 * sideways; a tile appears only when its section can be opened.
 */
export function HomeEntryTiles({
  tiles,
  language,
}: {
  tiles: readonly HomeEntryTile[];
  language: 'ru' | 'en';
}) {
  const visible = tiles.filter((tile) => tile.onOpen);
  if (!visible.length) return null;
  return (
    <nav className="home-entry-tiles" aria-label={language === 'ru' ? 'Разделы' : 'Sections'}>
      <ul className="home-entry-tiles-row">
        {visible.map((tile) => (
          <li key={tile.id}>
            <button type="button" className={`home-entry-tile is-${tile.id}`} onClick={tile.onOpen}>
              {tile.id === 'matrix' ? (
                <span className="home-entry-tile-icon home-entry-tile-matrix" aria-hidden="true">
                  <MatrixRain className="matrix-rain" />
                </span>
              ) : (
                <span className="home-entry-tile-icon home-entry-tile-pad" aria-hidden="true">
                  <TileArt id={tile.id} />
                </span>
              )}
              <span className="home-entry-tile-label">{LABELS[tile.id][language]}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
