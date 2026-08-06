import { useEffect, useMemo, useRef, useState } from "react";
import { useHostContext, usePluginData, usePluginStream, usePluginToast, type PluginSettingsPageProps, type PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";
import { PAGE_ROUTE } from "../manifest.js";
import type { ActivityKind, AgentLiveEvent } from "../worker.js";
import {
  buildOfficeMap,
  getIndustry,
  getMapDef,
  getTheme,
  INDUSTRY_TEMPLATES,
  MAP_DEFS,
  MAP_THEMES,
} from "../office/maps/index.js";
import { PixelOfficeCanvas, type RoomLabel } from "./PixelOfficeCanvas.js";
import { getPluginAssetBaseUrl, type AssetIndex } from "./pixelAssets.js";
import { clearPersistedOffice } from "./officePersistence.js";

type CameraRoomData = {
  room: string;
  fetchedAt?: string;
  agents: Array<{
    id: string;
    name: string;
    status?: string | null;
    urlKey?: string | null;
    activityKind?: ActivityKind;
    characterIndex?: number;
  }>;
};

type LiveOverride = {
  status: string | null;
  activityKind: ActivityKind;
  at: string;
};

type CharacterSettingsData = {
  agents: Array<{
    id: string;
    name: string;
    status?: string | null;
    urlKey?: string | null;
  }>;
};

type NavDirection = "up" | "down" | "left" | "right";

const CLASSIC_MAP_ID = "classic";

const CLASSIC_CAMERA_ORDER = ["office", "boardroomKitchen", "overflowOffice", "kitchen"];

const CLASSIC_ROOM_LABELS: Record<string, string> = {
  office: "Office + Lounge",
  boardroomKitchen: "Boardroom + Game Room",
  overflowOffice: "Overflow Office + Lounge",
  kitchen: "Staff Kitchen",
  total: "Total · All Rooms",
};

/**
 * Camera adjacency for the 2×2 grid (both the classic layout and preset maps
 * use four quadrant cameras). The flat "total" overview camera is not part of
 * the arrow-navigation grid.
 */
const CLASSIC_NAV: Record<string, Partial<Record<NavDirection, string>>> = {
  office: { right: "boardroomKitchen", down: "overflowOffice" },
  boardroomKitchen: { left: "office", down: "kitchen" },
  overflowOffice: { up: "office", right: "kitchen" },
  kitchen: { left: "overflowOffice", up: "boardroomKitchen" },
  total: {},
};

const PRESET_NAV: Record<string, Partial<Record<NavDirection, string>>> = {
  cam1: { right: "cam2", down: "cam3" },
  cam2: { left: "cam1", down: "cam4" },
  cam3: { up: "cam1", right: "cam4" },
  cam4: { left: "cam3", up: "cam2" },
  total: {},
};

type OfficeSettings = {
  mapId: string;
  themeId: string;
  industryId: string;
};

const DEFAULT_OFFICE_SETTINGS: OfficeSettings = {
  mapId: CLASSIC_MAP_ID,
  themeId: "classic",
  industryId: "software",
};

function officeSettingsKey(companyId: string | null): string {
  return `agent-pixels.office-settings.${companyId ?? "instance"}`;
}

function readOfficeSettings(companyId: string | null): OfficeSettings {
  if (typeof window === "undefined") return DEFAULT_OFFICE_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(officeSettingsKey(companyId)) ?? "{}");
    return {
      mapId: typeof parsed.mapId === "string" ? parsed.mapId : DEFAULT_OFFICE_SETTINGS.mapId,
      themeId: typeof parsed.themeId === "string" ? parsed.themeId : DEFAULT_OFFICE_SETTINGS.themeId,
      industryId: typeof parsed.industryId === "string" ? parsed.industryId : DEFAULT_OFFICE_SETTINGS.industryId,
    };
  } catch {
    return DEFAULT_OFFICE_SETTINGS;
  }
}

