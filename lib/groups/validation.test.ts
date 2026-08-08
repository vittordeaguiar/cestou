import { describe, expect, it } from "vitest";

import { validateGroupName } from "@/lib/groups/validation";

describe("validateGroupName", () => {
  it("normalizes whitespace and accepts a valid name", () => {
    expect(validateGroupName("  Família   Silva ")).toEqual({
      data: { name: "Família Silva" },
      fieldErrors: {},
    });
  });

  it("requires a non-empty name", () => {
    expect(validateGroupName("   ")).toEqual({
      fieldErrors: { name: "Informe o nome do grupo." },
    });
  });

  it("rejects names longer than 80 characters", () => {
    expect(validateGroupName("a".repeat(81)).fieldErrors.name).toMatch(/no máximo 80/);
  });
});
