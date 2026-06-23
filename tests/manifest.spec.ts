import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("agent-pixels manifest", () => {
  it("targets plugin api version 1", () => {
    expect(manifest.apiVersion).toBe(1);
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
