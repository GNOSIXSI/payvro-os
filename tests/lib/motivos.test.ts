import { describe, expect, it } from "vitest";
import { textoDeEvento } from "../../lib/motivos";

describe("owner timeline event text", () => {
  it("names unreadable pey data without implying payment or review", () => {
    expect(textoDeEvento("pey.dato_ilegible")).toBe("Pey devolvió un dato ilegible");
  });
  it("adds no extra message for existing milestones or unknown events", () => {
    for (const tipo of ["cobro.creado", "pago.verificado", "cobro.liberado", "pey.llamada", "unknown"]) {
      expect(textoDeEvento(tipo)).toBeNull();
    }
  });
});
