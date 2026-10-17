import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/server", () => ({ getValidationTranslator: async () => (key: string) => `t:${key}` }));

import { parseForm } from "@/lib/forms-server";

const schema = z.object({ name: z.string().min(1, "x.nameRequired"), qty: z.coerce.number({ error: "x.qtyNumber" }) });

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("parseForm", () => {
  it("returns the parsed input and the raw values of the named fields only", async () => {
    const result = await parseForm(schema, form({ name: "Gula", qty: "2", other: "ignored" }), ["name", "qty"]);
    expect(result).toEqual({ values: { name: "Gula", qty: "2" }, input: { name: "Gula", qty: 2 }, error: undefined });
  });

  it("returns translated field errors with the values echoed", async () => {
    const result = await parseForm(schema, form({ name: "", qty: "2" }), ["name", "qty"]);
    expect(result.input).toBeUndefined();
    expect(result.error).toEqual({ fieldErrors: { name: ["t:x.nameRequired"] }, values: { name: "", qty: "2" } });
  });
});
