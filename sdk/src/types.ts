/**
 * Region shorthand. Resolves to an edge endpoint internally
 * (e.g. `us` → `https://edge.us.tracio.ai`). For self-host / proxy
 * use the `endpoint` escape hatch instead.
 */
export type TracioRegion = "us" | "eu";

export interface TracioConfig {
  /** Public API key — starts with `tracio_pk_`. Required. */
  publicKey: string;
  /**
   * Region shorthand that resolves to an edge endpoint internally.
   * Ignored when `endpoint` is provided (explicit URL wins).
   */
  region?: TracioRegion;
  /** Base URL of the edge server. Defaults to `https://edge.tracio.ai`. */
  endpoint?: string;
  /** Full override URL for `<script src=…>`. Escape hatch for SRI / self-host. */
  scriptUrl?: string;
  /**
   * Stable identifier you control (user id, account id …). Forwarded to the
   * edge so events can be linked. Additive — edge may currently ignore it.
   */
  linkedId?: string;
  /**
   * Free-form label attached to the identification request (e.g. `checkout`,
   * `login`). Additive — edge may currently ignore it.
   */
  tag?: string;
  /** When `true`, logs the script lifecycle and network activity to the console. Defaults to `false`. */
  debug?: boolean;
  /** Timeout for the full `getResult()`. Defaults to 8000 ms. */
  timeoutMs?: number;
}

export interface TracioBotInfo {
  detected: boolean;
  /** 0–100 (float, aligned with RiskScore). */
  confidence: number;
  reasons?: string[];
}

export interface TracioResult {
  visitorId: string;
  requestId: string;
  bot: TracioBotInfo;
}
