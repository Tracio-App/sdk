import type { TracioInstance } from "./instance.js";

const REGISTRY_SYMBOL = Symbol.for("tracio.registry.v1");

export type TracioRegistry = Map<string, TracioInstance>;

interface GlobalWithRegistry {
  [REGISTRY_SYMBOL]?: TracioRegistry;
}

export function getRegistry(): TracioRegistry {
  const g = globalThis as GlobalWithRegistry;
  if (!g[REGISTRY_SYMBOL]) {
    g[REGISTRY_SYMBOL] = new Map();
  }
  return g[REGISTRY_SYMBOL];
}
