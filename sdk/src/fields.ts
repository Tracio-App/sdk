/**
 * Custom-fields normalisation: WARN, but do not silence.
 *
 * The edge is the single source of truth for field limits. Its own rule, from
 * back/edge/internal/serve/fieldsvalidate.go, is that the FIELD is rejected and
 * the event is kept: losing a visit over a malformed field is worse than losing
 * the field. A field dropped here would never reach the edge, never be counted
 * as rejected, and would leave the workspace's rejected-fields counter reading
 * zero at the exact moment something is wrong. So this module only ever WARNS
 * and passes the value through.
 *
 * The two exceptions are values that would make `JSON.stringify` throw
 * (BigInt, circular references): those must be removed, or the injected
 * `<script>` is never built and the whole visit is lost.
 */

/** Limits mirrored from back/edge/internal/serve/fieldsvalidate.go:18-22. */
const MAX_FIELDS = 50;
const MAX_KEY_BYTES = 40;
const MAX_VALUE_BYTES = 500;
const KEY_CHARSET = /^[A-Za-z0-9_.:-]+$/;
// fieldValueAllowed rejects any byte below 0x20 (fieldsvalidate.go:45-55).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f]/;

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : undefined;

/** Byte length, as Go's `len()` counts it — not UTF-16 units. */
function bytes(value: string): number {
  return encoder ? encoder.encode(value).length : value.length;
}

function warn(key: string, reason: string): void {
  console.warn(`[tracio] fields["${key}"] ${reason}`);
}

/**
 * Validate and copy the caller's field map.
 *
 * Returns a fresh object, so later mutation of the caller's map cannot reach
 * the wire (the map is serialised at inject time, long after `init`).
 * Returns `undefined` when there is nothing to send.
 */
export function normalizeFields(input: unknown): Record<string, unknown> | undefined {
  if (input === undefined) return undefined;

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    console.warn("[tracio] fields must be a plain object; the map was ignored");
    return undefined;
  }

  // Null-prototype: a key like `__proto__` must become an own property instead
  // of silently vanishing (or replacing the prototype of the map we return).
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let accepted = 0;

  // The edge walks SORTED keys and counts only the fields it keeps
  // (fieldsvalidate.go:66-77), so the cap applies to a different set than
  // insertion order would suggest. Mirror that, or the warning names the wrong
  // fields — the ones that do arrive.
  for (const key of Object.keys(input as Record<string, unknown>).sort()) {
    const value = (input as Record<string, unknown>)[key];
    const type = typeof value;

    // JSON.stringify drops these keys silently, and THROWS on bigint — which
    // would cost the whole visit, not just the field.
    if (value === undefined || type === "function" || type === "symbol") {
      warn(key, `is ${type === "undefined" ? "undefined" : type} and was not sent`);
      continue;
    }
    if (type === "bigint") {
      warn(key, "is a BigInt and was not sent; convert it to a string");
      continue;
    }

    // `keyOk` decides whether the edge would COUNT this field against the cap.
    const keyOk = KEY_CHARSET.test(key) && bytes(key) <= MAX_KEY_BYTES;
    if (!keyOk) warn(key, `has an invalid key (max ${MAX_KEY_BYTES} bytes of A-Za-z0-9_.:-)`);

    let valueOk = true;
    if (value === null) {
      // typeof null is "object", but the edge turns it into "" and rejects it —
      // so this is NOT the "stored as text" case.
      warn(key, "is null; the edge will reject it");
      valueOk = false;
    } else if (typeof value === "object") {
      // A Date (or anything with toJSON) still serialises to a scalar the edge
      // accepts — it is just not the value the caller wrote. Everything else
      // stays an object on the wire and the edge rejects it as one field.
      const json = (value as { toJSON?: unknown }).toJSON;
      if (typeof json === "function") {
        warn(key, "has toJSON; the edge stores its serialised form, not the object");
      } else {
        warn(key, "is an object; the edge takes scalars only and will reject it");
        valueOk = false;
      }
    } else if (typeof value !== "string") {
      warn(key, `is a ${type}; the edge stores it as text`);
    } else if (value === "") {
      warn(key, "is empty and the edge will reject it");
      valueOk = false;
    } else if (bytes(value) > MAX_VALUE_BYTES) {
      warn(key, `exceeds ${MAX_VALUE_BYTES} bytes`);
      valueOk = false;
    } else if (CONTROL_CHARS.test(value)) {
      // A newline out of a <textarea> is the common case here.
      warn(key, "contains a control character and the edge will reject it");
      valueOk = false;
    }

    if (keyOk && valueOk && ++accepted > MAX_FIELDS) {
      warn(key, `is past the ${MAX_FIELDS}-field cap and will not be stored`);
    }
    out[key] = value;
  }

  if (Object.keys(out).length === 0) return undefined;

  // Circular references only surface at serialisation time. Catch them here,
  // where the visit can still proceed without fields.
  try {
    JSON.stringify(out);
  } catch {
    console.warn("[tracio] fields has a circular reference; the map was ignored");
    return undefined;
  }

  return out;
}
