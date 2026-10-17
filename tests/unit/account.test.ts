import { describe, expect, it } from "vitest";
import { emailConfirmationMatches } from "@/lib/validation/account";

describe("emailConfirmationMatches", () => {
  it("accepts the account email, ignoring case and surrounding spaces", () => {
    expect(emailConfirmationMatches("  Abby@Example.com ", "abby@example.com")).toBe(true);
  });
  it.each([["", "a@b.c"], ["a@b.c", ""], ["x@b.c", "a@b.c"], ["a@b.c ", "a@b.co"]])("rejects %j for %j", (input, email) => {
    expect(emailConfirmationMatches(input, email)).toBe(false);
  });
});
