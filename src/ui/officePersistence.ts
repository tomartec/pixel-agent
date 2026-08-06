export type PersistedCharacter = {
  seatId: string | null;
  tileCol: number;
  tileRow: number;
  dir: number;
  palette: number;
  hueShift: number;
};

export type PersistedOffice = {
  version: 1;
  mapId: string;
  themeId: string;
  characters: Record<string, PersistedCharacter>;
};

function officeStateKey(companyId: string | null): string {
  return `agent-pixels.office-state.${companyId ?? "instance"}`;
}

export function serializeOffice(office: PersistedOffice): string {
  return JSON.stringify(office);
}

export function deserializeOffice(
  value: string | null,
  mapId: string,
  themeId: string,
): Record<string, PersistedCharacter> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<PersistedOffice>;
    if (
      parsed.version !== 1 ||
      parsed.mapId !== mapId ||
      parsed.themeId !== themeId ||
      !parsed.characters ||
      typeof parsed.characters !== "object"
    ) {
      return {};
    }
    return parsed.characters as Record<string, PersistedCharacter>;
  } catch {
    return {};
  }
}

export function readPersistedOffice(
  companyId: string | null,
  mapId: string,
  themeId: string,
): Record<string, PersistedCharacter> {
  if (typeof window === "undefined") return {};
  try {
    return deserializeOffice(window.sessionStorage.getItem(officeStateKey(companyId)), mapId, themeId);
  } catch {
    return {};
  }
}

export function writePersistedOffice(companyId: string | null, office: PersistedOffice): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(officeStateKey(companyId), serializeOffice(office));
  } catch {
    // Storage can be unavailable or full; persistence is best effort.
  }
}
