import type { ColorValue } from '../../components/ui/types.js';
import type { OfficeLayout, PlacedFurniture, TileType as TileTypeVal } from '../types.js';
import { TileType } from '../types.js';
import type { MapTheme, RoomRole } from './themes.js';

export type Rect = { col: number; row: number; cols: number; rows: number };

export type MapFurnitureItem = {
  type: string;
  col: number;
  row: number;
  color?: ColorValue;
};

export type DoorDef = {
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Offset in tiles from the rect's top-left corner along the wall */
  at: number;
  width?: number;
};

export type RoomDef = {
  id: string;
  role: RoomRole;
  label: string;
  /** Absolute tile rect. Walled rooms include their wall ring. */
  rect: Rect;
  /** Open zone: colored floor without walls (no doors needed) */
  open?: boolean;
  floorTile?: TileTypeVal;
  doors?: DoorDef[];
  /** Room-local furniture (origin = interior top-left). Omit to auto-furnish by role. */
  furniture?: MapFurnitureItem[];
};

export type OfficeMapDef = {
  id: string;
  label: string;
  cols: number;
  rows: number;
  corridorRole?: RoomRole;
  corridorTile?: TileTypeVal;
  rooms: RoomDef[];
  /** Extra furniture in absolute map coordinates (corridor/open floor) */
  furniture?: MapFurnitureItem[];
  spawnTile: { col: number; row: number };
};

export type BuiltRoom = {
  id: string;
  role: RoomRole;
  label: string;
  rect: Rect;
  open: boolean;
};

export type MapCamera = {
  id: string;
  label: string;
  bounds: Rect;
};

export type BuiltOfficeMap = {
  layout: OfficeLayout;
  cameras: MapCamera[];
  rooms: BuiltRoom[];
};

// ── Furniture prefabs (room-local coordinates) ──────────────────

/** Front-facing workstation: desk + PC + bench seat below */
function workstation(c: number, r: number, pc = 'PC_FRONT_ON_1'): MapFurnitureItem[] {
  return [
    { type: 'DESK_FRONT', col: c, row: r },
    { type: pc, col: c + 1, row: r },
    { type: 'CUSHIONED_BENCH', col: c + 1, row: r + 2 },
  ];
}

/** Meeting table with 4 side chairs. Occupies cols c-1..c+3, rows r..r+3 */
function meetingTable(c: number, r: number): MapFurnitureItem[] {
  return [
    { type: 'TABLE_FRONT', col: c, row: r },
    { type: 'WOODEN_CHAIR_SIDE', col: c - 1, row: r },
    { type: 'WOODEN_CHAIR_SIDE', col: c - 1, row: r + 2 },
    { type: 'WOODEN_CHAIR_SIDE:left', col: c + 3, row: r },
    { type: 'WOODEN_CHAIR_SIDE:left', col: c + 3, row: r + 2 },
  ];
}

/** Boardroom table with 6 chairs. Occupies cols c-1..c+3, rows r-1..r+5 */
function boardroom(c: number, r: number): MapFurnitureItem[] {
  return [
    { type: 'BOARDROOM_TABLE', col: c, row: r },
    { type: 'CUSHIONED_CHAIR_FRONT', col: c + 1, row: r - 1 },
    { type: 'CUSHIONED_CHAIR_BACK', col: c + 1, row: r + 5 },
    { type: 'CUSHIONED_CHAIR_SIDE', col: c - 1, row: r + 1 },
    { type: 'CUSHIONED_CHAIR_SIDE', col: c - 1, row: r + 3 },
    { type: 'CUSHIONED_CHAIR_SIDE:left', col: c + 3, row: r + 1 },
    { type: 'CUSHIONED_CHAIR_SIDE:left', col: c + 3, row: r + 3 },
  ];
}

/** Sofa square around a coffee table. Occupies cols c-1..c+2, rows r-1..r+2 */
function sofaSet(c: number, r: number): MapFurnitureItem[] {
  return [
    { type: 'COFFEE_TABLE', col: c, row: r },
    { type: 'SOFA_FRONT', col: c, row: r - 1 },
    { type: 'SOFA_BACK', col: c, row: r + 2 },
    { type: 'SOFA_SIDE', col: c - 1, row: r },
    { type: 'SOFA_SIDE:left', col: c + 2, row: r },
  ];
}

