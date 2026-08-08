import { describe, expect, it } from "vitest";

import { formatItemQuantity, partitionListItems, type ListItemRow } from "@/lib/lists/items";

const pendingItem: ListItemRow = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "list-1",
  name: "Arroz",
  quantity: 2,
  unit: "kg",
  purchased: false,
  createdBy: "user-1",
  createdAt: "2026-08-08T12:00:00.000Z",
};

const purchasedItem: ListItemRow = {
  ...pendingItem,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Feijão",
  purchased: true,
  createdAt: "2026-08-08T12:01:00.000Z",
};

describe("formatItemQuantity", () => {
  it("formats quantity with optional unit", () => {
    expect(formatItemQuantity(2, null)).toBe("2");
    expect(formatItemQuantity(1.5, "kg")).toBe("1,5 kg");
  });
});

describe("partitionListItems", () => {
  it("splits pending and purchased items", () => {
    const result = partitionListItems([purchasedItem, pendingItem]);
    expect(result.pending).toEqual([pendingItem]);
    expect(result.purchased).toEqual([purchasedItem]);
  });
});
