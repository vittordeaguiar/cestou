import { describe, expect, it } from "vitest";

import {
  filterListItemsByCategory,
  formatItemCategory,
  isItemCategory,
} from "@/lib/lists/category";
import type { ListItemRow } from "@/lib/lists/items";

const mercadoItem: ListItemRow = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "list-1",
  name: "Arroz",
  quantity: 2,
  unit: "kg",
  category: "mercado",
  purchased: false,
  createdBy: "user-1",
  createdAt: "2026-08-08T12:00:00.000Z",
};

const uncategorizedItem: ListItemRow = {
  ...mercadoItem,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Vitaminas",
  category: null,
};

describe("category helpers", () => {
  it("recognizes valid categories and formats labels", () => {
    expect(isItemCategory("mercado")).toBe(true);
    expect(isItemCategory("farmacia")).toBe(true);
    expect(isItemCategory("outro")).toBe(true);
    expect(isItemCategory("")).toBe(false);
    expect(isItemCategory("padaria")).toBe(false);
    expect(formatItemCategory("farmacia")).toBe("Farmácia");
  });

  it("filters items by category including uncategorized", () => {
    const items = [mercadoItem, uncategorizedItem];
    expect(filterListItemsByCategory(items, "all")).toEqual(items);
    expect(filterListItemsByCategory(items, "mercado")).toEqual([mercadoItem]);
    expect(filterListItemsByCategory(items, "none")).toEqual([uncategorizedItem]);
    expect(filterListItemsByCategory(items, "farmacia")).toEqual([]);
  });
});
