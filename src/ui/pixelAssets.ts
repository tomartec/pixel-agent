import { setFloorSprites } from "../office/floorTiles.js";
import { buildDynamicCatalog } from "../office/layout/furnitureCatalog.js";
import { setCharacterTemplates } from "../office/sprites/spriteData.js";
import type { OfficeLayout, SpriteData, TileType } from "../office/types.js";
import { setWallSprites } from "../office/wallTiles.js";
import { PLUGIN_ID } from "../manifest.js";

type CharacterDirectionSprites = {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
};

export type AssetIndex = {
  characters: string[];
  floors: string[];
  walls: string[];
  furniture: Array<{
    id: string;
    label: string;
    category: string;
    width: number;
    height: number;
    footprintW: number;
    footprintH: number;
    isDesk: boolean;
    groupId?: string;
    orientation?: string;
    state?: string;
    rotationScheme?: string;
    animationGroup?: string;
    frame?: number;
    canPlaceOnSurfaces?: boolean;
    backgroundTiles?: number;
    canPlaceOnWalls?: boolean;
    mirrorSide?: boolean;
    furniturePath: string;
  }>;
  layouts?: {
    office: string;
    boardroomKitchen: string;
  };
  defaultLayout: string;
};

type DecodedPng = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type LoadedPixelAssets = {
  layouts: {
    office: OfficeLayout;
    boardroomKitchen: OfficeLayout;
    combined: OfficeLayout;
  };
  cameraBounds: {
    office: CameraBounds;
    boardroomKitchen: CameraBounds;
    overflowOffice: CameraBounds;
    kitchen: CameraBounds;
    total: CameraBounds;
  };
};

export type CameraBounds = {
  col: number;
  row: number;
  cols: number;
  rows: number;
};

const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const CHAR_FRAMES_PER_ROW = 7;
const FLOOR_TILE_SIZE = 16;
const WALL_PIECE_WIDTH = 16;
const WALL_PIECE_HEIGHT = 32;
const WALL_GRID_COLS = 4;
const WALL_BITMASK_COUNT = 16;

let loadPromise: Promise<LoadedPixelAssets> | null = null;

/** @internal exported for tests/debugging */
export function trimLayoutToVisibleRoom(layout: OfficeLayout): OfficeLayout {
  const occupied: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (layout.tiles[row * layout.cols + col] !== 255) occupied.push({ col, row });
    }
  }

  if (occupied.length === 0) return layout;

  const minCol = Math.min(...occupied.map((tile) => tile.col));
  const maxCol = Math.max(...occupied.map((tile) => tile.col));
  const minRow = Math.min(...occupied.map((tile) => tile.row));
  const maxRow = Math.max(...occupied.map((tile) => tile.row));
  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;

  const tiles: TileType[] = [];
  const tileColors: OfficeLayout["tileColors"] = layout.tileColors ? [] : undefined;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const index = row * layout.cols + col;
      tiles.push(layout.tiles[index]);
      tileColors?.push(layout.tileColors?.[index] ?? null);
    }
  }

  return {
    ...layout,
    cols,
    rows,
    tiles,
    tileColors,
    furniture: layout.furniture.map((item) => ({
      ...item,
      col: item.col - minCol,
      row: item.row - minRow,
    })),
  };
}

