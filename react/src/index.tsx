import {
  createContext,
  useMemo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Tracio,
  TracioError,
  isTracioError,
  type AssertWrapperCoversConfig,
  type TracioConfig,
  type TracioInstance,
  type TracioRegion,
  type TracioResult,
} from "@tracio/sdk";

interface TracioContextValue {
  tracio: TracioInstance | null;
  /**
   * Set when the provider decided it will never produce an instance — today
   * only "no publicKey". Without it `tracio: null` is ambiguous: consumers
   * cannot tell "still mounting" from "never coming", so a missing key showed
   * up as a spinner that span forever with `error === null` and a clean console.
   */
  unavailable: TracioError | null;
}

const TracioContext = createContext<TracioContextValue>({ tracio: null, unavailable: null });

export interface TracioProviderProps {
  publicKey?: string;
  /** Full config object. Takes precedence over the flat scalar props below. */
  config?: TracioConfig;
  /** Flat scalar props — convenient alternative to passing a `config` object. */
  region?: TracioRegion;
  endpoint?: string;
  scriptUrl?: string;
  /**
   * Your internal account/user id for the signed-in user. Powers account
   * linking (Connections, fraud rings) — omitting it silently disables them.
   */
  linkedId?: string;
  /** Type of `linkedId` for the signed trust level (`email` | `phone`). */
  linkedIdType?: "email" | "phone" | "opaque";
  /** Server-computed HMAC-SHA256 signature of the raw `linkedId`. */
  linkedIdSig?: string;
  tag?: string;
  /**
   * Custom fields attached to every event of this page load (string → string).
   * Forwarded as `data-tracio-fields` on the injected script — see the core
   * `TracioConfig.fields` docs for limits. Compared by value, so an inline
   * object literal is fine and does not re-init the SDK on every render.
   */
  fields?: Record<string, string>;
  debug?: boolean;
  timeoutMs?: number;
  children: ReactNode;
}

/**
 * Guard against a repeat: this provider is the only wrapper that rebuilds the
 * config field by field instead of forwarding the object as a whole. That is
 * exactly how `linkedId`, then `tag` and `region`, once went missing here: a
 * field was added to the core, the enumeration below was not updated, and
 * nothing broke — account linking just silently stopped working.
 *
 * This assignment stops compiling as soon as TracioConfig gains a field that
 * TracioProviderProps lacks. The check lives in source, not in tests, so it
 * fails both `pnpm typecheck` and `pnpm build`.
 */
const _configCoverage: AssertWrapperCoversConfig<TracioProviderProps> = true;
void _configCoverage;

/**
 * Value equality for a field map. Key ORDER must not matter (see
 * useStableFields), and a non-primitive value must be compared by CONTENT:
 * the core deliberately forwards objects to the edge, so `fields={{ meta: {…} }}`
 * is a supported input — and comparing those by reference would re-init the SDK
 * on every parent render, costing an extra recorded visit each time.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    // BigInt or a cycle: not comparable, so treat as changed. The core drops
    // such values and warns, so this cannot loop silently.
    return false;
  }
}

function sameFields(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
}

/**
 * Keep one reference per distinct field map, so an inline `fields={{ ... }}`
 * does not re-init the SDK on every render. The ref write is idempotent —
 * same input, same output — so it is safe during render.
 */
function useStableFields(
  next: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const ref = useRef<Record<string, string> | undefined>(undefined);
  if (!sameFields(ref.current, next)) ref.current = next;
  return ref.current;
}

