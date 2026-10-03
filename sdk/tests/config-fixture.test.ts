import { describe, expect, it } from "vitest";
import { FULL_CONFIG } from "@tracio/internal-test-utils";

import { TRACIO_CONFIG_KEYS } from "../src/types.js";

/**
 * Страховка от рассинхрона фикстуры и контракта.
 *
 * FULL_CONFIG живёт в @tracio/internal-test-utils и НЕ типизирован через
 * TracioConfig: этот пакет не может зависеть от ядра, иначе получается цикл
 * (ядро уже зависит от него) и ломается сборка типов. Полнота фикстуры
 * проверяется здесь — в единственном пакете, который зависит от обеих сторон.
 *
 * Сверка идёт с TRACIO_CONFIG_KEYS, а не с переписанным руками списком:
 * рукописный список — ровно тот механизм, из-за которого однажды выпал
 * linkedId. Сама константа заперта с интерфейсом двусторонней проверкой типов
 * в src/types.ts, поэтому цепочка замкнута: добавили поле в TracioConfig →
 * не собирается ядро, пока не добавили в TRACIO_CONFIG_KEYS → падает этот
 * тест, пока не добавили в FULL_CONFIG → сквозные тесты обёрток начинают
 * проверять новое поле.
 */
describe("фикстура конфига покрывает контракт", () => {
  it("FULL_CONFIG содержит ровно все поля TracioConfig", () => {
    expect(Object.keys(FULL_CONFIG).sort()).toEqual([...TRACIO_CONFIG_KEYS].sort());
  });
});
