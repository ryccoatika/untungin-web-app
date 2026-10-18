import { describe, expect, it } from "vitest";
import { hasAgreed, isFirstSignIn } from "@/lib/legal/consent";
import { TERMS_VERSION } from "@/lib/legal/versions";

describe("hasAgreed", () => {
  it("is false without rows", () => {
    expect(hasAgreed([], "terms")).toBe(false);
  });

  it("matches the kind at the current version", () => {
    const rows = [{ kind: "terms", version: TERMS_VERSION }];
    expect(hasAgreed(rows, "terms")).toBe(true);
    expect(hasAgreed(rows, "ai")).toBe(false);
  });

  it("is false for an older version", () => {
    expect(hasAgreed([{ kind: "terms", version: "2026-01-01" }], "terms")).toBe(false);
  });

  it("is true when an older row sits next to a current one", () => {
    const rows = [
      { kind: "terms", version: "2026-01-01" },
      { kind: "terms", version: TERMS_VERSION },
    ];
    expect(hasAgreed(rows, "terms")).toBe(true);
  });
});

describe("isFirstSignIn", () => {
  it("is true without rows", () => {
    expect(isFirstSignIn([])).toBe(true);
  });

  it("is false once a terms row exists, even an old version", () => {
    expect(isFirstSignIn([{ kind: "terms" }])).toBe(false);
  });

  it("ignores ai rows", () => {
    expect(isFirstSignIn([{ kind: "ai" }])).toBe(true);
  });
});