export function TracioProvider({
  publicKey,
  config,
  region,
  endpoint,
  scriptUrl,
  linkedId,
  linkedIdType,
  linkedIdSig,
  tag,
  fields,
  debug,
  timeoutMs,
  children,
}: TracioProviderProps) {
  const [tracio, setTracio] = useState<TracioInstance | null>(null);

  // Resolve the effective public key — `config.publicKey` wins when a config object is supplied.
  // Every optional field of TracioConfig MUST be resolved here and listed in the
  // dependency array below: the config is rebuilt field by field (see the comment
  // on the effect), so a field missing from this list never reaches the core and
  // fails silently. `linkedId` was dropped this way — account linking looked
  // configured but never worked.
  const effectivePublicKey = config?.publicKey ?? publicKey;
  const effectiveRegion = config?.region ?? region;
  const effectiveEndpoint = config?.endpoint ?? endpoint;
  const effectiveScriptUrl = config?.scriptUrl ?? scriptUrl;
  const effectiveLinkedId = config?.linkedId ?? linkedId;
  const effectiveLinkedIdType = config?.linkedIdType ?? linkedIdType;
  const effectiveLinkedIdSig = config?.linkedIdSig ?? linkedIdSig;
  const effectiveTag = config?.tag ?? tag;
  // `fields` is the one non-primitive field, so it needs an identity of its own
  // for the dependency list below. That identity used to be `JSON.stringify`,
  // which cost three separate defects:
  //   - a BigInt or a circular reference threw during RENDER, taking the tree
  //     down where no error path could catch it;
  //   - the stringify/parse round-trip silently dropped `undefined` keys and
  //     turned `Date` into a string BEFORE the core saw them, so the core's
  //     warnings about exactly those cases never fired for React users;
  //   - key order became part of identity, so reordering a literal destroyed
  //     and re-initialised the SDK — a second `/s.js`, a second recorded visit.
  // Shallow comparison by value fixes all three: the map reaches the core
  // untouched, and a re-render with equal content keeps the same reference.
  const effectiveFields = useStableFields(config?.fields ?? fields);
  const effectiveDebug = config?.debug ?? debug;
  const effectiveTimeoutMs = config?.timeoutMs ?? timeoutMs;

  // A missing key is the single most common integration slip: in Next.js an
  // unset NEXT_PUBLIC_* is `undefined`, and TypeScript stays quiet because the
  // prop is optional. Name it once, loudly, instead of leaving a silent spinner.
  const unavailableReason =
    "TracioProvider: publicKey is missing — nothing will be identified. " +
    "Pass publicKey (or config.publicKey); check that your environment variable is set.";
  const unavailable = useMemo(
    () => (effectivePublicKey ? null : new TracioError("invalid_config", unavailableReason)),
    [effectivePublicKey, unavailableReason],
  );

  useEffect(() => {
    if (!effectivePublicKey) {
      // The cleanup of the previous run already destroyed that instance, so
      // leaving it in state would make the context contradict itself:
      // `tracio` pointing at a destroyed object while `unavailable` says none
      // is coming. A consumer would then keep serving results from an instance
      // that no longer exists.
      setTracio(null);
      console.error(`[tracio] ${unavailableReason}`);
      return;
    }
    const cfg: TracioConfig = {
      publicKey: effectivePublicKey,
      ...(effectiveRegion !== undefined ? { region: effectiveRegion } : {}),
      ...(effectiveEndpoint !== undefined ? { endpoint: effectiveEndpoint } : {}),
      ...(effectiveScriptUrl !== undefined ? { scriptUrl: effectiveScriptUrl } : {}),
      ...(effectiveLinkedId !== undefined ? { linkedId: effectiveLinkedId } : {}),
      ...(effectiveLinkedIdType !== undefined ? { linkedIdType: effectiveLinkedIdType } : {}),
      ...(effectiveLinkedIdSig !== undefined ? { linkedIdSig: effectiveLinkedIdSig } : {}),
      ...(effectiveTag !== undefined ? { tag: effectiveTag } : {}),
      ...(effectiveFields !== undefined ? { fields: effectiveFields } : {}),
      ...(effectiveDebug !== undefined ? { debug: effectiveDebug } : {}),
      ...(effectiveTimeoutMs !== undefined ? { timeoutMs: effectiveTimeoutMs } : {}),
    };
    const inst = Tracio.init(cfg);
    setTracio(inst);
    return () => inst.destroy();
    // Depend on the PRIMITIVE config fields, not the object identity — an inline
    // `<TracioProvider config={{...}}>` produces a fresh object every render, which
    // would otherwise destroy + re-init the SDK on each render. Every field of
    // TracioConfig is a primitive except `fields`, whose reference is kept
    // stable by useStableFields above, so the whole surface can be listed safely.
  }, [
    effectivePublicKey,
    effectiveRegion,
    effectiveEndpoint,
    effectiveScriptUrl,
    effectiveLinkedId,
    effectiveLinkedIdType,
    effectiveLinkedIdSig,
    effectiveTag,
    effectiveFields,
    effectiveDebug,
    effectiveTimeoutMs,
  ]);

  const value = useMemo(() => ({ tracio, unavailable }), [tracio, unavailable]);
  return <TracioContext.Provider value={value}>{children}</TracioContext.Provider>;
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
  const { tracio, unavailable } = useTracio();
  const [state, setState] = useState<QueryState<TracioResult> & { isFetched: boolean }>({
    data: undefined,
    isLoading: immediate,
    error: null,
    isFetched: false,
  });

  const getData = useCallback((): Promise<TracioResult> => {
    if (!tracio) {
      const err =
        unavailable ?? new TracioError("invalid_config", "Tracio instance is not available");
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
  }, [tracio, unavailable]);

  useEffect(() => {
    // The provider already knows no instance is coming (no publicKey). Settle
    // with that error instead of leaving isLoading pinned to true forever —
    // that state rendered as a spinner with error === null and nothing in the
    // console, which is the hardest possible thing to diagnose.
    if (unavailable) {
      setState({ data: undefined, isLoading: false, error: unavailable, isFetched: true });
      return;
    }
    if (!immediate || !tracio) return;
    let cancelled = false;
    // The key may arrive late (async config). Clear a stale "unavailable"
    // error before fetching, or the consumer keeps rendering "publicKey is
    // missing" for the whole request even though the key is already set.
    setState((prev) =>
      prev.error ? { data: undefined, isLoading: true, error: null, isFetched: false } : prev,
    );
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
