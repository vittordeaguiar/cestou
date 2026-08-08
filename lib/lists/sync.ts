import type { ListItemRow } from "@/lib/lists/items";

export type ListItemChangeEvent = "INSERT" | "UPDATE" | "DELETE";

export type ListItemRealtimePayload = {
  eventType: ListItemChangeEvent;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/** Maps a postgres_changes row payload into the client list item shape. */
export function mapRealtimeRowToListItem(row: Record<string, unknown>): ListItemRow | null {
  const id = readString(row.id);
  const listId = readString(row.list_id);
  const name = readString(row.name);
  const quantity = readQuantity(row.quantity);

  if (!id || !listId || !name || quantity === null) {
    return null;
  }

  return {
    id,
    listId,
    name,
    quantity,
    unit: readString(row.unit),
    createdBy: readString(row.created_by),
    createdAt: readString(row.created_at) ?? new Date().toISOString(),
  };
}

function upsertItem(items: ListItemRow[], item: ListItemRow): ListItemRow[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return [...items, item];
  }

  const next = items.slice();
  next[index] = item;
  return next;
}

function removeItem(items: ListItemRow[], itemId: string): ListItemRow[] {
  return items.filter((item) => item.id !== itemId);
}

/** Applies a Realtime postgres_changes event to the local item list (idempotent). */
export function applyListItemChange(
  items: ListItemRow[],
  payload: ListItemRealtimePayload,
): ListItemRow[] {
  if (payload.eventType === "DELETE") {
    const oldId = readString(payload.old?.id);
    return oldId ? removeItem(items, oldId) : items;
  }

  if (!payload.new) {
    return items;
  }

  const mapped = mapRealtimeRowToListItem(payload.new);
  if (!mapped) {
    return items;
  }

  return upsertItem(items, mapped);
}

export function optimisticCreateItem(
  items: ListItemRow[],
  item: ListItemRow,
): ListItemRow[] {
  return upsertItem(items, item);
}

export function optimisticUpdateItem(
  items: ListItemRow[],
  itemId: string,
  patch: Pick<ListItemRow, "name" | "quantity" | "unit">,
): ListItemRow[] {
  return items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}

export function optimisticDeleteItem(items: ListItemRow[], itemId: string): ListItemRow[] {
  return removeItem(items, itemId);
}

/** Stable snapshot key so server props only replace local state when they actually change. */
export function serializeListItemsSnapshot(items: ListItemRow[]): string {
  return items
    .map(
      (item) =>
        `${item.id}:${item.listId}:${item.name}:${item.quantity}:${item.unit ?? ""}:${item.createdBy ?? ""}:${item.createdAt}`,
    )
    .join("|");
}

export function formatAddedByLabel(
  createdBy: string | null,
  memberNamesByUserId: Record<string, string | null | undefined>,
): string | null {
  if (!createdBy) {
    return null;
  }

  const displayName = memberNamesByUserId[createdBy]?.trim();
  if (displayName) {
    return `Adicionado por ${displayName}`;
  }

  return "Adicionado por membro";
}
