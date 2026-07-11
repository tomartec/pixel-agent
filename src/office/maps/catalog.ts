import type { TileType as TileTypeVal } from '../types.js';
import type { MapFurnitureItem, OfficeMapDef } from './builder.js';

/** Shorthand helpers for map definitions */
const rect = (col: number, row: number, cols: number, rows: number) => ({ col, row, cols, rows });

const centerTable = (c: number, r: number): MapFurnitureItem[] => [
  { type: 'TABLE_FRONT', col: c, row: r },
  { type: 'WOODEN_CHAIR_SIDE', col: c - 1, row: r },
  { type: 'WOODEN_CHAIR_SIDE', col: c - 1, row: r + 2 },
  { type: 'WOODEN_CHAIR_SIDE:left', col: c + 3, row: r },
  { type: 'WOODEN_CHAIR_SIDE:left', col: c + 3, row: r + 2 },
];

const sofaCluster = (c: number, r: number): MapFurnitureItem[] => [
  { type: 'COFFEE_TABLE', col: c, row: r },
  { type: 'SOFA_FRONT', col: c, row: r - 1 },
  { type: 'SOFA_BACK', col: c, row: r + 2 },
  { type: 'SOFA_SIDE', col: c - 1, row: r },
  { type: 'SOFA_SIDE:left', col: c + 2, row: r },
];

const workRow = (c: number, r: number, pc = 'PC_FRONT_ON_1'): MapFurnitureItem[] => [
  { type: 'DESK_FRONT', col: c, row: r },
  { type: pc, col: c + 1, row: r },
  { type: 'CUSHIONED_BENCH', col: c + 1, row: r + 2 },
];

