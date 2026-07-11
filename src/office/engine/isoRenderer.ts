/**
 * Isometric ("3D map") renderer.
 *
 * Projects the flat tile map onto a 2:1-ish diamond plane (45° rotation +
 * 50% vertical squash) and draws walls, furniture and characters as upright
 * billboards anchored to their projected floor position, z-sorted by
 * isometric depth (fx + fy). Reuses the existing sprite pipeline unchanged.
 */

import type { ColorValue } from '../../components/ui/types.js';
import {
  BUBBLE_FADE_DURATION_SEC,
  BUBBLE_VERTICAL_OFFSET_PX,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
} from '../../constants.js';
import { getCachedSprite } from '../sprites/spriteCache.js';
import {
  BUBBLE_PERMISSION_SPRITE,
  BUBBLE_WAITING_SPRITE,
  getCharacterSprites,
} from '../sprites/spriteData.js';
import type {
  Character,
  FurnitureInstance,
  TileType as TileTypeVal,
} from '../types.js';
import { CharacterState, TILE_SIZE } from '../types.js';
import { getWallInstances, hasWallSprites } from '../wallTiles.js';
import { getCharacterSprite } from './characters.js';
import { renderMatrixEffect } from './matrixEffect.js';
import { renderTileGrid } from './renderer.js';

/** cos(45°) — converts flat pixel distances to iso-diagonal distances */
const ISO = Math.SQRT1_2;
/** Extra vertical room above the map top corner for tall billboard sprites */
const HEADROOM_PX = 44;

export type IsoProjection = {
  /** Map a flat floor pixel coordinate to screen (device px) */
  project: (fx: number, fy: number) => { x: number; y: number };
  zoom: number;
};

type FloorCacheEntry = { scale: number; canvas: HTMLCanvasElement };
const floorCache = new WeakMap<TileTypeVal[][], FloorCacheEntry>();

/** Darkened sprite variants used for the extruded "sides" of lifted furniture */
const darkenedCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

function getDarkenedCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const cached = darkenedCache.get(source);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const dctx = canvas.getContext('2d')!;
  dctx.drawImage(source, 0, 0);
  dctx.globalCompositeOperation = 'source-atop';
  dctx.fillStyle = 'rgba(10, 14, 28, 0.45)';
  dctx.fillRect(0, 0, canvas.width, canvas.height);
  darkenedCache.set(source, canvas);
  return canvas;
}

function getFloorCanvas(
  tileMap: TileTypeVal[][],
  tileColors: Array<ColorValue | null> | undefined,
  cols: number,
  rows: number,
  scale: number,
): HTMLCanvasElement {
  const cached = floorCache.get(tileMap);
  if (cached && cached.scale === scale) return cached.canvas;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cols * TILE_SIZE * scale);
  canvas.height = Math.max(1, rows * TILE_SIZE * scale);
  const fctx = canvas.getContext('2d')!;
  fctx.imageSmoothingEnabled = false;
  renderTileGrid(fctx, tileMap, 0, 0, scale, tileColors, cols);
  floorCache.set(tileMap, { scale, canvas });
  return canvas;
}

