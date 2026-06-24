import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

describe("agent-pixels manifest", () => {
  it("keeps manifest.version in sync with package.json's version", () => {
    expect(manifest.version).toBe(packageJson.version);
  });

  it("targets plugin api version 1", () => {
    expect(manifest.apiVersion).toBe(1);
  });

  it("uses a lowercase-uuid-shaped id (works around a host bug serving non-uuid plugin ids)", () => {
    expect(manifest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("declares the capabilities its UI slots rely on", () => {
    expect(manifest.capabilities).toContain("ui.sidebar.register");
    expect(manifest.capabilities).toContain("ui.page.register");
  });

  it("points entrypoints at the built worker and ui bundles", () => {
    expect(manifest.entrypoints.worker).toBe("./dist/worker.js");
    expect(manifest.entrypoints.ui).toBe("./dist/ui");
  });
});
