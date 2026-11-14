import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(source: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.flatMap((message) => (message.ruleId ? [message.ruleId] : []));
}

describe("import boundaries", () => {
  it("blocks backend imports and ambient process/fetch in engine files, without blocking platform imports", async () => {
    const denied = await ruleIds(
      [
        'import { query } from "convex/server";',
        "void query;",
        "void process.env.PAYVRO_MODE;",
        'void fetch("https://example.invalid");',
      ].join("\n"),
      "packages/engine/__boundary-fixture__.ts",
    );
    const allowed = await ruleIds(
      ['import { webcrypto } from "node:crypto";', "void webcrypto;"].join("\n"),
      "packages/engine/__boundary-allowed__.ts",
    );

    expect(denied).toContain("no-restricted-imports");
    expect(denied.filter((ruleId) => ruleId === "no-restricted-globals")).toHaveLength(2);
    expect(allowed).not.toContain("no-restricted-imports");
    expect(allowed).not.toContain("no-restricted-globals");
  });

  it("blocks app imports from the pey client without blocking the public engine surface", async () => {
    const denied = await ruleIds(
      [
        'import { crearClientePey } from "@/packages/engine/src/pey/cliente";',
        "void crearClientePey;",
      ].join("\n"),
      "app/__boundary-fixture__.tsx",
    );
    const allowed = await ruleIds(
      ['import { aCentavos } from "@/packages/engine/src/money";', "void aCentavos;"].join("\n"),
      "app/__boundary-allowed__.tsx",
    );

    expect(denied).toContain("no-restricted-imports");
    expect(allowed).not.toContain("no-restricted-imports");
  });
});
