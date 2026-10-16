import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/uuid";

describe("isUuid", () => {
  it.each([
    ["3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c", true],
    ["3F2B8C1E-9D4A-4B7E-8F21-0C5D6E7A8B9C", true],
    ["00000000-0000-0000-0000-000000000000", true],
    ["not-a-uuid", false],
    ["3f2b8c1e9d4a4b7e8f210c5d6e7a8b9c", false],
    ["3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c-extra", false],
    ["", false],
  ])("%s → %s", (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});