/** Programmatically built staff kitchen room (Camera 4). */
function buildKitchenLayout(cols = 22, rows = 11): OfficeLayout {
  const wallColor = { h: 26, s: 14, b: -55, c: -45 };
  const floorColor = { h: 36, s: 24, b: 4, c: -16 };
  const tiles: TileType[] = [];
  const tileColors: NonNullable<OfficeLayout["tileColors"]> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isWall = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      tiles.push(isWall ? (0 as TileType) : (1 as TileType));
      tileColors.push(isWall ? wallColor : floorColor);
    }
  }

  const furniture: OfficeLayout["furniture"] = [
    // Counter along the top wall
    { uid: "kitchen-counter-1", type: "SMALL_TABLE_FRONT", col: 2, row: 1 },
    { uid: "kitchen-counter-2", type: "SMALL_TABLE_FRONT", col: 4, row: 1 },
    { uid: "kitchen-coffee", type: "COFFEE", col: 2, row: 2 },
    { uid: "kitchen-pot", type: "POT", col: 5, row: 2 },
    // Wall decorations
    { uid: "kitchen-clock", type: "CLOCK", col: 8, row: -1 },
    { uid: "kitchen-paint", type: "SMALL_PAINTING_2", col: 14, row: -1 },
    { uid: "kitchen-hang-plant", type: "HANGING_PLANT", col: 17, row: -1 },
    // Dining table with chairs
    { uid: "kitchen-table", type: "TABLE_FRONT", col: 9, row: 4 },
    { uid: "kitchen-chair-1", type: "WOODEN_CHAIR_SIDE", col: 8, row: 4 },
    { uid: "kitchen-chair-2", type: "WOODEN_CHAIR_SIDE", col: 8, row: 6 },
    { uid: "kitchen-chair-3", type: "WOODEN_CHAIR_SIDE:left", col: 12, row: 4 },
    { uid: "kitchen-chair-4", type: "WOODEN_CHAIR_SIDE:left", col: 12, row: 6 },
    // Break corner
    { uid: "kitchen-bench-1", type: "CUSHIONED_BENCH", col: 16, row: 2 },
    { uid: "kitchen-bench-2", type: "CUSHIONED_BENCH", col: 17, row: 2 },
    { uid: "kitchen-side-table", type: "SMALL_TABLE_SIDE", col: 20, row: 4 },
    { uid: "kitchen-cactus", type: "CACTUS", col: 20, row: 1 },
    { uid: "kitchen-large-plant", type: "LARGE_PLANT", col: 17, row: 7 },
    { uid: "kitchen-plant", type: "PLANT_2", col: 1, row: 1 },
    { uid: "kitchen-bin", type: "BIN", col: 1, row: 9 },
  ];

  return { version: 1, cols, rows, tiles, tileColors, furniture };
}

/** @internal exported for tests/debugging */
export /**
 * Replace leftover checker "entry" tiles (tile 9) inside a room with the
 * nearest regular floor tile + color, so room interiors stay uniform and
 * only the shared corridors use the checker pattern.
 */
