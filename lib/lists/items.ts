import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ListItemRow = {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string | null;
  createdBy: string | null;
  createdAt: string;
};

export async function listActiveListItems(
  supabase: SupabaseClient<Database>,
  listId: string,
): Promise<ListItemRow[]> {
  const { data, error } = await supabase
    .from("list_items")
    .select("id, list_id, name, quantity, unit, created_by, created_at")
    .eq("list_id", listId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    listId: item.list_id,
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    createdBy: item.created_by,
    createdAt: item.created_at,
  }));
}

export function formatItemQuantity(quantity: number, unit: string | null): string {
  const quantityLabel = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  return unit ? `${quantityLabel} ${unit}` : quantityLabel;
}
