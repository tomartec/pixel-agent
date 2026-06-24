import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

// Lowercase-UUID plugin id (not the dot-namespaced "agent-pixels.camera" we used
// to ship). Paperclip's `/_plugins/:pluginId/ui/*` static route tries
// `registry.getById` (a uuid-typed column) before falling back to
// `registry.getByKey`; its catch only swallows Postgres' invalid-uuid-syntax
// error when the code surfaces directly on the thrown error, but Drizzle nests
// it under `error.cause.code`, so the catch rethrows and the route 500s for any
// non-uuid plugin id. Using a uuid-shaped id avoids the Postgres syntax error
// entirely, so `getById` returns null cleanly and the working `getByKey`
// fallback runs. See https://github.com/paperclipai/paperclip — bug report
// pending. Revert to a readable id once paperclipai/paperclip fixes the catch.
export const PLUGIN_ID = "4d696994-e10d-4a05-a063-ca8b6e95de80";
export const PLUGIN_VERSION = "2026.624.0";
export const PAGE_ROUTE = "agent-pixels";

export const SLOT_IDS = {
  sidebar: "agent-pixels-sidebar",
  page: "agent-pixels-camera-page",
  settingsPage: "agent-pixels-settings-page",
} as const;

export const EXPORT_NAMES = {
  sidebar: "AgentPixelsSidebarLink",
  page: "AgentPixelsCameraPage",
  settingsPage: "AgentPixelsSettingsPage",
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Agent Pixels",
  description: "Security camera style pixel office view for Paperclip companies.",
  author: "Garratt Campton",
  categories: ["ui"],
  capabilities: [
    "companies.read",
    "agents.read",
    "instance.settings.register",
    "ui.sidebar.register",
    "ui.page.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "sidebar",
        id: SLOT_IDS.sidebar,
        displayName: "Agent Pixels",
        exportName: EXPORT_NAMES.sidebar,
      },
      {
        type: "page",
        id: SLOT_IDS.page,
        displayName: "Agent Pixels",
        exportName: EXPORT_NAMES.page,
        routePath: PAGE_ROUTE,
      },
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Agent Pixels Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
};

export default manifest;