/** Option 1 — Central Hub: rooms ring a central reception hub */
const hubCentral: OfficeMapDef = {
  id: 'hub-central',
  label: 'Central Hub',
  cols: 46,
  rows: 36,
  spawnTile: { col: 22, row: 17 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product & Strategy', rect: rect(1, 1, 12, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'marketing', role: 'marketing', label: 'Marketing & Sales', rect: rect(1, 8, 12, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(1, 15, 12, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'data', role: 'data', label: 'Data & QA', rect: rect(1, 22, 12, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(15, 1, 16, 8), doors: [{ side: 'bottom', at: 7, width: 3 }] },
    { id: 'design', role: 'design', label: 'Design Studio', rect: rect(33, 1, 12, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'support', role: 'support', label: 'Customer Support', rect: rect(33, 8, 12, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'hr', role: 'hr', label: 'HR / Finance / Admin', rect: rect(33, 15, 12, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'server', role: 'server', label: 'Server / Storage', rect: rect(33, 22, 12, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(15, 27, 16, 8), doors: [{ side: 'top', at: 7, width: 3 }, { side: 'left', at: 3 }, { side: 'right', at: 3 }] },
    { id: 'hub', role: 'hub', label: 'Hub / Reception / Lounge', rect: rect(15, 9, 16, 18), open: true, floorTile: 1 as TileTypeVal },
  ],
};

/** Option 2 — Open Studio: open colored zones, few walls */
const openStudio: OfficeMapDef = {
  id: 'open-studio',
  label: 'Open Studio',
  cols: 46,
  rows: 36,
  corridorRole: 'hub',
  corridorTile: 1 as TileTypeVal,
  spawnTile: { col: 17, row: 19 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product', rect: rect(2, 2, 12, 9), open: true },
    { id: 'design', role: 'design', label: 'Design', rect: rect(2, 13, 12, 9), open: true },
    { id: 'support', role: 'support', label: 'Support', rect: rect(2, 24, 12, 9), open: true },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(30, 2, 14, 10), open: true },
    { id: 'marketing', role: 'marketing', label: 'Marketing', rect: rect(30, 14, 14, 9), open: true },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(16, 23, 13, 11), doors: [{ side: 'top', at: 5 }] },
    { id: 'focus', role: 'focus', label: 'Focus Booth', rect: rect(30, 25, 6, 8), doors: [{ side: 'top', at: 2 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(37, 25, 8, 10), open: true },
  ],
  furniture: [
    ...centerTable(20, 10),
    { type: 'LARGE_PLANT', col: 16, row: 16 },
    { type: 'LARGE_PLANT', col: 26, row: 16 },
    { type: 'POT', col: 15, row: 3 },
  ],
};

/** Option 3 — The Boulevard: rooms flank a long central boulevard */
const boulevard: OfficeMapDef = {
  id: 'boulevard',
  label: 'The Boulevard',
  cols: 46,
  rows: 36,
  spawnTile: { col: 23, row: 14 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product & Strategy', rect: rect(1, 1, 14, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'marketing', role: 'marketing', label: 'Marketing & Sales', rect: rect(1, 8, 14, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(1, 15, 14, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'data', role: 'data', label: 'Data & QA', rect: rect(1, 22, 14, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(31, 1, 14, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'design', role: 'design', label: 'Design Studio', rect: rect(31, 8, 14, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'support', role: 'support', label: 'Customer Support', rect: rect(31, 15, 14, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'hr', role: 'hr', label: 'HR / Admin', rect: rect(31, 22, 14, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(15, 27, 16, 8), doors: [{ side: 'top', at: 7, width: 3 }, { side: 'left', at: 3 }, { side: 'right', at: 3 }] },
    {
      id: 'boulevard',
      role: 'hub',
      label: 'The Boulevard',
      rect: rect(15, 1, 16, 26),
      open: true,
      floorTile: 1 as TileTypeVal,
      furniture: [
        { type: 'LARGE_PLANT', col: 1, row: 2 },
        { type: 'LARGE_PLANT', col: 13, row: 2 },
        { type: 'LARGE_PLANT', col: 1, row: 12 },
        { type: 'LARGE_PLANT', col: 13, row: 12 },
        { type: 'LARGE_PLANT', col: 1, row: 20 },
        { type: 'LARGE_PLANT', col: 13, row: 20 },
        ...sofaCluster(7, 8),
        { type: 'SOFA_SIDE', col: 6, row: 16 },
        { type: 'COFFEE_TABLE', col: 7, row: 16 },
        { type: 'SOFA_SIDE:left', col: 9, row: 16 },
        { type: 'POT', col: 7, row: 22 },
      ],
    },
  ],
};

/** Option 4 — Campus Mini: rooms around a garden courtyard */
const campusMini: OfficeMapDef = {
  id: 'campus-mini',
  label: 'Campus Mini',
  cols: 46,
  rows: 36,
  spawnTile: { col: 20, row: 18 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product & Strategy', rect: rect(1, 1, 14, 9), doors: [{ side: 'bottom', at: 6 }] },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(16, 1, 14, 9), doors: [{ side: 'bottom', at: 6 }] },
    { id: 'design', role: 'design', label: 'Design + Marketing', rect: rect(31, 1, 14, 9), doors: [{ side: 'bottom', at: 6 }] },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(1, 12, 14, 8), doors: [{ side: 'right', at: 3 }] },
    { id: 'support', role: 'support', label: 'Support + Ops', rect: rect(31, 12, 14, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(1, 21, 14, 14), doors: [{ side: 'right', at: 4 }] },
    { id: 'server', role: 'server', label: 'Server / Storage', rect: rect(31, 21, 14, 14), doors: [{ side: 'left', at: 4 }] },
    { id: 'courtyard', role: 'courtyard', label: 'Welcome Hub / Courtyard', rect: rect(16, 12, 14, 23), open: true },
  ],
};

/** Option 5 — Team Pods: open pods on a shared floor */
const teamPods: OfficeMapDef = {
  id: 'team-pods',
  label: 'Team Pods',
  cols: 46,
  rows: 36,
  corridorTile: 1 as TileTypeVal,
  spawnTile: { col: 18, row: 20 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product + Design', rect: rect(3, 2, 12, 8), open: true },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(29, 2, 14, 8), open: true },
    { id: 'marketing', role: 'marketing', label: 'Growth / Sales', rect: rect(3, 12, 12, 8), open: true },
    { id: 'support', role: 'support', label: 'Support / Ops', rect: rect(29, 12, 14, 8), open: true },
    { id: 'data', role: 'data', label: 'Data / QA', rect: rect(29, 21, 14, 6), open: true },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(1, 22, 13, 12), doors: [{ side: 'right', at: 1 }] },
    { id: 'server', role: 'server', label: 'Server', rect: rect(14, 26, 7, 8), doors: [{ side: 'top', at: 2 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(22, 28, 15, 7), open: true },
  ],
  furniture: [
    { type: 'LARGE_PLANT', col: 17, row: 7 },
    { type: 'LARGE_PLANT', col: 27, row: 7 },
    ...sofaCluster(23, 17),
  ],
};

/** Option 6 — Creative Loft: one big creative loft with zones */
const creativeLoft: OfficeMapDef = {
  id: 'creative-loft',
  label: 'Creative Loft',
  cols: 46,
  rows: 36,
  corridorRole: 'lounge',
  corridorTile: 2 as TileTypeVal,
  spawnTile: { col: 16, row: 22 },
  rooms: [
    { id: 'marketing', role: 'marketing', label: 'Marketing Area', rect: rect(2, 2, 13, 9), open: true },
    { id: 'design', role: 'design', label: 'Design Area', rect: rect(2, 13, 13, 9), open: true },
    { id: 'engineering', role: 'engineering', label: 'Engineering Nook', rect: rect(1, 24, 13, 11), doors: [{ side: 'top', at: 9 }] },
    {
      id: 'studio',
      role: 'hub',
      label: 'Open Studio',
      rect: rect(17, 10, 14, 11),
      open: true,
      furniture: [...centerTable(3, 1), ...centerTable(9, 6)],
    },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(32, 1, 13, 11), doors: [{ side: 'bottom', at: 5 }, { side: 'left', at: 4 }] },
    { id: 'content', role: 'content', label: 'Content Corner', rect: rect(32, 13, 13, 9), open: true },
    { id: 'lounge', role: 'lounge', label: 'Lounge', rect: rect(15, 25, 16, 10), open: true },
    { id: 'pantry', role: 'pantry', label: 'Pantry', rect: rect(32, 24, 13, 11), doors: [{ side: 'top', at: 5 }] },
  ],
  furniture: [
    { type: 'LARGE_PLANT', col: 16, row: 4 },
    { type: 'LARGE_PLANT', col: 29, row: 4 },
    { type: 'BIN', col: 15, row: 8 },
  ],
};

/** Option 7 — Hybrid Office: open work zone + collaboration hub + private rooms */
const hybridOffice: OfficeMapDef = {
  id: 'hybrid-office',
  label: 'Hybrid Office',
  cols: 46,
  rows: 36,
  spawnTile: { col: 22, row: 12 },
  rooms: [
    { id: 'product', role: 'product', label: 'Product / Design', rect: rect(1, 1, 13, 9), doors: [{ side: 'right', at: 3 }] },
    { id: 'meeting', role: 'meeting', label: 'Meeting Room', rect: rect(1, 10, 13, 9), doors: [{ side: 'right', at: 3 }] },
    { id: 'focus', role: 'focus', label: 'Focus Room', rect: rect(1, 19, 13, 7), doors: [{ side: 'right', at: 2 }] },
    { id: 'pantry', role: 'pantry', label: 'Pantry & Lounge', rect: rect(1, 26, 19, 9), doors: [{ side: 'top', at: 15 }] },
    { id: 'engineering', role: 'engineering', label: 'Engineering', rect: rect(32, 1, 13, 9), doors: [{ side: 'left', at: 3 }] },
    { id: 'marketing', role: 'marketing', label: 'Growth / Sales', rect: rect(32, 10, 13, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'support', role: 'support', label: 'Support / Ops', rect: rect(32, 18, 13, 8), doors: [{ side: 'left', at: 3 }] },
    { id: 'hr', role: 'hr', label: 'HR / Admin', rect: rect(21, 26, 10, 9), doors: [{ side: 'top', at: 4 }] },
    { id: 'server', role: 'server', label: 'Server / Storage', rect: rect(32, 26, 13, 9), doors: [{ side: 'left', at: 3 }] },
    {
      id: 'workzone',
      role: 'hub',
      label: 'Open Work Zone',
      rect: rect(15, 2, 16, 10),
      open: true,
      floorTile: 1 as TileTypeVal,
      furniture: [
        ...workRow(1, 1, 'PC_FRONT_ON_1'),
        ...workRow(5, 1, 'PC_FRONT_ON_2'),
        ...workRow(9, 1, 'PC_FRONT_ON_3'),
        ...workRow(3, 6, 'PC_FRONT_ON_2'),
        ...workRow(7, 6, 'PC_FRONT_ON_1'),
        { type: 'PLANT', col: 14, row: 0 },
      ],
    },
    {
      id: 'collab',
      role: 'content',
      label: 'Collaboration Hub',
      rect: rect(15, 13, 16, 12),
      open: true,
      floorTile: 1 as TileTypeVal,
      furniture: [
        { type: 'BOARDROOM_TABLE', col: 5, row: 3 },
        { type: 'CUSHIONED_CHAIR_FRONT', col: 6, row: 2 },
        { type: 'CUSHIONED_CHAIR_BACK', col: 6, row: 8 },
        { type: 'CUSHIONED_CHAIR_SIDE', col: 4, row: 4 },
        { type: 'CUSHIONED_CHAIR_SIDE', col: 4, row: 6 },
        { type: 'CUSHIONED_CHAIR_SIDE:left', col: 8, row: 4 },
        { type: 'CUSHIONED_CHAIR_SIDE:left', col: 8, row: 6 },
        ...sofaCluster(12, 4),
        { type: 'POT', col: 1, row: 10 },
        { type: 'PLANT_2', col: 14, row: 9 },
      ],
    },
  ],
};

export const MAP_DEFS: OfficeMapDef[] = [
  hubCentral,
  openStudio,
  boulevard,
  campusMini,
  teamPods,
  creativeLoft,
  hybridOffice,
];

export function getMapDef(id: string): OfficeMapDef | undefined {
  return MAP_DEFS.find((def) => def.id === id);
}
