import { getContext, setContext } from "svelte";
import { type Readable, derived, readonly, writable, type Writable } from "svelte/store";
import {
  Tracio as TracioCore,
  type TracioConfig,
  type TracioError,
  type TracioInstance,
  type TracioResult,
} from "@tracio/sdk";

export interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: TracioError | null;
}

/**
 * Per-init state shared with consumers through Svelte context. Unlike a
 * module-level singleton, each `Tracio.init()` owns its own store, so re-init
 * (or a second consumer tree / SSR request) never clobbers a mounted
 * subscriber. Mirrors the React provider and Vue provide/inject.
 */
interface TracioContext {
  instance: TracioInstance;
  resultStore: Writable<QueryState<TracioResult>>;
}

const CONTEXT_KEY = Symbol("@tracio/svelte");

/**
 * Fallback for consumers that are NOT under a tree where `Tracio.init()` ran
 * during component init (e.g. `init()` called in a plain module / layout
 * script). Holds the most recent context so `useTracioResult()` still works
 * without an explicit provider. Context (per-tree) always wins when present.
 */
let lastContext: TracioContext | null = null;

function freshStore(immediate = true): Writable<QueryState<TracioResult>> {
  return writable<QueryState<TracioResult>>({
    data: undefined,
    isLoading: immediate,
    error: null,
  });
}

function bootstrapInstance(
  instance: TracioInstance,
  store: Writable<QueryState<TracioResult>>,
): void {
  instance.getResult().then(
    (data) => store.set({ data, isLoading: false, error: null }),
    (error: TracioError) => store.set({ data: undefined, isLoading: false, error }),
  );
}

/** Try to register on the current component's context; no-op outside a component. */
function trySetContext(ctx: TracioContext): void {
  try {
    setContext(CONTEXT_KEY, ctx);
  } catch {
    // Called outside component init — context unavailable; fallback covers it.
  }
}

/** Read the current tree's context, falling back to the last init. */
function resolveContext(): TracioContext | null {
  try {
    const ctx = getContext<TracioContext | undefined>(CONTEXT_KEY);
    if (ctx) return ctx;
  } catch {
    // Called outside component init — fall through to the module fallback.
  }
  return lastContext;
}

export const Tracio = {
  init(config: TracioConfig): TracioInstance {
    const instance = TracioCore.init(config);
    const resultStore = freshStore();
    const ctx: TracioContext = { instance, resultStore };

    if (typeof window !== "undefined") {
      // Browser: TracioCore.init is idempotent for the same key (returns the
      // cached instance), so getResult() resolves from cache on repeated calls
      // and this fresh per-init store gets populated.
      bootstrapInstance(instance, resultStore);
    }
    // NOTE: on the server TracioCore.init returns a fresh, un-registered
    // instance and we deliberately do NOT bootstrap — the store stays in
    // isLoading: true (the "idempotent/cached" behaviour above is browser-only).

    lastContext = ctx;
    trySetContext(ctx);
    return instance;
  },
};

/** Escape hatch: the underlying SDK instance for the current tree (parity with React/Vue). */
export function useTracio(): TracioInstance | undefined {
  return resolveContext()?.instance;
}

export interface UseTracioResultOptions {
  /**
   * When `false`, the store is not auto-populated on init; call the returned
   * `getData()` to fetch on demand (parity with FP
   * `useVisitorData({ immediate: false })`). Defaults to `true`.
   */
  immediate?: boolean;
}

export interface TracioResultStore extends Readable<QueryState<TracioResult>> {
  /** Imperatively trigger (or re-await) the result fetch. */
  getData: () => Promise<void>;
}

export function useTracioResult(options: UseTracioResultOptions = {}): TracioResultStore {
  const { immediate = true } = options;
  const ctx = resolveContext();

  if (!ctx) {
    // No instance in scope — return an inert, already-settled store.
    const inert = writable<QueryState<TracioResult>>({
      data: undefined,
      isLoading: false,
      error: null,
    });
    return Object.assign(readonly(inert), { getData: async () => undefined });
  }

  const { instance, resultStore } = ctx;

  async function getData(): Promise<void> {
    resultStore.set({ data: undefined, isLoading: true, error: null });
    try {
      const data = await instance.getResult();
      resultStore.set({ data, isLoading: false, error: null });
    } catch (error) {
      resultStore.set({ data: undefined, isLoading: false, error: error as TracioError });
    }
  }

  if (!immediate) {
    // Deferred: clear the eager loading state from init()'s bootstrap.
    resultStore.set({ data: undefined, isLoading: false, error: null });
  }

  // Return a real read-only store (derived), not a hand-rolled { subscribe }.
  const store = derived(resultStore, ($s) => $s);
  return Object.assign(store, { getData });
}

export function useVisitorId(): Readable<QueryState<string>> {
  const ctx = resolveContext();
  if (!ctx) {
    return readonly(
      writable<QueryState<string>>({ data: undefined, isLoading: false, error: null }),
    );
  }
  return derived(ctx.resultStore, ($s) => ({
    data: $s.data?.visitorId,
    isLoading: $s.isLoading,
    error: $s.error,
  }));
}

export { TracioError, isTracioError, isRetryableError } from "@tracio/sdk";
export type { TracioConfig, TracioErrorCode, TracioInstance, TracioResult } from "@tracio/sdk";