function writeOfficeSettings(companyId: string | null, settings: OfficeSettings) {
  window.localStorage.setItem(officeSettingsKey(companyId), JSON.stringify(settings));
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function LiveStatusBadge({
  companyId,
  connected,
  connecting,
  error,
  fetchedAt,
}: {
  companyId: string | null;
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  fetchedAt?: string;
}) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const hasConnectedRef = useRef(false);
  const previousCompanyIdRef = useRef(companyId);
  const reducedMotion = useReducedMotion();
  if (previousCompanyIdRef.current !== companyId) {
    previousCompanyIdRef.current = companyId;
    hasConnectedRef.current = false;
  }
  if (connected) hasConnectedRef.current = true;

  const reconnecting = !connected && hasConnectedRef.current;
  const isConnecting = companyId !== null && !error && (connecting || reconnecting);
  const label = connected ? "Live" : isConnecting ? (reconnecting ? "Reconnecting..." : "Connecting") : "Offline";
  const color = connected ? "#22c55e" : isConnecting ? "#f59e0b" : "#ef4444";
  const duration = connected ? 1800 : isConnecting ? 900 : null;

  useEffect(() => {
    if (duration === null || reducedMotion || !dotRef.current) return;
    const animation = dotRef.current.animate(
      [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
      { duration, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [duration, reducedMotion]);

  const ageSeconds = fetchedAt ? Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1_000) : 0;
  const age = ageSeconds > 60
    ? ` · ${ageSeconds >= 3_600 ? `${Math.floor(ageSeconds / 3_600)}h` : `${Math.floor(ageSeconds / 60)}m`} ago`
    : "";

  return (
    <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px", opacity: 0.9 }}>
      <span ref={dotRef} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: color }} />
      <span>{label}{age}</span>
    </span>
  );
}

const ARROW_GLYPHS: Record<NavDirection, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

const ARROW_KEY_TO_DIRECTION: Record<string, NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function cameraPagePath(companyPrefix: string | null): string {
  return companyPrefix ? `/${companyPrefix}/${PAGE_ROUTE}` : `/${PAGE_ROUTE}`;
}

function assignmentsStorageKey(companyId: string | null): string {
  return `agent-pixels.character-assignments.${companyId ?? "instance"}`;
}

function readStoredAssignments(companyId: string | null): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(assignmentsStorageKey(companyId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredAssignments(companyId: string | null, assignments: Record<string, number>) {
  window.localStorage.setItem(assignmentsStorageKey(companyId), JSON.stringify(assignments));
}

const styles = {
  link: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
    borderRadius: "6px",
    color: "var(--foreground)",
    overflow: "hidden",
  } as React.CSSProperties,
  linkActive: {
    background: "var(--accent)",
  } as React.CSSProperties,
  linkIcon: {
    flexShrink: 0,
  } as React.CSSProperties,
  linkLabel: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  page: {
    minHeight: "100%",
    padding: "14px 24px 24px",
    color: "#e5e7eb",
    background: "#111827",
    fontFamily: "inherit",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    color: "#f9fafb",
  } as React.CSSProperties,
  title: {
    fontSize: "18px",
    fontWeight: 700,
  } as React.CSSProperties,
  cameraTabs: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  } as React.CSSProperties,
  cameraTab: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    padding: "5px 9px",
    borderRadius: "4px",
    cursor: "pointer",
    font: "inherit",
    fontSize: "12px",
  } as React.CSSProperties,
  cameraTabActive: {
    background: "rgba(255,255,255,0.16)",
    color: "#fff",
  } as React.CSSProperties,
  select: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#1f2937",
    color: "#e5e7eb",
    padding: "4px 6px",
    borderRadius: "4px",
    cursor: "pointer",
    font: "inherit",
    fontSize: "12px",
    maxWidth: "150px",
  } as React.CSSProperties,
  navArrow: {
    position: "absolute",
    zIndex: 2,
    width: "38px",
    height: "38px",
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: "50%",
    background: "rgba(17,24,39,0.72)",
    color: "#f9fafb",
    fontSize: "14px",
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
  } as React.CSSProperties,
  camera: {
    position: "relative",
    overflow: "hidden",
    height: "min(725px, calc(100vh - 185px))",
    minHeight: "520px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#1f2937",
    imageRendering: "pixelated",
  } as React.CSSProperties,
  scanlines: {
    position: "absolute",
    inset: 0,
    background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 1px, transparent 1px, transparent 4px)",
    pointerEvents: "none",
  } as React.CSSProperties,
  floor: {
    position: "absolute",
    inset: "34% 0 0",
    background: "linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), #374151",
    backgroundSize: "32px 32px",
  } as React.CSSProperties,
  desk: {
    position: "absolute",
    width: "132px",
    height: "54px",
    background: "#7c2d12",
    border: "4px solid #431407",
  } as React.CSSProperties,
  agent: {
    display: "none",
  } as React.CSSProperties,
} as const;

