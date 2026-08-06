import { describe, expect, it } from "vitest";
import {
  deserializeOffice,
  serializeOffice,
  type PersistedOffice,
} from "../src/ui/officePersistence.js";

const office: PersistedOffice = {
  version: 1,
  mapId: "studio",
  themeId: "night",
  characters: {
    "agent-abc": { seatId: "desk-1", tileCol: 12, tileRow: 7, dir: 3, palette: 2, hueShift: 45 },
  },
};

describe("office persistence", () => {
  it("round-trips persisted characters", () => {
    expect(deserializeOffice(serializeOffice(office), "studio", "night")).toEqual(office.characters);
  });

  it("invalidates saved positions when the map changes", () => {
    expect(deserializeOffice(serializeOffice(office), "different-map", "night")).toEqual({});
  });

  it("ignores malformed JSON", () => {
    expect(deserializeOffice("{invalid", "studio", "night")).toEqual({});
  });
});
