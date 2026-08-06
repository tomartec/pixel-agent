import { useEffect, useMemo, useRef, useState } from "react";
import type { Direction, OfficeLayout } from "../office/types.js";
import { TILE_SIZE } from "../office/types.js";
import { OfficeState } from "../office/engine/officeState.js";
import { startGameLoop } from "../office/engine/gameLoop.js";
import { renderIsoFrame } from "../office/engine/isoRenderer.js";
import { renderFrame } from "../office/engine/renderer.js";
import type { BuiltOfficeMap } from "../office/maps/index.js";
import { getTheme } from "../office/maps/index.js";
import { type CameraBounds, loadPixelAssets, type LoadedPixelAssets } from "./pixelAssets.js";
import {
  readPersistedOffice,
  type PersistedCharacter,
  writePersistedOffice,
} from "./officePersistence.js";

export type CameraAgent = {
  id: string;
  name: string;
  status?: string | null;
  activityKind?: "coding" | "research" | "writing" | "meeting" | "idle";
  characterIndex?: number;
  pendingApproval?: boolean;
  waiting?: boolean;
};

export type RoomLabel = {
  label: string;
  rect: { col: number; row: number; cols: number; rows: number };
  open: boolean;
};

type PixelOfficeCanvasProps = {
  agents: CameraAgent[];
  /** Camera id: "map" (iso), "total", a classic camera id, or a preset map camera id */
  camera: string;
  /** Preset map built from the map catalog; null renders the classic combined layout */
  builtMap: BuiltOfficeMap | null;
  companyId: string | null;
  mapId: string;
  themeId: string;
  resetToken: number;
  roomLabels?: RoomLabel[];
};

function stableNumericId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/** Re-tint an existing layout's tile colors with a theme (classic map theming) */
function applyThemeToLayout(layout: OfficeLayout, themeId: string): OfficeLayout {
  const theme = getTheme(themeId);
  if (theme.id === "classic" || !layout.tileColors) return layout;
  return {
    ...layout,
    tileColors: layout.tileColors.map((color) => (color ? theme.adjust(color) : color)),
  };
}

