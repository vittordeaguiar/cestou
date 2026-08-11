import type { ItemCategory } from "@/types";
import type { ListItemRow } from "@/lib/lists/items";

export const ITEM_CATEGORIES = [
  "mercado",
  "farmacia",
  "outro",
] as const satisfies readonly ItemCategory[];

export type CategoryFilter = "all" | ItemCategory | "none";

export const CATEGORY_FILTER_OPTIONS: ReadonlyArray<{
  value: CategoryFilter;
  label: string;
}> = [
  { value: "all", label: "Todas" },
  { value: "mercado", label: "Mercado" },
  { value: "farmacia", label: "Farmácia" },
  { value: "outro", label: "Outro" },
  { value: "none", label: "Sem categoria" },
];

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  mercado: "Mercado",
  farmacia: "Farmácia",
  outro: "Outro",
};

export function isItemCategory(value: unknown): value is ItemCategory {
  return value === "mercado" || value === "farmacia" || value === "outro";
}

export function formatItemCategory(category: ItemCategory): string {
  return CATEGORY_LABELS[category];
}

export function filterListItemsByCategory(
  items: ListItemRow[],
  filter: CategoryFilter,
): ListItemRow[] {
  if (filter === "all") {
    return items;
  }

  if (filter === "none") {
    return items.filter((item) => item.category === null);
  }

  return items.filter((item) => item.category === filter);
}