interface IsoDrawable {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export function renderIsoFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  tileColors: Array<ColorValue | null> | undefined,
  layoutCols?: number,
  layoutRows?: number,
): IsoProjection {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const cols = layoutCols ?? (tileMap.length > 0 ? tileMap[0].length : 0);
  const rows = layoutRows ?? tileMap.length;
  const mapW = cols * TILE_SIZE;
  const mapH = rows * TILE_SIZE;
  const span = (mapW + mapH) * ISO;

  const zoom = Math.max(
    0.4,
    Math.min(canvasWidth / span, canvasHeight / (span / 2 + HEADROOM_PX)) * 0.94,
  );

  // Screen position of floor origin (0,0): center the projected diamond,
  // accounting for billboard headroom above the top corner.
  const contentTop = -HEADROOM_PX * zoom;
  const contentBottom = (span / 2) * zoom;
  const ox = canvasWidth / 2 - ((mapW - mapH) / 2) * ISO * zoom;
  const oy = canvasHeight / 2 - (contentTop + contentBottom) / 2;

  const project = (fx: number, fy: number) => ({
    x: ox + (fx - fy) * ISO * zoom,
    y: oy + (fx + fy) * ISO * zoom * 0.5,
  });

  // ── Floor plane ──────────────────────────────────────────────
  const floorScale = Math.max(1, Math.min(3, Math.ceil(zoom)));
  const floorCanvas = getFloorCanvas(tileMap, tileColors, cols, rows, floorScale);
  const k = (ISO * zoom) / floorScale;
  ctx.save();
  ctx.setTransform(k, k * 0.5, -k, k * 0.5, ox, oy);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(floorCanvas, 0, 0);

  // ── Flat furniture (top-down art extruded off the floor plane) ───
  // Within the floor transform, translating drawing coords by (-u, -u) moves
  // the sprite straight up on screen by u·k px, so stacking darkened copies
  // from the base to a lifted top fakes a solid extrusion with height.
  const liftPerPx = floorScale / ISO;
  const flatItems = furniture.filter((f) => f.flat).sort((a, b) => a.zY - b.zY);
  for (const f of flatItems) {
    const cached = getCachedSprite(f.sprite, floorScale);
    const height = f.heightPx ?? 0;
    const drawAt = (img: HTMLCanvasElement, lift: number) => {
      const off = lift * liftPerPx;
      if (f.mirrored) {
        ctx.save();
        ctx.translate((f.x + (f.sprite[0]?.length ?? 0)) * floorScale - off, f.y * floorScale - off);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, f.x * floorScale - off, f.y * floorScale - off);
      }
    };
    if (height > 0) {
      const dark = getDarkenedCanvas(cached);
      for (let lift = 0; lift < height; lift++) drawAt(dark, lift);
    }
    drawAt(cached, height);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = false;

  // ── Billboards (walls + wall-mounted furniture + characters) ─
  const wallInstances = hasWallSprites() ? getWallInstances(tileMap, tileColors, cols) : [];
  const uprightFurniture = furniture.filter((f) => !f.flat);
  const drawables: IsoDrawable[] = [];

  for (const f of [...wallInstances, ...uprightFurniture]) {
    const spriteWpx = f.sprite[0]?.length ?? 0;
    const cached = getCachedSprite(f.sprite, zoom);
    const anchorFx = f.x + spriteWpx / 2;
    const p = project(anchorFx, f.zY);
    const dx = Math.round(p.x - cached.width / 2);
    const dy = Math.round(p.y - cached.height);
    if (f.mirrored) {
      drawables.push({
        depth: anchorFx + f.zY,
        draw: (c) => {
          c.save();
          c.translate(dx + cached.width, dy);
          c.scale(-1, 1);
          c.drawImage(cached, 0, 0);
          c.restore();
        },
      });
    } else {
      drawables.push({
        depth: anchorFx + f.zY,
        draw: (c) => {
          c.drawImage(cached, dx, dy);
        },
      });
    }
  }

  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.palette, ch.hueShift);
    const spriteData = getCharacterSprite(ch, sprites);
    const cached = getCachedSprite(spriteData, zoom);
    const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const p = project(ch.x, ch.y);
    const drawX = Math.round(p.x - cached.width / 2);
    const drawY = Math.round(p.y - cached.height + sittingOffset * zoom * 0.5);
    const depth = ch.x + ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;

    if (ch.matrixEffect) {
      drawables.push({
        depth,
        draw: (c) => {
          renderMatrixEffect(c, ch, spriteData, drawX, drawY, zoom);
        },
      });
      continue;
    }

    drawables.push({
      depth,
      draw: (c) => {
        c.drawImage(cached, drawX, drawY);
      },
    });
  }

  drawables.sort((a, b) => a.depth - b.depth);
  for (const d of drawables) d.draw(ctx);

  // ── Speech bubbles ───────────────────────────────────────────
  for (const ch of characters) {
    if (!ch.bubbleType) continue;
    const sprite = ch.bubbleType === 'permission' ? BUBBLE_PERMISSION_SPRITE : BUBBLE_WAITING_SPRITE;
    let alpha = 1.0;
    if (ch.bubbleType === 'waiting' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
      alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC;
    }
    const cached = getCachedSprite(sprite, zoom);
    const charSprites = getCharacterSprites(ch.palette, ch.hueShift);
    const charHeight = getCharacterSprite(ch, charSprites).length;
    const p = project(ch.x, ch.y);
    const bubbleX = Math.round(p.x - cached.width / 2);
    const bubbleY = Math.round(
      p.y - (charHeight + BUBBLE_VERTICAL_OFFSET_PX + 1) * zoom - cached.height,
    );
    ctx.save();
    if (alpha < 1.0) ctx.globalAlpha = alpha;
    ctx.drawImage(cached, bubbleX, bubbleY);
    ctx.restore();
  }

  return { project, zoom };
}
