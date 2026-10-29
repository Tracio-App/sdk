/**
 * Landing-page attribution: copy a short, explicit list of URL query
 * parameters into custom fields under the `aff.` prefix.
 *
 * Nothing is collected unless the integrator names the parameters. Everything
 * else in the query string (tokens, emails, session ids) never leaves the page.
 * The result goes through `normalizeFields` like any other `fields` map, so the
 * edge limits are warned about in one place.
 */

import { CONTROL_CHARS, KEY_CHARSET, MAX_KEY_BYTES, MAX_VALUE_BYTES, bytes } from "./fields.js";

const FIELD_PREFIX = "aff.";
const MAX_PARAMS = 10;
/**
 * Build `aff.<param>` → value from `search` for the listed `params`.
 *
 * Unlike `normalizeFields`, invalid entries are DROPPED here: they come from a
 * URL the visitor controls, not from the integrator's code, so there is nothing
 * for the integrator to fix and the edge's rejected-fields counter should not
 * be fed by them. A visitor can forge any value — treat it as a hint and check
 * it on your server.
 */
export function collectAttribution(search: string, params: string[]): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  if (!Array.isArray(params) || params.length === 0) return out;

  let names = params.filter((p): p is string => typeof p === "string");
  names = [...new Set(names)];
  if (names.length > MAX_PARAMS) {
    console.warn(
      `[tracio] attribution.params lists ${names.length} names; only the first ${MAX_PARAMS} are read`,
    );
    names = names.slice(0, MAX_PARAMS);
  }

  const query = new URLSearchParams(search);

  for (const name of names) {
    const key = FIELD_PREFIX + name;
    if (!KEY_CHARSET.test(key) || bytes(key) > MAX_KEY_BYTES) continue;
    const value = query.get(name);
    if (value === null || value === "") continue;
    if (bytes(value) > MAX_VALUE_BYTES || CONTROL_CHARS.test(value)) continue;
    out[key] = value;
  }
  return out;
}
