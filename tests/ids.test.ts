import { describe, expect, it } from "vitest";
import { esId, nuevoId } from "../packages/engine/src/ids";

describe("public ids", () => {
  it("generates 10,000 unique ids with the requested prefix and Crockford alphabet", () => {
    const ids = new Set<string>();

    for (let index = 0; index < 10_000; index += 1) {
      const id = nuevoId("cob_");
      expect(id).toMatch(/^cob_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }

    expect(ids.size).toBe(10_000);
  });

  it("validates the matching prefix and rejects another prefix or malformed id", () => {
    const id = nuevoId("int_");

    expect(esId("int_", id)).toBe(true);
    expect(esId("cob_", id)).toBe(false);
    expect(esId("int_", "int_0000000000000000000000000I")).toBe(false);
    expect(esId("int_", "int_short")).toBe(false);
    expect(esId("int_", null)).toBe(false);
  });
});