export function AgentPixelsSidebarLink({ context }: PluginSidebarProps) {
  const href = cameraPagePath(context.companyPrefix);
  const isActive = typeof window !== "undefined" && window.location.pathname.startsWith(href);

  return (
    <a href={href} aria-current={isActive ? "page" : undefined} style={{ ...styles.link, ...(isActive ? styles.linkActive : {}) }}>
      <span aria-hidden="true" style={styles.linkIcon}>▣</span>
      <span style={styles.linkLabel}>Agent Pixels</span>
    </a>
  );
}

export function AgentPixelsCameraPage() {
  const pageRef = useRef<HTMLElement>(null);
  const { companyId } = useHostContext();
  const toast = usePluginToast();
  const { data, refresh } = usePluginData<CameraRoomData>("camera-room", { companyId });
  const { lastEvent, connecting, connected, error: streamError, close } = usePluginStream<AgentLiveEvent>(
    `agent-activity:${companyId ?? ""}`,
    { companyId: companyId ?? undefined },
  );
  const [assignments, setAssignments] = useState<Record<string, number>>(() => readStoredAssignments(companyId ?? null));
  const [liveOverrides, setLiveOverrides] = useState<Record<string, LiveOverride>>({});
  const wasConnectedRef = useRef(false);
  const agents = useMemo(
    () => (data?.agents ?? []).map((agent) => {
      const override = liveOverrides[agent.id];
      const status = override?.status ?? agent.status;
      return {
        ...agent,
        status,
        activityKind: override?.activityKind ?? agent.activityKind,
        characterIndex: assignments[agent.id],
        pendingApproval: status === "pending_approval",
        waiting: status === "idle" || status === "paused",
      };
    }),
    [assignments, data?.agents, liveOverrides],
  );
  const [settings, setSettings] = useState<OfficeSettings>(() => readOfficeSettings(companyId ?? null));
  const isClassic = settings.mapId === CLASSIC_MAP_ID || !getMapDef(settings.mapId);
  const [camera, setCamera] = useState<string>("total");
  const [view, setView] = useState<"camera" | "map" | "characters">("camera");
  const [resetToken, setResetToken] = useState(0);

  const builtMap = useMemo(() => {
    if (isClassic) return null;
    return buildOfficeMap(getMapDef(settings.mapId)!, getTheme(settings.themeId));
  }, [isClassic, settings.mapId, settings.themeId]);

  const roomLabels = useMemo<RoomLabel[] | undefined>(() => {
    if (!builtMap) return undefined;
    const industry = getIndustry(settings.industryId);
    return builtMap.rooms
      .filter((room) => room.role !== "corridor")
      .map((room) => ({
        label: industry.roleLabels[room.role] ?? room.label,
        rect: room.rect,
        open: room.open,
      }));
  }, [builtMap, settings.industryId]);

  const cameraOrder = isClassic ? CLASSIC_CAMERA_ORDER : ["cam1", "cam2", "cam3", "cam4"];
  const nav = isClassic ? CLASSIC_NAV : PRESET_NAV;
  const cameraLabel = (cameraId: string): string => {
    if (isClassic) return CLASSIC_ROOM_LABELS[cameraId] ?? cameraId;
    return builtMap?.cameras.find((entry) => entry.id === cameraId)?.label ?? cameraId;
  };

  function updateSettings(patch: Partial<OfficeSettings>) {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      writeOfficeSettings(companyId ?? null, next);
      if (patch.mapId && patch.mapId !== previous.mapId) {
        setCamera("total");
      }
      return next;
    });
  }

  useEffect(() => {
    setAssignments(readStoredAssignments(companyId ?? null));
    setSettings(readOfficeSettings(companyId ?? null));
    setLiveOverrides({});
  }, [companyId]);

  useEffect(() => {
    if (!companyId) close();
  }, [companyId, close]);

  useEffect(() => {
    if (!lastEvent) return;
    setLiveOverrides((previous) => ({
      ...previous,
      [lastEvent.agentId]: {
        status: lastEvent.status,
        activityKind: lastEvent.activityKind,
        at: lastEvent.at,
      },
    }));
  }, [lastEvent]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refresh();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (connected && !wasConnectedRef.current) refresh();
    wasConnectedRef.current = connected;
  }, [connected, refresh]);

  useEffect(() => {
    if (view !== "camera") return;

    function onKeyDown(event: KeyboardEvent) {
      const direction = ARROW_KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const nextCamera = nav[camera]?.[direction];
      if (!nextCamera) return;
      event.preventDefault();
      setCamera(nextCamera);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, camera, nav]);

  useEffect(() => {
    const hostSlot = pageRef.current?.parentElement;
    const hostBackRow = hostSlot?.previousElementSibling as HTMLElement | null;
    const hostWrapper = hostSlot?.parentElement as HTMLElement | null;
    const previousDisplay = hostBackRow?.style.display;
    const previousGap = hostWrapper?.style.gap;

    if (hostBackRow?.textContent?.includes("Back")) hostBackRow.style.display = "none";
    if (hostWrapper) hostWrapper.style.gap = "0";

    return () => {
      if (hostBackRow && previousDisplay !== undefined) hostBackRow.style.display = previousDisplay;
      if (hostWrapper && previousGap !== undefined) hostWrapper.style.gap = previousGap;
    };
  }, []);

  return (
    <main ref={pageRef} style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.title}>Agent Pixels</div>
          <div style={{ fontSize: "12px", opacity: 0.7 }}>
            {view === "map" ? "3D Map · All Rooms" : view === "characters" ? "Character Assignments" : `${cameraLabel(camera)} Camera`}
          </div>
        </div>
        <div style={styles.cameraTabs}>
          <select
            aria-label="Office map"
            value={isClassic ? CLASSIC_MAP_ID : settings.mapId}
            onChange={(event) => updateSettings({ mapId: event.target.value })}
            style={styles.select}
          >
            <option value={CLASSIC_MAP_ID}>Classic HQ</option>
            {MAP_DEFS.map((def) => (
              <option key={def.id} value={def.id}>{def.label}</option>
            ))}
          </select>
          <select
            aria-label="Theme"
            value={settings.themeId}
            onChange={(event) => updateSettings({ themeId: event.target.value })}
            style={styles.select}
          >
            {MAP_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.label}</option>
            ))}
          </select>
          {!isClassic && (
            <select
              aria-label="Industry template"
              value={settings.industryId}
              onChange={(event) => updateSettings({ industryId: event.target.value })}
              style={styles.select}
            >
              {INDUSTRY_TEMPLATES.map((industry) => (
                <option key={industry.id} value={industry.id}>{industry.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setView("map")}
            style={{ ...styles.cameraTab, ...(view === "map" ? styles.cameraTabActive : {}) }}
          >
            3D Map
          </button>
          <button
            type="button"
            title={cameraLabel("total")}
            onClick={() => {
              setView("camera");
              setCamera("total");
            }}
            style={{ ...styles.cameraTab, ...(view === "camera" && camera === "total" ? styles.cameraTabActive : {}) }}
          >
            Total
          </button>
          {cameraOrder.map((cameraId, index) => (
            <button
              key={cameraId}
              type="button"
              title={cameraLabel(cameraId)}
              onClick={() => {
                setView("camera");
                setCamera(cameraId);
              }}
              style={{ ...styles.cameraTab, ...(view === "camera" && camera === cameraId ? styles.cameraTabActive : {}) }}
            >
              Camera {index + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView("characters")}
            style={{ ...styles.cameraTab, ...(view === "characters" ? styles.cameraTabActive : {}) }}
          >
            Characters
          </button>
          <LiveStatusBadge
            companyId={companyId ?? null}
            connected={connected}
            connecting={connecting}
            error={streamError}
            fetchedAt={data?.fetchedAt}
          />
          <button
            type="button"
            title="Reset vị trí nhân vật"
            aria-label="Reset vị trí nhân vật"
            onClick={() => {
              clearPersistedOffice(companyId ?? null);
              setResetToken((token) => token + 1);
              toast({ title: "Đã reset vị trí nhân vật", tone: "success" });
            }}
            style={styles.cameraTab}
          >
            ↺
          </button>
        </div>
      </header>

      {view === "characters" ? (
        <CharacterAssignmentsPanel companyId={companyId ?? null} assignments={assignments} onAssignmentsChange={setAssignments} />
      ) : (
        <section aria-label="Agent Pixels office camera" style={styles.camera}>
          <PixelOfficeCanvas
            camera={view === "map" ? "map" : camera}
            builtMap={builtMap}
            companyId={companyId ?? null}
            mapId={settings.mapId}
            themeId={settings.themeId}
            resetToken={resetToken}
            roomLabels={roomLabels}
            agents={agents.length ? agents : [{ id: "placeholder", name: "No agents yet", status: "waiting", activityKind: "idle" }]}
          />
          <div style={styles.scanlines} />
          {view === "camera" && (
            <RoomNavArrows
              camera={camera}
              nav={nav}
              labelFor={cameraLabel}
              onNavigate={(next) => {
                setCamera(next);
              }}
            />
          )}
        </section>
      )}
    </main>
  );
}

const ARROW_POSITIONS: Record<NavDirection, React.CSSProperties> = {
  up: { top: 10, left: "50%", transform: "translateX(-50%)" },
  down: { bottom: 10, left: "50%", transform: "translateX(-50%)" },
  left: { left: 10, top: "50%", transform: "translateY(-50%)" },
  right: { right: 10, top: "50%", transform: "translateY(-50%)" },
};

function RoomNavArrows({
  camera,
  nav,
  labelFor,
  onNavigate,
}: {
  camera: string;
  nav: Record<string, Partial<Record<NavDirection, string>>>;
  labelFor: (cameraId: string) => string;
  onNavigate: (next: string) => void;
}) {
  const directions = nav[camera] ?? {};
  return (
    <>
      {(Object.keys(directions) as NavDirection[]).map((direction) => {
        const target = directions[direction];
        if (!target) return null;
        return (
          <button
            key={direction}
            type="button"
            title={labelFor(target)}
            aria-label={`Go ${direction} to ${labelFor(target)}`}
            onClick={() => onNavigate(target)}
            style={{ ...styles.navArrow, ...ARROW_POSITIONS[direction] }}
          >
            {ARROW_GLYPHS[direction]}
          </button>
        );
      })}
    </>
  );
}

function useCharacterAssets() {
  const [assets, setAssets] = useState<Array<{ index: number; path: string; url: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const baseUrl = getPluginAssetBaseUrl();
    fetch(`${baseUrl}agent-pixels-assets.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch character index: ${res.status}`);
        return res.json() as Promise<AssetIndex>;
      })
      .then((index) => {
        if (cancelled) return;
        setAssets(index.characters.map((path, index) => ({ index, path, url: `${baseUrl}${path}` })));
        setError(null);
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { assets, error };
}

function SpritePreview({ url, scale = 2 }: { url: string; scale?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 16 * scale,
        height: 32 * scale,
        backgroundImage: `url(${url})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 0",
        backgroundSize: `${16 * scale * 7}px ${32 * scale * 3}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

function CharacterAssignmentsPanel({
  companyId,
  assignments,
  onAssignmentsChange,
}: {
  companyId: string | null;
  assignments?: Record<string, number>;
  onAssignmentsChange?: (assignments: Record<string, number>) => void;
}) {
  const { data, loading, error, refresh } = usePluginData<CharacterSettingsData>("character-settings", companyId ? { companyId } : {});
  const { assets, error: assetError } = useCharacterAssets();
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [storedAssignments, setStoredAssignments] = useState<Record<string, number>>(() => assignments ?? readStoredAssignments(companyId));
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);

  useEffect(() => {
    setStoredAssignments(assignments ?? readStoredAssignments(companyId));
  }, [assignments, companyId]);

  const agents = data?.agents ?? [];
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const selectedIndex = selectedAgent ? storedAssignments[selectedAgent.id] : undefined;
  const visibleIndex = draftIndex ?? selectedIndex;

  useEffect(() => {
    setDraftIndex(null);
  }, [selectedAgent?.id, selectedIndex]);

  async function updateAssignment(agentId: string, characterIndex: number | null) {
    setSavingAgentId(agentId);
    try {
      const next = { ...storedAssignments };
      if (characterIndex === null) delete next[agentId];
      else next[agentId] = characterIndex;
      writeStoredAssignments(companyId, next);
      setStoredAssignments(next);
      onAssignmentsChange?.(next);
      refresh();
    } finally {
      setSavingAgentId(null);
    }
  }

  if (loading) return <div style={{ padding: 24, fontSize: 13 }}>Loading Agent Pixels settings...</div>;
  if (error) return <div style={{ padding: 24, fontSize: 13 }}>Settings failed: {error.message}</div>;

  function randomIndex(): number | null {
    if (assets.length === 0) return null;
    const used = new Set(Object.values(storedAssignments));
    const open = assets.filter((asset) => !used.has(asset.index) || asset.index === selectedIndex);
    const pool = open.length > 0 ? open : assets;
    return pool[Math.floor(Math.random() * pool.length)]?.index ?? null;
  }

  return (
    <section style={{ padding: "18px", display: "grid", gap: "14px", color: "var(--foreground)", background: "var(--background, #111827)", border: "1px solid rgba(255,255,255,0.14)", fontFamily: "inherit" }}>
      {assetError ? <div style={{ fontSize: "13px", color: "var(--destructive, #ef4444)" }}>{assetError}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "16px", alignItems: "start" }}>
        <aside style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 6, overflow: "hidden", background: "rgba(15,23,42,0.35)" }}>
          <div style={{ padding: "12px", fontSize: "18px", fontWeight: 800, borderBottom: "1px solid rgba(148,163,184,0.25)" }}>Agents</div>
          <div style={{ maxHeight: "610px", overflow: "auto" }}>
            {agents.map((agent) => {
              const assigned = storedAssignments[agent.id];
              const assignedAsset = assets[assigned] ?? null;
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr 42px",
                    gap: "8px",
                    alignItems: "center",
                    padding: "9px 10px",
                    border: 0,
                    borderBottom: "1px solid rgba(148,163,184,0.16)",
                    background: isSelected ? "rgba(59,130,246,0.18)" : "transparent",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agent.name}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", opacity: 0.65 }}>{assignedAsset ? `char_${assigned}` : "Auto"}</span>
                  </span>
                  <span style={{ width: 36, height: 48, display: "grid", placeItems: "center", background: "rgba(148,163,184,0.12)", borderRadius: 4 }}>
                    {assignedAsset ? <SpritePreview url={assignedAsset.url} scale={1.5} /> : <span style={{ fontSize: 10, opacity: 0.65 }}>Auto</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedAgent?.name ?? "No agents"}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                {visibleIndex !== undefined && visibleIndex !== null ? `Selected char_${visibleIndex}` : "Using automatic sprite"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {selectedAgent ? (
                <button
                  type="button"
                  disabled={savingAgentId === selectedAgent.id || draftIndex === null}
                  onClick={() => void updateAssignment(selectedAgent.id, draftIndex)}
                  style={{ padding: "7px 10px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(59,130,246,0.22)", color: "inherit", cursor: draftIndex === null ? "default" : "pointer" }}
                >
                  Save
                </button>
              ) : null}
              {selectedAgent ? (
                <button
                  type="button"
                  disabled={savingAgentId === selectedAgent.id || assets.length === 0}
                  onClick={() => {
                    const next = randomIndex();
                    if (next !== null) setDraftIndex(next);
                  }}
                  style={{ padding: "7px 10px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.35)", background: "transparent", color: "inherit", cursor: "pointer" }}
                >
                  Random
                </button>
              ) : null}
              {selectedAgent && selectedIndex !== undefined ? (
              <button
                type="button"
                disabled={savingAgentId === selectedAgent.id}
                onClick={() => void updateAssignment(selectedAgent.id, null)}
                style={{ padding: "7px 10px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.35)", background: "transparent", color: "inherit", cursor: "pointer" }}
              >
                Reset
              </button>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
              gap: "8px",
              maxHeight: "610px",
              overflow: "auto",
              padding: "10px",
              border: "1px solid rgba(148,163,184,0.25)",
              borderRadius: 6,
              background: "rgba(15,23,42,0.3)",
            }}
          >
            {assets.map((asset) => (
              <button
                key={asset.path}
                type="button"
                disabled={!selectedAgent || savingAgentId === selectedAgent.id}
                onClick={() => setDraftIndex(asset.index)}
                title={asset.path.replace("characters/", "").replace(".png", "")}
                style={{
                  height: 82,
                  display: "grid",
                  placeItems: "center",
                  border: asset.index === visibleIndex ? "2px solid #60a5fa" : "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 6,
                  background: asset.index === visibleIndex ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.08)",
                  cursor: selectedAgent ? "pointer" : "default",
                }}
              >
                <SpritePreview url={asset.url} scale={2} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function AgentPixelsSettingsPage({ context }: PluginSettingsPageProps) {
  return (
    <main style={{ padding: 24 }}>
      <CharacterAssignmentsPanel companyId={context.companyId ?? null} />
    </main>
  );
}