function normalizeCheckerFloors(layout: OfficeLayout, checker: TileType = 9 as TileType): OfficeLayout {
  const tiles = [...layout.tiles];
  const tileColors = layout.tileColors ? [...layout.tileColors] : undefined;
  const index = (col: number, row: number) => row * layout.cols + col;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (layout.tiles[index(col, row)] !== checker) continue;
      // BFS outward for the nearest regular floor tile
      const queue = [{ col, row }];
      const seen = new Set([`${col},${row}`]);
      search: while (queue.length > 0) {
        const current = queue.shift()!;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = current.col + dc;
          const nr = current.row + dr;
          if (nc < 0 || nr < 0 || nc >= layout.cols || nr >= layout.rows) continue;
          const key = `${nc},${nr}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const tile = layout.tiles[index(nc, nr)];
          if (tile !== 0 && tile !== 255 && tile !== checker) {
            tiles[index(col, row)] = tile;
            if (tileColors) tileColors[index(col, row)] = layout.tileColors?.[index(nc, nr)] ?? null;
            break search;
          }
          queue.push({ col: nc, row: nr });
        }
      }
    }
  }

  return { ...layout, tiles, tileColors };
}

function combineLayouts(officeSource: OfficeLayout, boardroomKitchenSource: OfficeLayout): {
  layout: OfficeLayout;
  cameraBounds: LoadedPixelAssets["cameraBounds"];
} {
  const office = normalizeCheckerFloors(officeSource);
  // The boardroom layout uses tile 8 as a bright "door mat" between its two
  // rooms — normalize it to the neighboring room floor as well.
  const boardroomKitchen = normalizeCheckerFloors(boardroomKitchenSource, 8 as TileType);
  const overflowOffice = recolorLayout(office, { h: 145, s: 16, b: -8, c: -35 }, { h: 270, s: 18, b: -20, c: -45 });
  const kitchen = buildKitchenLayout();

  // One unified rectangular floor:
  //   outer wall + 1-tile walkway ring, rooms in a 2x2 grid around a
  //   cross-shaped corridor.
  //     office (Camera 1)         | boardroomKitchen (Camera 2)
  //     overflowOffice (Camera 3) | kitchen (Camera 4)
  const corridor = 3;
  const margin = 2; // outer wall (1) + walkway ring (1)
  const leftW = Math.max(office.cols, overflowOffice.cols);
  const rightW = Math.max(boardroomKitchen.cols, kitchen.cols);
  const topH = Math.max(office.rows, boardroomKitchen.rows);
  const bottomH = Math.max(overflowOffice.rows, kitchen.rows);
  const cols = margin + leftW + corridor + rightW + margin;
  const rows = margin + topH + corridor + bottomH + margin;
  const vHallCol = margin + leftW; // corridor cols: vHallCol .. vHallCol+2
  const hHallRow = margin + topH; // corridor rows: hHallRow .. hHallRow+2

  const wallColor = { h: 214, s: 30, b: -100, c: -55 };
  // Muted dark corridor: low brightness + strongly reduced contrast so the
  // checker pattern stays subtle and characters/names remain readable on it.
  const hallColor = { h: 215, s: 8, b: -44, c: -52 };
  const hallFloor = 9 as TileType;

  // Base: fill the whole rectangle with corridor floor, walled perimeter.
  const tiles = Array<TileType>(cols * rows).fill(hallFloor);
  const tileColors: NonNullable<OfficeLayout["tileColors"]> = Array(cols * rows).fill(hallColor);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
        const index = row * cols + col;
        tiles[index] = 0 as TileType;
        tileColors[index] = wallColor;
      }
    }
  }

  function copyLayout(source: OfficeLayout, offsetCol: number, offsetRow: number) {
    for (let row = 0; row < source.rows; row++) {
      for (let col = 0; col < source.cols; col++) {
        const tile = source.tiles[row * source.cols + col];
        if (tile === 255) continue; // keep corridor floor under void tiles
        const targetIndex = (row + offsetRow) * cols + col + offsetCol;
        tiles[targetIndex] = tile;
        tileColors[targetIndex] = source.tileColors?.[row * source.cols + col] ?? null;
      }
    }
  }

  // Rooms hug the central corridor (bottom-align top row, top-align bottom row).
  const officeAt = { col: margin, row: margin + topH - office.rows };
  const boardAt = { col: vHallCol + corridor + (rightW - boardroomKitchen.cols), row: margin + topH - boardroomKitchen.rows };
  const overflowAt = { col: margin, row: hHallRow + corridor };
  const kitchenAt = { col: vHallCol + corridor, row: hHallRow + corridor };

  copyLayout(office, officeAt.col, officeAt.row);
  copyLayout(boardroomKitchen, boardAt.col, boardAt.row);
  copyLayout(overflowOffice, overflowAt.col, overflowAt.row);
  copyLayout(kitchen, kitchenAt.col, kitchenAt.row);

  // Punch doorways: replace wall tiles with corridor floor (3 tiles wide).
  function punchDoor(centerCol: number, centerRow: number, horizontal: boolean) {
    for (let i = -1; i <= 1; i++) {
      const col = horizontal ? centerCol + i : centerCol;
      const row = horizontal ? centerRow : centerRow + i;
      const index = row * cols + col;
      tiles[index] = hallFloor;
      tileColors[index] = hallColor;
    }
  }

  // office: right wall -> vertical corridor, bottom wall -> horizontal corridor
  punchDoor(officeAt.col + office.cols - 1, officeAt.row + Math.floor(office.rows / 2), false);
  punchDoor(officeAt.col + Math.floor(office.cols / 2), officeAt.row + office.rows - 1, true);
  // boardroomKitchen: left wall + two bottom doors (boardroom and game room halves)
  punchDoor(boardAt.col, boardAt.row + Math.floor(boardroomKitchen.rows / 2), false);
  punchDoor(boardAt.col + Math.floor(boardroomKitchen.cols / 4), boardAt.row + boardroomKitchen.rows - 1, true);
  punchDoor(boardAt.col + Math.floor((3 * boardroomKitchen.cols) / 4), boardAt.row + boardroomKitchen.rows - 1, true);
  // overflowOffice: top wall + right wall
  punchDoor(overflowAt.col + Math.floor(overflowOffice.cols / 2), overflowAt.row, true);
  punchDoor(overflowAt.col + overflowOffice.cols - 1, overflowAt.row + Math.floor(overflowOffice.rows / 2), false);
  // kitchen: top wall + left wall
  punchDoor(kitchenAt.col + Math.floor(kitchen.cols / 2), kitchenAt.row, true);
  punchDoor(kitchenAt.col, kitchenAt.row + Math.floor(kitchen.rows / 2), false);

  const spawnTile = { col: vHallCol + 1, row: hHallRow + 1 };
  tileColors[spawnTile.row * cols + spawnTile.col] = { h: 204, s: 10, b: -42, c: -32 };

  function shiftFurniture(source: OfficeLayout, prefix: string, offset: { col: number; row: number }) {
    return source.furniture.map((item) => ({
      ...item,
      uid: `${prefix}-${item.uid}`,
      col: item.col + offset.col,
      row: item.row + offset.row,
    }));
  }

  return {
    layout: {
      version: 1,
      cols,
      rows,
      layoutRevision: 1,
      tiles,
      tileColors,
      spawnTile,
      furniture: [
        ...shiftFurniture(office, "camera1", officeAt),
        ...shiftFurniture(boardroomKitchen, "camera2", boardAt),
        ...shiftFurniture(overflowOffice, "camera3", overflowAt),
        ...shiftFurniture(kitchen, "camera4", kitchenAt),
      ],
    },
    cameraBounds: {
      office: { col: 0, row: 0, cols: vHallCol + 2, rows: hHallRow + 2 },
      boardroomKitchen: { col: vHallCol - 1, row: 0, cols: cols - vHallCol + 1, rows: hHallRow + 2 },
      overflowOffice: { col: 0, row: hHallRow - 1, cols: vHallCol + 2, rows: rows - hHallRow + 1 },
      kitchen: { col: vHallCol - 1, row: hHallRow - 1, cols: cols - vHallCol + 1, rows: rows - hHallRow + 1 },
      total: { col: 0, row: 0, cols, rows },
    },
  };
}

function recolorLayout(layout: OfficeLayout, floorColor: NonNullable<OfficeLayout["tileColors"]>[number], wallColor: NonNullable<OfficeLayout["tileColors"]>[number]): OfficeLayout {
  return {
    ...layout,
    tileColors: layout.tiles.map((tile, index) => {
      if (tile === 0) return wallColor;
      if (tile === 255) return null;
      return layout.tileColors?.[index] ? floorColor : floorColor;
    }),
    furniture: layout.furniture.map((item) => {
      if (!["DESK_FRONT", "TABLE_FRONT", "SMALL_TABLE_FRONT", "SMALL_TABLE_SIDE", "COFFEE_TABLE"].includes(item.type)) {
        return item;
      }
      return {
        ...item,
        color: { h: 150, s: 18, b: -10, c: -20 },
      };
    }),
  };
}

export function getPluginAssetBaseUrl(): string {
  const metaUrl = import.meta.url;
  if (metaUrl && !metaUrl.startsWith("blob:")) {
    return new URL("./assets/", metaUrl).toString();
  }

  const pluginMatch = window.location.pathname.match(/\/_plugins\/[^/]+\/ui\//);
  if (pluginMatch) return `${pluginMatch[0]}assets/`;

  return `/_plugins/${PLUGIN_ID}/ui/assets/`;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < 2) return "";
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}${a === 255 ? "" : a.toString(16).padStart(2, "0")}`;
}

function pixelAt(png: DecodedPng, x: number, y: number): string {
  const idx = (y * png.width + x) * 4;
  return rgbaToHex(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]);
}