export function PixelOfficeCanvas({ agents, camera, builtMap, companyId, mapId, themeId, resetToken, roomLabels }: PixelOfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const officeRef = useRef<OfficeState | null>(null);
  const assetsRef = useRef<LoadedPixelAssets | null>(null);
  const previousBubbleStatesRef = useRef(new Map<number, { pendingApproval: boolean; waiting: boolean }>());
  const lastResetTokenRef = useRef(resetToken);
  const persistedRef = useRef<Record<string, PersistedCharacter>>({});
  const persistRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const agentMeta = useMemo(
    () => new Map(agents.map((agent) => [stableNumericId(agent.id), agent] as const)),
    [agents],
  );

  useEffect(() => {
    let cancelled = false;

    void loadPixelAssets()
      .then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // (Re)build office state whenever the selected map or theme changes
  useEffect(() => {
    const assets = assetsRef.current;
    if (!assets || !ready) return;
    const layout = builtMap
      ? builtMap.layout
      : applyThemeToLayout(assets.layouts.combined, themeId);
    if (resetToken !== lastResetTokenRef.current) {
      officeRef.current = null;
      lastResetTokenRef.current = resetToken;
    }
    if (officeRef.current) {
      officeRef.current.rebuildFromLayout(layout);
    } else {
      officeRef.current = new OfficeState(layout);
    }
    persistedRef.current = readPersistedOffice(companyId, mapId, themeId);
    setLayoutVersion((version) => version + 1);
  }, [ready, builtMap, companyId, mapId, themeId, resetToken]);

  useEffect(() => {
    const office = officeRef.current;
    if (!office || layoutVersion === 0) return;

    const incoming = new Set(agents.map((agent) => stableNumericId(agent.id)));
    for (const agent of agents) {
      const id = stableNumericId(agent.id);
      const saved = persistedRef.current[agent.id];
      const isNew = !office.characters.has(id);
      office.addAgent(id, agent.characterIndex, 0, saved?.seatId ?? undefined, true);
      const character = office.characters.get(id);
      if (isNew && saved && character?.seatId === saved.seatId) {
        character.tileCol = saved.tileCol;
        character.tileRow = saved.tileRow;
        character.x = saved.tileCol * TILE_SIZE + TILE_SIZE / 2;
        character.y = saved.tileRow * TILE_SIZE + TILE_SIZE / 2;
        character.dir = saved.dir as Direction;
        character.path = [];
        character.moveProgress = 0;
      }
      if (character && agent.characterIndex !== undefined) {
        if (character.palette !== agent.characterIndex) character.palette = agent.characterIndex;
        if (character.hueShift !== 0) character.hueShift = 0;
      }
      const activity = agent.activityKind ?? "idle";
      const isWorking = activity !== "idle";
      if (character && character.isActive !== isWorking) office.setAgentActive(id, isWorking);
      const nextTool = activity === "research"
        ? "Read"
        : activity === "writing"
          ? "Write"
          : activity === "coding"
            ? "Edit"
            : activity === "meeting"
              ? "Task"
              : null;
      if (character && character.currentTool !== nextTool) office.setAgentTool(id, nextTool);

      const previous = previousBubbleStatesRef.current.get(id) ?? { pendingApproval: false, waiting: false };
      const pendingApproval = agent.pendingApproval === true;
      const waiting = agent.waiting === true;
      if (pendingApproval && !previous.pendingApproval) office.showPermissionBubble(id);
      if (!pendingApproval && previous.pendingApproval) office.clearPermissionBubble(id);
      if (waiting && !previous.waiting) office.showWaitingBubble(id);
      previousBubbleStatesRef.current.set(id, { pendingApproval, waiting });
    }
    for (const id of office.characters.keys()) {
      if (!incoming.has(id)) {
        office.removeAgent(id);
        previousBubbleStatesRef.current.delete(id);
      }
    }
  }, [agents, layoutVersion]);

  useEffect(() => {
    if (layoutVersion === 0) return;

    function persist() {
      const office = officeRef.current;
      if (!office) return;
      const characters: Record<string, PersistedCharacter> = {};
      for (const agent of agents) {
        const character = office.characters.get(stableNumericId(agent.id));
        if (!character) continue;
        characters[agent.id] = {
          seatId: character.seatId,
          tileCol: character.tileCol,
          tileRow: character.tileRow,
          dir: character.dir,
          palette: character.palette,
          hueShift: character.hueShift,
        };
      }
      writePersistedOffice(companyId, { version: 1, mapId, themeId, characters });
    }
    persistRef.current = persist;

    const interval = window.setInterval(persist, 2_000);
    function onPageExit() {
      persist();
    }
    window.addEventListener("visibilitychange", onPageExit);
    window.addEventListener("pagehide", onPageExit);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onPageExit);
      window.removeEventListener("pagehide", onPageExit);
      persist();
    };
  }, [agents, companyId, layoutVersion, mapId, themeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const office = officeRef.current;
    const assets = assetsRef.current;
    if (!canvas || !wrap || !office || !assets || layoutVersion === 0) return;

    const activeCanvas = canvas;
    const activeWrap = wrap;

    function resize() {
      const rect = activeWrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      activeCanvas.width = Math.max(1, Math.round(rect.width * dpr));
      activeCanvas.height = Math.max(1, Math.round(rect.height * dpr));
      activeCanvas.style.width = `${rect.width}px`;
      activeCanvas.style.height = `${rect.height}px`;
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(activeWrap);

    function resolveBounds(): CameraBounds {
      const layout = office!.getLayout();
      const total: CameraBounds = { col: 0, row: 0, cols: layout.cols, rows: layout.rows };
      if (camera === "total") return total;
      if (builtMap) {
        return builtMap.cameras.find((entry) => entry.id === camera)?.bounds ?? total;
      }
      const classic = assets!.cameraBounds as unknown as Record<string, CameraBounds>;
      return classic[camera] ?? total;
    }

    function drawRoomLabels(
      ctx: CanvasRenderingContext2D,
      offsetX: number,
      offsetY: number,
      zoom: number,
    ) {
      if (!roomLabels || roomLabels.length === 0) return;
      ctx.save();
      const fontSize = Math.max(9, Math.floor(4.5 * zoom));
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const room of roomLabels) {
        const centerX = offsetX + (room.rect.col + room.rect.cols / 2) * TILE_SIZE * zoom;
        const topY = offsetY + (room.rect.row + (room.open ? 0.6 : 1.5)) * TILE_SIZE * zoom;
        const text = room.label.toUpperCase();
        const metrics = ctx.measureText(text);
        const padX = fontSize * 0.6;
        const padY = fontSize * 0.35;
        ctx.fillStyle = "rgba(9,13,24,0.82)";
        ctx.fillRect(
          centerX - metrics.width / 2 - padX,
          topY - fontSize / 2 - padY,
          metrics.width + padX * 2,
          fontSize + padY * 2,
        );
        ctx.fillStyle = "#f3f4f6";
        ctx.fillText(text, centerX, topY);
      }
      ctx.restore();
    }

    const stop = startGameLoop(canvas, {
      update: (dt) => office.update(dt),
      render: (ctx) => {
        const layout = office.getLayout();

        if (camera === "map") {
          const { project, zoom: isoZoom } = renderIsoFrame(
            ctx,
            canvas.width,
            canvas.height,
            office.tileMap,
            office.furniture,
            Array.from(office.characters.values()),
            layout.tileColors,
            layout.cols,
            layout.rows,
          );

          ctx.save();
          ctx.font = `${Math.max(11, Math.floor(6 * isoZoom))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#f9fafb";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = Math.max(2, isoZoom);
          for (const character of office.characters.values()) {
            const name = agentMeta.get(character.id)?.name;
            if (!name) continue;
            const p = project(character.x, character.y + 8);
            ctx.strokeText(name, p.x, p.y);
            ctx.fillText(name, p.x, p.y);
          }
          ctx.restore();
          return;
        }

        const focus = resolveBounds();
        const dpr = window.devicePixelRatio || 1;
        const fitZoom = Math.min(
          canvas.width / (focus.cols * TILE_SIZE),
          canvas.height / (focus.rows * TILE_SIZE),
        ) * 0.92;
        // Room cameras never zoom below device pixel ratio for sharpness;
        // the "total" overview must always fit the whole floor instead.
        const zoom = camera === "total" ? fitZoom : Math.max(dpr, fitZoom);
        const mapCenterCol = layout.cols / 2;
        const mapCenterRow = layout.rows / 2;
        const focusCenterCol = focus.col + focus.cols / 2;
        const focusCenterRow = focus.row + focus.rows / 2;
        const panX = (mapCenterCol - focusCenterCol) * TILE_SIZE * zoom;
        const panY = (mapCenterRow - focusCenterRow) * TILE_SIZE * zoom;

        const { offsetX, offsetY } = renderFrame(
          ctx,
          canvas.width,
          canvas.height,
          office.tileMap,
          office.furniture,
          Array.from(office.characters.values()),
          zoom,
          panX,
          panY,
          {
            selectedAgentId: null,
            hoveredAgentId: null,
            hoveredTile: null,
            seats: office.seats,
            characters: office.characters,
          },
          undefined,
          layout.tileColors,
          layout.cols,
          layout.rows,
        );

        drawRoomLabels(ctx, offsetX, offsetY, zoom);

        ctx.save();
        ctx.font = `${Math.max(10, Math.floor(5 * zoom))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#f9fafb";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(2, zoom);
        for (const character of office.characters.values()) {
          const name = agentMeta.get(character.id)?.name;
          if (!name) continue;
          const x = offsetX + character.x * zoom;
          const y = offsetY + (character.y + 8) * zoom;
          ctx.strokeText(name, x, y);
          ctx.fillText(name, x, y);
        }
        ctx.restore();
      },
    });

    return () => {
      observer.disconnect();
      persistRef.current();
      stop();
    };
  }, [agentMeta, camera, builtMap, roomLabels, layoutVersion]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "min(725px, calc(100vh - 185px))", minHeight: "520px" }}>
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {loadError ? `Camera failed: ${loadError}` : "Loading camera..."}
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }} />
    </div>
  );
}
