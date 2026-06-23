import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
import { buildAssetIndex } from "./scripts/asset-index.mjs";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });

/** Copy public/assets and emit the asset index once the UI bundle is written. */
const assetIndexPlugin = {
  name: "agent-pixels-asset-index",
  async writeBundle() {
    await buildAssetIndex();
  },
};

function withPlugins(config, extraPlugins = []) {
  if (!config) return null;
  return {
    ...config,
    plugins: [
      nodeResolve({
        extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
      }),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
      ...extraPlugins,
    ],
  };
}

export default [
  withPlugins(presets.rollup.manifest),
  withPlugins(presets.rollup.worker),
  withPlugins(presets.rollup.ui, [assetIndexPlugin]),
].filter(Boolean);
