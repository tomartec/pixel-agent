import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain mjs module without type declarations
import { buildAssetIndex } from '../scripts/asset-index.mjs';
import { buildDynamicCatalog, getCatalogEntry } from '../src/office/layout/furnitureCatalog.js';
import {
  getBlockedTiles,
  layoutToSeats,
  layoutToTileMap,
} from '../src/office/layout/layoutSerializer.js';
import { TileType } from '../src/office/types.js';
import { buildOfficeMap, MAP_DEFS, MAP_THEMES } from '../src/office/maps/index.js';

type AssetIndexEntry = {
  id: string;
  width: number;
  height: number;
  [key: string]: unknown;
};

beforeAll(async () => {
  await buildAssetIndex();
  const index = JSON.parse(
    readFileSync(new URL('../dist/ui/assets/agent-pixels-assets.json', import.meta.url), 'utf8'),
  ) as { furniture: AssetIndexEntry[] };
  const sprites = Object.fromEntries(
    index.furniture.map((asset) => [
      asset.id,
      Array.from({ length: asset.height }, () => Array<string>(asset.width).fill('')),
    ]),
  );
  const ok = buildDynamicCatalog({ catalog: index.furniture, sprites } as never);
  expect(ok).toBe(true);
});

describe.each(MAP_DEFS.map((def) => [def.id, def] as const))('map %s', (_id, def) => {
  const theme = MAP_THEMES[0];

  it('builds a well-formed layout', () => {
    const built = buildOfficeMap(def, theme);
    const { layout } = built;
    expect(layout.tiles.length).toBe(layout.cols * layout.rows);
    expect(layout.tileColors?.length).toBe(layout.tiles.length);
    expect(built.cameras.map((camera) => camera.id)).toEqual(['cam1', 'cam2', 'cam3', 'cam4', 'total']);
  });

  it('places only known furniture, in bounds', () => {
    const { layout } = buildOfficeMap(def, theme);
    for (const item of layout.furniture) {
      const entry = getCatalogEntry(item.type);
      expect(entry, `unknown furniture type ${item.type} (${item.uid})`).toBeDefined();
      expect(item.col, `${item.uid} col`).toBeGreaterThanOrEqual(0);
      expect(item.row, `${item.uid} row`).toBeGreaterThanOrEqual(-1);
      expect(item.col + entry!.footprintW, `${item.uid} right edge`).toBeLessThanOrEqual(layout.cols);
      expect(item.row + entry!.footprintH, `${item.uid} bottom edge`).toBeLessThanOrEqual(layout.rows);
    }
  });

  it('does not overlap floor furniture footprints', () => {
    const { layout } = buildOfficeMap(def, theme);
    const occupied = new Map<string, string>();
    for (const item of layout.furniture) {
      const entry = getCatalogEntry(item.type)!;
      if (entry.canPlaceOnSurfaces || entry.canPlaceOnWalls) continue;
      const bgRows = entry.backgroundTiles ?? 0;
      for (let dr = bgRows; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const key = `${item.col + dc},${item.row + dr}`;
          expect(occupied.get(key), `${item.uid} overlaps ${occupied.get(key)} at ${key}`).toBeUndefined();
          occupied.set(key, item.uid);
        }
      }
    }
  });

  it('keeps furniture off wall tiles', () => {
    const { layout } = buildOfficeMap(def, theme);
    const tileMap = layoutToTileMap(layout);
    for (const item of layout.furniture) {
      const entry = getCatalogEntry(item.type)!;
      if (entry.canPlaceOnWalls) continue;
      const bgRows = entry.backgroundTiles ?? 0;
      for (let dr = bgRows; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const tile = tileMap[item.row + dr]?.[item.col + dc];
          expect(tile, `${item.uid} (${item.type}) sits on wall/void at ${item.col + dc},${item.row + dr}`).not.toBe(TileType.WALL);
          expect(tile).not.toBe(TileType.VOID);
        }
      }
    }
  });

  it('makes every seat reachable from the spawn tile', () => {
    const { layout } = buildOfficeMap(def, theme);
    const tileMap = layoutToTileMap(layout);
    const blocked = getBlockedTiles(layout.furniture);
    const seats = layoutToSeats(layout.furniture);
    expect(seats.size).toBeGreaterThanOrEqual(6);

    const spawn = layout.spawnTile!;
    expect(
      tileMap[spawn.row][spawn.col],
      `spawn tile ${spawn.col},${spawn.row} must be floor`,
    ).not.toBe(TileType.WALL);
    expect(blocked.has(`${spawn.col},${spawn.row}`), 'spawn tile must not be blocked').toBe(false);

    // Flood fill over walkable tiles from spawn
    const reached = new Set<string>([`${spawn.col},${spawn.row}`]);
    const queue = [spawn];
    while (queue.length > 0) {
      const { col, row } = queue.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = col + dc;
        const nr = row + dr;
        const key = `${nc},${nr}`;
        if (reached.has(key)) continue;
        if (nc < 0 || nr < 0 || nc >= layout.cols || nr >= layout.rows) continue;
        const tile = tileMap[nr][nc];
        if (tile === TileType.WALL || tile === TileType.VOID) continue;
        if (blocked.has(key)) continue;
        reached.add(key);
        queue.push({ col: nc, row: nr });
      }
    }

    // The engine unblocks a character's own seat while pathing, so a seat is
    // reachable when at least one 4-neighbor of the seat tile is reached.
    for (const seat of seats.values()) {
      expect(tileMap[seat.seatRow]?.[seat.seatCol], `seat ${seat.uid} on wall`).not.toBe(TileType.WALL);
      const neighbors = [
        `${seat.seatCol + 1},${seat.seatRow}`,
        `${seat.seatCol - 1},${seat.seatRow}`,
        `${seat.seatCol},${seat.seatRow + 1}`,
        `${seat.seatCol},${seat.seatRow - 1}`,
      ];
      const reachable = reached.has(`${seat.seatCol},${seat.seatRow}`) || neighbors.some((key) => reached.has(key));
      expect(reachable, `seat ${seat.uid} at ${seat.seatCol},${seat.seatRow} unreachable from spawn`).toBe(true);
    }
  });

  it('builds under every theme', () => {
    for (const theme of MAP_THEMES) {
      const built = buildOfficeMap(def, theme);
      expect(built.layout.tiles.length).toBe(def.cols * def.rows);
      for (const color of built.layout.tileColors ?? []) {
        if (!color) continue;
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThan(360);
      }
    }
  });
});