function readSprite(png: DecodedPng, width: number, height: number, offsetX = 0, offsetY = 0): SpriteData {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => pixelAt(png, offsetX + x, offsetY + y)),
  );
}

async function decodePng(url: string): Promise<DecodedPng> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not decode PNG");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: imageData.data };
}

async function decodeCharacters(baseUrl: string, index: AssetIndex): Promise<CharacterDirectionSprites[]> {
  return Promise.all(index.characters.map(async (path) => {
    const png = await decodePng(`${baseUrl}${path}`);
    return {
      down: Array.from({ length: CHAR_FRAMES_PER_ROW }, (_, frame) =>
        readSprite(png, CHAR_FRAME_W, CHAR_FRAME_H, frame * CHAR_FRAME_W, 0),
      ),
      up: Array.from({ length: CHAR_FRAMES_PER_ROW }, (_, frame) =>
        readSprite(png, CHAR_FRAME_W, CHAR_FRAME_H, frame * CHAR_FRAME_W, CHAR_FRAME_H),
      ),
      right: Array.from({ length: CHAR_FRAMES_PER_ROW }, (_, frame) =>
        readSprite(png, CHAR_FRAME_W, CHAR_FRAME_H, frame * CHAR_FRAME_W, CHAR_FRAME_H * 2),
      ),
    };
  }));
}

