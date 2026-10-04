import React from 'react';
import { AssetSlot } from '../lumia-ui/AssetSlot';
import { MatrixRain } from './MatrixRain';

export type HomeEntryTileId = 'future' | 'compatibility' | 'matrix' | 'tests' | 'sounds' | 'stories';

export type HomeEntryTile = {
  id: HomeEntryTileId;
  onOpen?: () => void;
};

const LABELS: Record<HomeEntryTileId, { ru: string; en: string }> = {
  future: { ru: 'Будущее', en: 'Future' },
  compatibility: { ru: 'Совместимость', en: 'Compatibility' },
  matrix: { ru: 'Матрица', en: 'Matrix' },
  tests: { ru: 'Тесты', en: 'Tests' },
  sounds: { ru: 'Звуки', en: 'Sounds' },
  stories: { ru: 'Рассказы', en: 'Stories' },
};

export const HOME_TILE_ICONS: Record<HomeEntryTileId, string> = {
  future: '/assets/home-tiles/future.webp',
  compatibility: '/assets/home-tiles/compatibility.webp',
  matrix: '/assets/home-tiles/matrix.webp',
  tests: '/assets/home-tiles/tests.webp',
  sounds: '/assets/home-tiles/sounds.webp',
  stories: '/assets/home-tiles/stories.webp',
};

/**
 * Entries into every section, right under the home header. The row scrolls
 * sideways; a tile appears only when its section can be opened.
 */
export function HomeEntryTiles({
  tiles,
  language,
  matrixNumber = null,
}: {
  tiles: readonly HomeEntryTile[];
  language: 'ru' | 'en';
  /** «Твой характер» from the matrix of destiny, shown on the live code tile. */
  matrixNumber?: number | null;
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
                  <MatrixRain />
                  {matrixNumber ? <b>{matrixNumber}</b> : null}
                </span>
              ) : (
                <span className="home-entry-tile-icon home-entry-tile-pad" aria-hidden="true">
                  <AssetSlot src={HOME_TILE_ICONS[tile.id]} fit="contain" className="home-entry-tile-art" />
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
