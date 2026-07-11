import type { ColorValue } from '../../components/ui/types.js';

/** Functional role of a room — themes map roles to floor colors and
 *  industry templates map roles to display labels. */
export type RoomRole =
  | 'product'
  | 'engineering'
  | 'design'
  | 'marketing'
  | 'support'
  | 'hr'
  | 'meeting'
  | 'data'
  | 'pantry'
  | 'server'
  | 'lounge'
  | 'focus'
  | 'content'
  | 'hub'
  | 'courtyard'
  | 'corridor';

export type MapTheme = {
  id: string;
  label: string;
  wall: ColorValue;
  roles: Record<RoomRole, ColorValue>;
  /** Accent color applied to desks and tables */
  deskAccent?: ColorValue;
  /** Transform applied to arbitrary tile colors (used to re-theme the classic layout) */
  adjust: (color: ColorValue) => ColorValue;
};

/** Base palette matching the docs/option*.png reference art */
const CLASSIC_ROLES: Record<RoomRole, ColorValue> = {
  product: { h: 95, s: 28, b: -6, c: -14 },
  engineering: { h: 215, s: 32, b: -14, c: -16 },
  design: { h: 290, s: 28, b: -10, c: -16 },
  marketing: { h: 355, s: 26, b: -8, c: -14 },
  support: { h: 175, s: 28, b: -10, c: -16 },
  hr: { h: 35, s: 42, b: -2, c: -10 },
  meeting: { h: 225, s: 32, b: -12, c: -16 },
  data: { h: 250, s: 28, b: -16, c: -20 },
  pantry: { h: 25, s: 38, b: -6, c: -8 },
  server: { h: 230, s: 12, b: -46, c: -40 },
  lounge: { h: 30, s: 34, b: -8, c: -10 },
  focus: { h: 270, s: 28, b: -10, c: -16 },
  content: { h: 40, s: 14, b: 2, c: -10 },
  hub: { h: 35, s: 25, b: 10, c: -8 },
  courtyard: { h: 110, s: 32, b: -6, c: -14 },
  corridor: { h: 35, s: 22, b: 6, c: -10 },
};

const CLASSIC_WALL: ColorValue = { h: 214, s: 30, b: -100, c: -55 };

const clampHue = (h: number) => ((h % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function mapRoles(f: (c: ColorValue) => ColorValue): Record<RoomRole, ColorValue> {
  return Object.fromEntries(
    Object.entries(CLASSIC_ROLES).map(([role, color]) => [role, f(color)]),
  ) as Record<RoomRole, ColorValue>;
}

function makeTheme(
  id: string,
  label: string,
  adjust: (c: ColorValue) => ColorValue,
  deskAccent?: ColorValue,
): MapTheme {
  return { id, label, wall: adjust(CLASSIC_WALL), roles: mapRoles(adjust), deskAccent, adjust };
}

export const MAP_THEMES: MapTheme[] = [
  makeTheme('classic', 'Classic', (c) => c),
  makeTheme('midnight', 'Midnight', (c) => ({
    h: clampHue(c.h + 10),
    s: clamp(c.s - 8, 0, 100),
    b: clamp(c.b - 28, -100, 100),
    c: clamp(c.c - 18, -100, 100),
  })),
  makeTheme('pastel', 'Pastel', (c) => ({
    h: c.h,
    s: clamp(c.s - 10, 0, 100),
    b: clamp(c.b + 20, -100, 100),
    c: clamp(c.c - 6, -100, 100),
  })),
  makeTheme(
    'forest',
    'Forest',
    (c) => ({
      h: clampHue(75 + (clampHue(c.h) / 360) * 90), // remap all hues into 75–165 (greens)
      s: clamp(c.s + 4, 0, 100),
      b: clamp(c.b - 6, -100, 100),
      c: c.c,
    }),
    { h: 130, s: 20, b: -12, c: -18 },
  ),
  makeTheme(
    'sunset',
    'Sunset',
    (c) => ({
      h: clampHue(5 + (clampHue(c.h) / 360) * 50), // remap into 5–55 (warm)
      s: clamp(c.s + 8, 0, 100),
      b: clamp(c.b + 2, -100, 100),
      c: c.c,
    }),
    { h: 20, s: 30, b: -8, c: -12 },
  ),
  makeTheme('mono', 'Monochrome', (c) => ({
    h: 220,
    s: 5,
    b: clamp(c.b - 4, -100, 100),
    c: clamp(c.c - 8, -100, 100),
  })),
  makeTheme(
    'neon',
    'Neon',
    (c) => ({
      h: clampHue(c.h + 15),
      s: clamp(c.s + 40, 0, 100),
      b: clamp(c.b - 26, -100, 100),
      c: clamp(c.c + 12, -100, 100),
    }),
    { h: 300, s: 40, b: -22, c: 5 },
  ),
  makeTheme(
    'retro',
    'Retro',
    (c) => ({
      h: clampHue(20 + (clampHue(c.h) / 360) * 50), // remap into 20–70 (70s oranges/olives)
      s: clamp(c.s + 8, 0, 100),
      b: clamp(c.b - 2, -100, 100),
      c: clamp(c.c - 8, -100, 100),
    }),
    { h: 30, s: 34, b: -10, c: -10 },
  ),
];

export function getTheme(id: string): MapTheme {
  return MAP_THEMES.find((theme) => theme.id === id) ?? MAP_THEMES[0];
}
