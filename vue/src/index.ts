import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  type App,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  Tracio,
  type TracioConfig,
  type TracioError,
  type TracioInstance,
  type TracioResult,
} from "@tracio/sdk";

const TracioKey: InjectionKey<TracioInstance> = Symbol("@tracio/vue");

/**
 * Plugin options. Accepts either a flat {@link TracioConfig} (e.g. `{ publicKey }`)
 * or a nested `{ config }` form, mirroring the React `<TracioProvider>` contract
 * (`{ publicKey } | { config }`).
 */
export type TracioPluginOptions = TracioConfig | { config: TracioConfig };

function resolveConfig(options: TracioPluginOptions): TracioConfig {
  return "config" in options ? options.config : options;
}

export const TracioPlugin = {
  install(app: App, options: TracioPluginOptions): void {
    const inst = Tracio.init(resolveConfig(options));
    app.provide(TracioKey, inst);

    // Tear down the instance when the app unmounts so we don't leak the
    // injected instance / any in-flight fetch (mirrors the React sibling,
    // which calls inst.destroy() in its effect cleanup).
    const appWithHook = app as App & { onUnmount?: (cb: () => void) => void };
    if (typeof appWithHook.onUnmount === "function") {
      // Vue 3.5+
      appWithHook.onUnmount(() => inst.destroy());
    } else {
      // Older Vue (peer floor ^3.4): wrap unmount() to run our teardown.
      const originalUnmount = app.unmount.bind(app);
      app.unmount = () => {
        inst.destroy();
        originalUnmount();
      };
    }
  },
};

export function useTracio(): TracioInstance | undefined {
  return inject(TracioKey);
}

export interface QueryState<T> {
  data: Ref<T | null>;
  isLoading: Ref<boolean>;
  error: Ref<TracioError | null>;
  /** True once the fetch has settled (resolved or rejected). */
  isFetched: Ref<boolean>;
  /** Imperatively trigger (or re-await) the result fetch. */
  getData: () => Promise<void>;
}

export interface UseTracioResultOptions {
  /**
   * When `false`, the result is not fetched on mount; call `getData()` to
   * fetch on demand (parity with FP `useVisitorData({ immediate: false })`).
   * Defaults to `true`.
   */
  immediate?: boolean;
}

export function useTracioResult(options: UseTracioResultOptions = {}): QueryState<TracioResult> {
  const { immediate = true } = options;
  const tracio = useTracio();
  const data = ref<TracioResult | null>(null);
  const isLoading = ref(immediate);
  const error = ref<TracioError | null>(null);
  const isFetched = ref(false);

  // Guard against a late getResult() resolving after the component unmounts
  // and writing to a stale ref.
  let cancelled = false;
  onUnmounted(() => {
    cancelled = true;
  });

  async function getData(): Promise<void> {
    if (!tracio) {
      if (!cancelled) {
        isLoading.value = false;
        isFetched.value = true;
      }
      return;
    }
    if (!cancelled) {
      isLoading.value = true;
      error.value = null;
    }
    try {
      const result = await tracio.getResult();
      if (!cancelled) data.value = result;
    } catch (e) {
      if (!cancelled) error.value = e as TracioError;
    } finally {
      if (!cancelled) {
        isLoading.value = false;
        isFetched.value = true;
      }
    }
  }

  onMounted(() => {
    if (immediate) void getData();
  });

  return { data, isLoading, error, isFetched, getData };
}

export interface VisitorIdState {
  data: Ref<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<TracioError | null>;
  isFetched: Ref<boolean>;
  getData: () => Promise<void>;
}

export function useVisitorId(options: UseTracioResultOptions = {}): VisitorIdState {
  const { data, isLoading, error, isFetched, getData } = useTracioResult(options);
  const visitorId = computed(() => data.value?.visitorId ?? null);
  return { data: visitorId, isLoading, error, isFetched, getData };
}

export { TracioError, isTracioError, isRetryableError } from "@tracio/sdk";
export type { TracioConfig, TracioErrorCode, TracioInstance, TracioResult } from "@tracio/sdk";
