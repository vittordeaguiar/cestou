import { describe, expect, it } from "vitest";

import { getSafeNext } from "@/lib/auth/redirect";

describe("getSafeNext", () => {
  it("keeps a root-relative internal destination", () => {
    expect(getSafeNext("/profile?tab=settings")).toBe("/profile?tab=settings");
  });

  it.each([
    "",
    "profile",
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "javascript:alert(1)",
  ])("falls back for an unsafe destination: %s", (value) => {
    expect(getSafeNext(value)).toBe("/profile");
  });
});
