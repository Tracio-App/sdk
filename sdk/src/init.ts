import { TracioError } from "./errors.js";
import { TracioInstance } from "./instance.js";
import { getRegistry } from "./registry.js";
import { isBrowser } from "./ssr.js";
import type { TracioConfig } from "./types.js";

function initFactory(config: TracioConfig): TracioInstance {
  if (!isBrowser()) {
    return new TracioInstance(config);
  }

  const registry = getRegistry();
  const existing = registry.get(config.publicKey);
  if (existing && !existing.destroyed) {
    return existing;
  }
  if (registry.size > 0) {
    const otherKey = registry.keys().next().value;
    if (otherKey !== undefined && otherKey !== config.publicKey) {
      const liveOther = registry.get(otherKey);
      if (liveOther && !liveOther.destroyed) {
        throw new TracioError(
          "multiple_keys",
          `Tracio.init was called with publicKey="${config.publicKey}", but a live instance already exists with publicKey="${otherKey}". Call .destroy() on the existing instance first.`,
        );
      }
      registry.delete(otherKey);
    }
  }
  if (existing && existing.destroyed) {
    registry.delete(config.publicKey);
  }

  const instance = new TracioInstance(config);
  registry.set(config.publicKey, instance);

  const originalDestroy = instance.destroy.bind(instance);
  instance.destroy = () => {
    originalDestroy();
    registry.delete(config.publicKey);
  };

  return instance;
}

export const Tracio = {
  init: initFactory,
};
