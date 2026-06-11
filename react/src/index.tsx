import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Tracio,
  TracioError,
  isTracioError,
  type TracioConfig,
  type TracioInstance,
  type TracioResult,
} from "@tracio/sdk";

interface TracioContextValue {
  tracio: TracioInstance | null;
}

const TracioContext = createContext<TracioContextValue>({ tracio: null });

export interface TracioProviderProps {
  publicKey?: string;
  /** Full config object. Takes precedence over the flat scalar props below. */
  config?: TracioConfig;
  /** Flat scalar props — convenient alternative to passing a `config` object. */
  endpoint?: string;
  scriptUrl?: string;
  debug?: boolean;
  timeoutMs?: number;
  children: ReactNode;
}

export function TracioProvider({
  publicKey,
  config,
  endpoint,
  scriptUrl,
  debug,
  timeoutMs,
  children,
}: TracioProviderProps) {
  const [tracio, setTracio] = useState<TracioInstance | null>(null);

  // Resolve the effective public key — `config.publicKey` wins when a config object is supplied.
  const effectivePublicKey = config?.publicKey ?? publicKey;
  const effectiveEndpoint = config?.endpoint ?? endpoint;
  const effectiveScriptUrl = config?.scriptUrl ?? scriptUrl;
  const effectiveDebug = config?.debug ?? debug;
  const effectiveTimeoutMs = config?.timeoutMs ?? timeoutMs;

  useEffect(() => {
    if (!effectivePublicKey) return;
    const cfg: TracioConfig = {
      publicKey: effectivePublicKey,
      ...(effectiveEndpoint !== undefined ? { endpoint: effectiveEndpoint } : {}),
      ...(effectiveScriptUrl !== undefined ? { scriptUrl: effectiveScriptUrl } : {}),
      ...(effectiveDebug !== undefined ? { debug: effectiveDebug } : {}),
      ...(effectiveTimeoutMs !== undefined ? { timeoutMs: effectiveTimeoutMs } : {}),
    };
    const inst = Tracio.init(cfg);
    setTracio(inst);
    return () => inst.destroy();
    // Depend on the PRIMITIVE config fields, not the object identity — an inline
    // `<TracioProvider config={{...}}>` produces a fresh object every render, which
    // would otherwise destroy + re-init the SDK on each render.
  }, [
    effectivePublicKey,
    effectiveEndpoint,
    effectiveScriptUrl,
    effectiveDebug,
    effectiveTimeoutMs,
  ]);

  return <TracioContext.Provider value={{ tracio }}>{children}</TracioContext.Provider>;
}

export function useTracio(): TracioContextValue {
  return useContext(TracioContext);
}

export interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: TracioError | null;
}

export interface UseTracioResultOptions {
  /**
   * When `true` (default) the result is fetched automatically once the instance
   * is available. When `false`, no fetch happens in the effect — call `getData()`
   * to trigger the fetch on demand (e.g. behind a consent gate or user action).
   */
  immediate?: boolean;
}

export interface UseTracioResultReturn extends QueryState<TracioResult> {
  /** `true` once a fetch has settled (resolved or rejected) at least once. */
  isFetched: boolean;
  /** Trigger a fetch on demand. Resolves with the result (or rejects on error). */
  getData: () => Promise<TracioResult>;
}

function toTracioError(error: unknown): TracioError {
  if (isTracioError(error)) return error;
  return new TracioError("server", error instanceof Error ? error.message : String(error));
}

export function useTracioResult(opts?: UseTracioResultOptions): UseTracioResultReturn {
  const immediate = opts?.immediate ?? true;
  const { tracio } = useTracio();
  const [state, setState] = useState<QueryState<TracioResult> & { isFetched: boolean }>({
    data: undefined,
    isLoading: immediate,
    error: null,
    isFetched: false,
  });

  const getData = useCallback((): Promise<TracioResult> => {
    if (!tracio) {
      const err = new TracioError("invalid_config", "Tracio instance is not available");
      setState({ data: undefined, isLoading: false, error: err, isFetched: true });
      return Promise.reject(err);
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    return tracio.getResult().then(
      (data) => {
        setState({ data, isLoading: false, error: null, isFetched: true });
        return data;
      },
      (error: unknown) => {
        const tracioError = toTracioError(error);
        setState({ data: undefined, isLoading: false, error: tracioError, isFetched: true });
        throw tracioError;
      },
    );
  }, [tracio]);

  useEffect(() => {
    if (!immediate || !tracio) return;
    let cancelled = false;
    tracio.getResult().then(
      (data) => {
        if (!cancelled) setState({ data, isLoading: false, error: null, isFetched: true });
      },
      (error: unknown) => {
        if (!cancelled) {
          const tracioError = toTracioError(error);
          setState({ data: undefined, isLoading: false, error: tracioError, isFetched: true });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tracio, immediate]);

  return { ...state, getData };
}

export function useVisitorId(opts?: UseTracioResultOptions): QueryState<string> & {
  isFetched: boolean;
  getId: () => Promise<string>;
} {
  const { data, isLoading, error, isFetched, getData } = useTracioResult(opts);
  const getId = useCallback(() => getData().then((result) => result.visitorId), [getData]);
  return {
    data: data?.visitorId,
    isLoading,
    error,
    isFetched,
    getId,
  };
}

export { TracioError, isTracioError, isRetryableError } from "@tracio/sdk";
export type { TracioConfig, TracioErrorCode, TracioInstance, TracioResult } from "@tracio/sdk";