async function decodeFloors(baseUrl: string, index: AssetIndex): Promise<SpriteData[]> {
  return Promise.all(index.floors.map(async (path) => readSprite(await decodePng(`${baseUrl}${path}`), FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)));
}

async function decodeWalls(baseUrl: string, index: AssetIndex): Promise<SpriteData[][]> {
  return Promise.all(index.walls.map(async (path) => {
    const png = await decodePng(`${baseUrl}${path}`);
    return Array.from({ length: WALL_BITMASK_COUNT }, (_, mask) =>
      readSprite(
        png,
        WALL_PIECE_WIDTH,
        WALL_PIECE_HEIGHT,
        (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH,
        Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT,
      ),
    );
  }));
}

async function decodeFurniture(baseUrl: string, index: AssetIndex): Promise<Record<string, SpriteData>> {
  const entries = await Promise.all(index.furniture.map(async (asset) => {
    const png = await decodePng(`${baseUrl}${asset.furniturePath}`);
    return [asset.id, readSprite(png, asset.width, asset.height)] as const;
  }));
  return Object.fromEntries(entries);
}

export function loadPixelAssets(): Promise<LoadedPixelAssets> {
  loadPromise ??= (async () => {
    const baseUrl = getPluginAssetBaseUrl();
    const indexUrl = `${baseUrl}agent-pixels-assets.json`;
    const index = (await fetch(indexUrl).then((res) => res.json())) as AssetIndex;

    const layoutPaths = index.layouts ?? {
      office: index.defaultLayout,
      boardroomKitchen: index.defaultLayout,
    };

    const [characters, floors, walls, furnitureSprites, officeLayout, boardroomKitchenLayout] = await Promise.all([
      decodeCharacters(baseUrl, index),
      decodeFloors(baseUrl, index),
      decodeWalls(baseUrl, index),
      decodeFurniture(baseUrl, index),
      fetch(`${baseUrl}${layoutPaths.office}`)
        .then((res) => res.json())
        .then(trimLayoutToVisibleRoom) as Promise<OfficeLayout>,
      fetch(`${baseUrl}${layoutPaths.boardroomKitchen}`)
        .then((res) => res.json())
        .then(trimLayoutToVisibleRoom) as Promise<OfficeLayout>,
    ]);

    setCharacterTemplates(characters);
    setFloorSprites(floors);
    setWallSprites(walls);
    buildDynamicCatalog({ catalog: index.furniture, sprites: furnitureSprites });

    const combined = combineLayouts(officeLayout, boardroomKitchenLayout);

    return {
      layouts: {
        office: officeLayout,
        boardroomKitchen: boardroomKitchenLayout,
        combined: combined.layout,
      },
      cameraBounds: combined.cameraBounds,
    };
  })();

  return loadPromise;
}