/** Reception desk: bench above desk so the receptionist faces the viewer */
function reception(c: number, r: number): MapFurnitureItem[] {
  return [
    { type: 'DESK_FRONT', col: c, row: r },
    { type: 'CUSHIONED_BENCH', col: c + 1, row: r - 1 },
  ];
}

/** Wall-mounted décor on the room's top wall (walled rooms only) */
function wallDecor(type: string, c: number): MapFurnitureItem {
  return { type, col: c, row: -2 };
}

/** Default furniture per room role, sized to the interior (w × h) */
export function roleFurniture(role: RoomRole, w: number, h: number, walled: boolean): MapFurnitureItem[] {
  const items: MapFurnitureItem[] = [];
  const deco = (type: string, c: number) => {
    if (walled && c >= 0 && c + 2 <= w) items.push(wallDecor(type, c));
  };

  switch (role) {
    case 'product':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1));
      if (w >= 10 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_ON_1'));
      deco('WHITEBOARD', 1);
      deco('SMALL_PAINTING', 4);
      if (w >= 8 && h >= 6) items.push({ type: 'SMALL_TABLE_FRONT', col: w - 3, row: h - 3 });
      if (w >= 7) items.push({ type: 'PLANT', col: w - 2, row: 1 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      break;
    case 'engineering':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1, 'PC_FRONT_ON_2'));
      if (w >= 9 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_ON_1'));
      if (w >= 13 && h >= 4) items.push(...workstation(9, 1, 'PC_FRONT_ON_3'));
      deco('WHITEBOARD', 1);
      deco('DOUBLE_BOOKSHELF', 4);
      deco('CLOCK', 7);
      if (h >= 7) items.push({ type: 'PLANT_2', col: w - 2, row: h - 3 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      if (w >= 6 && h >= 6) items.push({ type: 'CACTUS', col: 1, row: h - 2 });
      break;
    case 'design':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1, 'PC_FRONT_ON_3'));
      if (w >= 10 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_ON_1'));
      deco('LARGE_PAINTING', 1);
      deco('SMALL_PAINTING', 4);
      if (w >= 7 && h >= 6) items.push({ type: 'CUSHIONED_CHAIR_FRONT', col: w - 2, row: h - 3 });
      if (w >= 7) items.push({ type: 'PLANT_2', col: w - 2, row: 1 });
      if (w >= 8 && h >= 6) items.push({ type: 'SMALL_TABLE_SIDE', col: 0, row: h - 3 });
      break;
    case 'marketing':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1));
      if (w >= 10 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_OFF'));
      deco('WHITEBOARD', Math.max(1, w - 4));
      deco('SMALL_PAINTING_2', 1);
      if (w >= 7 && h >= 6) items.push({ type: 'PLANT', col: w - 2, row: h - 3 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      break;
    case 'support':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1, 'PC_FRONT_ON_1'));
      if (w >= 9 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_ON_2'));
      if (w >= 13 && h >= 4) items.push(...workstation(9, 1, 'PC_FRONT_ON_3'));
      deco('SMALL_PAINTING_2', 1);
      deco('CLOCK', 4);
      if (h >= 7) items.push({ type: 'PLANT', col: w - 2, row: h - 3 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      break;
    case 'hr':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1, 'PC_FRONT_OFF'));
      deco('CLOCK', 1);
      deco('SMALL_PAINTING', 3);
      deco('DOUBLE_BOOKSHELF', 5);
      if (w >= 7 && h >= 6) items.push({ type: 'SMALL_TABLE_SIDE', col: w - 2, row: 1 });
      if (w >= 7) items.push({ type: 'PLANT', col: w - 2, row: h - 2 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      break;
    case 'data':
      if (w >= 5 && h >= 4) items.push(...workstation(1, 1, 'PC_FRONT_ON_2'));
      if (w >= 10 && h >= 4) items.push(...workstation(5, 1, 'PC_FRONT_ON_3'));
      deco('SMALL_PAINTING', 1);
      deco('WHITEBOARD', 3);
      if (w >= 7) items.push({ type: 'CACTUS', col: w - 2, row: 1 });
      if (h >= 5) items.push({ type: 'BIN', col: 0, row: h - 1 });
      break;
    case 'meeting':
      if (w >= 7 && h >= 9) {
        items.push(...boardroom(2, 2));
      } else if (w >= 6 && h >= 5) {
        items.push(...meetingTable(2, 1));
      }
      deco('WHITEBOARD', 1);
      deco('CLOCK', 4);
      if (w >= 8) items.push({ type: 'PLANT', col: w - 2, row: h - 3 });
      break;
    case 'pantry':
      items.push(
        { type: 'SMALL_TABLE_FRONT', col: 0, row: 0 },
        { type: 'SMALL_TABLE_FRONT', col: 2, row: 0 },
        { type: 'COFFEE', col: 0, row: 1 },
      );
      if (w >= 6) items.push({ type: 'POT', col: 4, row: 0 });
      if (w >= 8) {
        items.push(
          { type: 'SMALL_TABLE_FRONT', col: 5, row: 0 },
          { type: 'COFFEE', col: 6, row: 1 },
        );
      }
      if (w >= 10 && h >= 7) items.push(...meetingTable(w - 5, 2));
      if (w >= 10 && h >= 6) {
        items.push(
          { type: 'CUSHIONED_BENCH', col: 1, row: h - 2 },
          { type: 'CUSHIONED_BENCH', col: 2, row: h - 2 },
          { type: 'SMALL_TABLE_SIDE', col: 3, row: h - 3 },
        );
      }
      items.push({ type: 'BIN', col: w - 1, row: h - 1 });
      if (h >= 5) items.push({ type: 'PLANT_2', col: 0, row: h - 3 });
      deco('SMALL_PAINTING_2', 1);
      deco('CLOCK', 4);
      break;
    case 'server':
      items.push(
        { type: 'SMALL_TABLE_FRONT', col: 0, row: 0 },
        { type: 'PC_SIDE', col: 0, row: 1 },
      );
      if (w >= 5) {
        items.push(
          { type: 'SMALL_TABLE_FRONT', col: 2, row: 0 },
          { type: 'PC_SIDE:left', col: 3, row: 1 },
        );
      }
      if (h >= 7) {
        items.push(
          { type: 'SMALL_TABLE_FRONT', col: 0, row: 3 },
          { type: 'PC_SIDE', col: 0, row: 4 },
        );
        if (w >= 5) {
          items.push(
            { type: 'SMALL_TABLE_FRONT', col: 2, row: 3 },
            { type: 'PC_SIDE:left', col: 3, row: 4 },
          );
        }
      }
      items.push({ type: 'BIN', col: w - 1, row: h - 1 });
      if (w >= 6) items.push({ type: 'CACTUS', col: w - 2, row: 0 });
      break;
    case 'lounge':
      if (w >= 6 && h >= 6) items.push(...sofaSet(2, 2));
      if (w >= 6 && h >= 6) items.push({ type: 'COFFEE', col: 2, row: 2 });
      if (w >= 9 && h >= 4) items.push({ type: 'ARCADE_MACHINE', col: w - 3, row: 0 });
      if (w >= 14 && h >= 8) items.push({ type: 'POOL_TABLE', col: w - 8, row: h - 4 });
      if (w >= 8 && h >= 7) items.push({ type: 'SMALL_TABLE_SIDE', col: 0, row: 0 });
      items.push({ type: 'PLANT', col: 0, row: h - 3 });
      break;
    case 'focus':
      if (w >= 4 && h >= 4) {
        items.push(
          { type: 'SMALL_TABLE_FRONT', col: 1, row: 1 },
          { type: 'CUSHIONED_CHAIR_SIDE', col: 0, row: 1 },
        );
      }
      deco('SMALL_PAINTING', 1);
      items.push({ type: 'PLANT', col: w - 2, row: h - 3 });
      break;
    case 'content':
      deco('LARGE_PAINTING', 1);
      deco('SMALL_PAINTING_2', 4);
      if (w >= 6 && h >= 5) {
        items.push(
          { type: 'SMALL_TABLE_SIDE', col: w - 2, row: 1 },
          { type: 'SOFA_FRONT', col: 1, row: h - 2 },
          { type: 'COFFEE_TABLE', col: 1, row: h - 4 },
          { type: 'POT', col: w - 2, row: h - 1 },
        );
      }
      if (w >= 9 && h >= 6) items.push({ type: 'CUSHIONED_CHAIR_FRONT', col: 4, row: h - 4 });
      if (w >= 9) items.push({ type: 'PLANT_2', col: w - 2, row: h - 3 });
      break;
    case 'hub': {
      const mid = Math.floor(w / 2);
      if (w >= 8 && h >= 8) items.push(...reception(mid - 1, h - 3));
      if (w >= 8 && h >= 8) items.push(...sofaSet(2, 2));
      if (w >= 13 && h >= 8) {
        items.push(
          { type: 'SOFA_FRONT', col: w - 4, row: 2 },
          { type: 'COFFEE_TABLE', col: w - 4, row: 3 },
        );
      }
      if (w >= 12 && h >= 10) {
        items.push(
          { type: 'WOODEN_BENCH', col: mid - 3, row: h - 2 },
          { type: 'WOODEN_BENCH', col: mid + 2, row: h - 2 },
          { type: 'LARGE_PLANT', col: 1, row: h - 4 },
          { type: 'LARGE_PLANT', col: w - 4, row: h - 4 },
        );
      }
      items.push(
        { type: 'PLANT', col: 0, row: 0 },
        { type: 'PLANT_2', col: w - 2, row: h - 3 },
      );
      break;
    }
    case 'courtyard': {
      const mid = Math.floor(w / 2);
      items.push(
        { type: 'LARGE_PLANT', col: 1, row: 1 },
        { type: 'LARGE_PLANT', col: w - 3, row: 1 },
        { type: 'POT', col: 1, row: h - 2 },
        { type: 'POT', col: w - 2, row: h - 2 },
      );
      if (h >= 12) {
        items.push(
          { type: 'WOODEN_BENCH', col: 2, row: Math.floor(h / 2) },
          { type: 'WOODEN_BENCH', col: w - 3, row: Math.floor(h / 2) },
          { type: 'LARGE_PLANT', col: mid - 1, row: Math.floor(h / 2) - 2 },
        );
      }
      if (h >= 16) {
        items.push(
          { type: 'WOODEN_BENCH', col: 2, row: 4 },
          { type: 'WOODEN_BENCH', col: w - 3, row: 4 },
          { type: 'POT', col: mid, row: 2 },
        );
      }
      if (w >= 8 && h >= 10) items.push(...reception(mid - 1, h - 3));
      break;
    }
    case 'corridor':
      break;
  }
  return items;
}

// ── Map builder ─────────────────────────────────────────────────

const DESK_ACCENT_TYPES = new Set([
  'DESK_FRONT',
  'DESK_SIDE',
  'TABLE_FRONT',
  'SMALL_TABLE_FRONT',
  'SMALL_TABLE_SIDE',
  'COFFEE_TABLE',
  'BOARDROOM_TABLE',
]);

export function buildOfficeMap(def: OfficeMapDef, theme: MapTheme): BuiltOfficeMap {
  const { cols, rows } = def;
  const corridorTile = def.corridorTile ?? (9 as TileTypeVal);
  const corridorColor = theme.roles[def.corridorRole ?? 'corridor'];
  const wallColor = theme.wall;

  const tiles = Array<TileTypeVal>(cols * rows).fill(corridorTile);
  const tileColors: NonNullable<OfficeLayout['tileColors']> = Array(cols * rows).fill(corridorColor);
  const index = (col: number, row: number) => row * cols + col;

  const setTile = (col: number, row: number, tile: TileTypeVal, color: ColorValue | null) => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    tiles[index(col, row)] = tile;
    tileColors[index(col, row)] = color;
  };

  // Outer border wall
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
        setTile(col, row, TileType.WALL, wallColor);
      }
    }
  }

  // Rooms: floors + walls
  for (const room of def.rooms) {
    const { rect } = room;
    const floorColor = theme.roles[room.role];
    const floorTile = room.floorTile ?? ((room.open ? 3 : 1) as TileTypeVal);
    for (let r = 0; r < rect.rows; r++) {
      for (let c = 0; c < rect.cols; c++) {
        const isWall =
          !room.open && (r === 0 || r === rect.rows - 1 || c === 0 || c === rect.cols - 1);
        setTile(
          rect.col + c,
          rect.row + r,
          isWall ? TileType.WALL : floorTile,
          isWall ? wallColor : floorColor,
        );
      }
    }
  }

  // Doors (punched after every wall is drawn so shared walls work)
  for (const room of def.rooms) {
    for (const door of room.doors ?? []) {
      const width = door.width ?? 2;
      const { rect } = room;
      const floorColor = theme.roles[room.role];
      const floorTile = room.floorTile ?? (1 as TileTypeVal);
      for (let i = 0; i < width; i++) {
        let col: number;
        let row: number;
        if (door.side === 'top' || door.side === 'bottom') {
          col = rect.col + door.at + i;
          row = door.side === 'top' ? rect.row : rect.row + rect.rows - 1;
        } else {
          col = door.side === 'left' ? rect.col : rect.col + rect.cols - 1;
          row = rect.row + door.at + i;
        }
        setTile(col, row, floorTile, floorColor);
      }
    }
  }

  // Furniture
  const furniture: PlacedFurniture[] = [];
  let uidCounter = 0;
  const pushItem = (item: MapFurnitureItem, originCol: number, originRow: number, scope: string) => {
    const accent =
      item.color ?? (theme.deskAccent && DESK_ACCENT_TYPES.has(item.type) ? theme.deskAccent : undefined);
    furniture.push({
      uid: `${def.id}-${scope}-${uidCounter++}`,
      type: item.type,
      col: originCol + item.col,
      row: originRow + item.row,
      ...(accent ? { color: accent } : {}),
    });
  };

  for (const room of def.rooms) {
    const inset = room.open ? 0 : 1;
    const originCol = room.rect.col + inset;
    const originRow = room.rect.row + inset;
    const w = room.rect.cols - inset * 2;
    const h = room.rect.rows - inset * 2;
    const items = room.furniture ?? roleFurniture(room.role, w, h, !room.open);
    for (const item of items) pushItem(item, originCol, originRow, room.id);
  }
  for (const item of def.furniture ?? []) pushItem(item, 0, 0, 'floor');

  // Cameras: 2×2 quadrants + total, labeled by the rooms they contain
  const halfC = Math.floor(cols / 2);
  const halfR = Math.floor(rows / 2);
  const quads: Array<{ id: string; bounds: Rect }> = [
    { id: 'cam1', bounds: { col: 0, row: 0, cols: halfC + 1, rows: halfR + 1 } },
    { id: 'cam2', bounds: { col: halfC - 1, row: 0, cols: cols - halfC + 1, rows: halfR + 1 } },
    { id: 'cam3', bounds: { col: 0, row: halfR - 1, cols: halfC + 1, rows: rows - halfR + 1 } },
    { id: 'cam4', bounds: { col: halfC - 1, row: halfR - 1, cols: cols - halfC + 1, rows: rows - halfR + 1 } },
  ];
  const cameras: MapCamera[] = quads.map((quad) => {
    const contained = def.rooms.filter((room) => {
      const cx = room.rect.col + room.rect.cols / 2;
      const cy = room.rect.row + room.rect.rows / 2;
      return (
        cx >= quad.bounds.col &&
        cx < quad.bounds.col + quad.bounds.cols &&
        cy >= quad.bounds.row &&
        cy < quad.bounds.row + quad.bounds.rows
      );
    });
    const label = contained.slice(0, 2).map((room) => room.label).join(' + ') || 'Open Floor';
    return { id: quad.id, label, bounds: quad.bounds };
  });
  cameras.push({ id: 'total', label: 'Total · All Rooms', bounds: { col: 0, row: 0, cols, rows } });

  return {
    layout: {
      version: 1,
      cols,
      rows,
      layoutRevision: 1,
      tiles,
      tileColors,
      spawnTile: def.spawnTile,
      furniture,
    },
    cameras,
    rooms: def.rooms.map((room) => ({
      id: room.id,
      role: room.role,
      label: room.label,
      rect: room.rect,
      open: !!room.open,
    })),
  };
}
