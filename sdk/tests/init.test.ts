import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TracioError } from "../src/errors.js";
import { Tracio } from "../src/init.js";
import { getRegistry } from "../src/registry.js";

describe("Tracio.init", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-init",
            request_id: "req-init",
            bot: { detected: false, confidence: 0.0 },
          }),
      }),
    };
  });

  afterEach(() => {
    for (const inst of getRegistry().values()) inst.destroy();
    getRegistry().clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("создаёт TracioInstance с валидным publicKey", () => {
    const inst = Tracio.init({ publicKey: "tracio_pk_a" });
    expect(inst.publicKey).toBe("tracio_pk_a");
    expect(inst.destroyed).toBe(false);
  });

  it("повторный init с тем же publicKey возвращает тот же instance", () => {
    const a = Tracio.init({ publicKey: "tracio_pk_same" });
    const b = Tracio.init({ publicKey: "tracio_pk_same" });
    expect(a).toBe(b);
  });

  it("init с другим publicKey бросает 'multiple_keys'", () => {
    Tracio.init({ publicKey: "tracio_pk_first" });
    expect(() => Tracio.init({ publicKey: "tracio_pk_second" })).toThrow(TracioError);
    try {
      Tracio.init({ publicKey: "tracio_pk_second" });
    } catch (e) {
      expect((e as TracioError).code).toBe("multiple_keys");
    }
  });

  it("init без publicKey бросает 'invalid_config'", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => Tracio.init({} as any)).toThrow(TracioError);
  });

  it("destroy() освобождает registry — новый init с другим ключом проходит", () => {
    const a = Tracio.init({ publicKey: "tracio_pk_one" });
    a.destroy();
    const b = Tracio.init({ publicKey: "tracio_pk_two" });
    expect(b.publicKey).toBe("tracio_pk_two");
  });

  it("destroy() освобождает registry — init с тем же ключом создаёт новый instance", () => {
    const a = Tracio.init({ publicKey: "tracio_pk_recycle" });
    a.destroy();
    const b = Tracio.init({ publicKey: "tracio_pk_recycle" });
    expect(b).not.toBe(a);
    expect(b.destroyed).toBe(false);
  });

  it("init с другим ключом когда существующий instance уже destroyed — очищает мёртвый registry", () => {
    // First init creates an instance with key_alpha, then we destroy it manually
    // without going through Tracio.init's wrapped destroy (to leave a destroyed entry in registry).
    const a = Tracio.init({ publicKey: "tracio_pk_alpha" });
    // Call the original destroy (which removes from registry via the wrapper)
    // We need to simulate a destroyed entry that's still in the registry.
    // Access registry directly and re-add the destroyed instance.
    const registry = getRegistry();
    registry.set("tracio_pk_alpha", a);
    // Mark it destroyed without calling the wrapped destroy
    a.destroyed = true;

    // Now init with a different key — should clean up the dead "alpha" entry and succeed
    const b = Tracio.init({ publicKey: "tracio_pk_beta" });
    expect(b.publicKey).toBe("tracio_pk_beta");
    expect(registry.has("tracio_pk_alpha")).toBe(false);
  });

  it("повторный init с тем же уничтоженным ключом (через registry) создаёт новый instance", () => {
    const a = Tracio.init({ publicKey: "tracio_pk_reuse" });
    const registry = getRegistry();
    // Simulate: instance in registry but already destroyed
    registry.set("tracio_pk_reuse", a);
    a.destroyed = true;

    const b = Tracio.init({ publicKey: "tracio_pk_reuse" });
    expect(b).not.toBe(a);
    expect(b.destroyed).toBe(false);
  });
});
