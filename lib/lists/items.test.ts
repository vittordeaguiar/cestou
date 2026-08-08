import { describe, expect, it } from "vitest";

import { formatItemQuantity } from "@/lib/lists/items";

describe("formatItemQuantity", () => {
  it("formats quantity with optional unit", () => {
    expect(formatItemQuantity(2, null)).toBe("2");
    expect(formatItemQuantity(1.5, "kg")).toBe("1,5 kg");
  });
});
