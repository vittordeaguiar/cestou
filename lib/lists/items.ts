import type { SupabaseClient } from "@supabase/supabase-js";

import { isItemCategory } from "@/lib/lists/category";
import type { ItemCategory } from "@/types";
import type { Database } from "@/types/database";

export type ListItemRow = {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: ItemCategory | null;
  purchased: boolean;
  createdBy: string | null;
  createdAt: string;
};

type ListItemRecord = {
  id: string;
  list_id: string;
  name: string;
  quantity: number | string;
  unit: string | null;
  category: string | null;
  purchased: boolean;
  created_by: string | null;
  created_at: string;
};

function readCategory(value: string | null): ItemCategory | null {
  return isItemCategory(value) ? value : null;
}

export function mapListItemRecord(item: ListItemRecord): ListItemRow {
  return {
    id: item.id,
    listId: item.list_id,
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    category: readCategory(item.category),
    purchased: Boolean(item.purchased),
    createdBy: item.created_by,
    createdAt: item.created_at,
  };
}

export function sortListItemsByCreatedAt(items: ListItemRow[]): ListItemRow[] {
  return items.slice().sort((left, right) => {
    const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
    return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
  });
}

export function partitionListItems(items: ListItemRow[]): {
  pending: ListItemRow[];
  purchased: ListItemRow[];
} {
  const pending: ListItemRow[] = [];
  const purchased: ListItemRow[] = [];

  for (const item of items) {
    if (item.purchased) {
      purchased.push(item);
    } else {
      pending.push(item);
    }
  }

  return {
    pending: sortListItemsByCreatedAt(pending),
    purchased: sortListItemsByCreatedAt(purchased),
  };
}

export async function listActiveListItems(
  supabase: SupabaseClient<Database>,
  listId: string,
): Promise<ListItemRow[]> {
  const { data, error } = await supabase
    .from("list_items")
    .select("id, list_id, name, quantity, unit, category, purchased, created_by, created_at")
    .eq("list_id", listId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((item) => mapListItemRecord(item));
}

export function formatItemQuantity(quantity: number, unit: string | null): string {
  const quantityLabel = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  return unit ? `${quantityLabel} ${unit}` : quantityLabel;
}
