import { describe, expect, it } from "vitest";

import type { ListItemRow } from "@/lib/lists/items";
import {
  applyListItemChange,
  formatAddedByLabel,
  isUuid,
  mapRealtimeRowToListItem,
  optimisticCreateItem,
  optimisticDeleteItem,
  optimisticUpdateItem,
  serializeListItemsSnapshot,
} from "@/lib/lists/sync";

const baseItem: ListItemRow = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "list-1",
  name: "Arroz",
  quantity: 2,
  unit: "kg",
  createdBy: "user-1",
  createdAt: "2026-08-08T12:00:00.000Z",
};

describe("list item sync helpers", () => {
  it("validates uuid strings", () => {
    expect(isUuid(baseItem.id)).toBe(true);
    expect(isUuid("item-1")).toBe(false);
  });

  it("maps realtime rows and ignores incomplete payloads", () => {
    expect(
      mapRealtimeRowToListItem({
        id: baseItem.id,
        list_id: baseItem.listId,
        name: baseItem.name,
        quantity: "2.5",
        unit: "kg",
        created_by: "user-1",
        created_at: baseItem.createdAt,
      }),
    ).toEqual({
      ...baseItem,
      quantity: 2.5,
    });

    expect(mapRealtimeRowToListItem({ id: baseItem.id, name: "Arroz" })).toBeNull();
  });

  it("applies insert update and delete idempotently", () => {
    const inserted = applyListItemChange([], {
      eventType: "INSERT",
      new: {
        id: baseItem.id,
        list_id: baseItem.listId,
        name: baseItem.name,
        quantity: baseItem.quantity,
        unit: baseItem.unit,
        created_by: baseItem.createdBy,
        created_at: baseItem.createdAt,
      },
      old: null,
    });

    expect(inserted).toHaveLength(1);

    const duplicateInsert = applyListItemChange(inserted, {
      eventType: "INSERT",
      new: {
        id: baseItem.id,
        list_id: baseItem.listId,
        name: baseItem.name,
        quantity: baseItem.quantity,
        unit: baseItem.unit,
        created_by: baseItem.createdBy,
        created_at: baseItem.createdAt,
      },
      old: null,
    });
    expect(duplicateInsert).toHaveLength(1);

    const updated = applyListItemChange(inserted, {
      eventType: "UPDATE",
      new: {
        id: baseItem.id,
        list_id: baseItem.listId,
        name: "Arroz integral",
        quantity: 3,
        unit: "kg",
        created_by: baseItem.createdBy,
        created_at: baseItem.createdAt,
      },
      old: { id: baseItem.id },
    });
    expect(updated[0]?.name).toBe("Arroz integral");
    expect(updated[0]?.quantity).toBe(3);

    const deleted = applyListItemChange(updated, {
      eventType: "DELETE",
      new: null,
      old: { id: baseItem.id },
    });
    expect(deleted).toEqual([]);

    const deleteAgain = applyListItemChange(deleted, {
      eventType: "DELETE",
      new: null,
      old: { id: baseItem.id },
    });
    expect(deleteAgain).toEqual([]);
  });

  it("supports optimistic create update and delete", () => {
    const created = optimisticCreateItem([], baseItem);
    expect(created).toEqual([baseItem]);

    const patched = optimisticUpdateItem(created, baseItem.id, {
      name: "Feijão",
      quantity: 1,
      unit: null,
    });
    expect(patched[0]).toMatchObject({ name: "Feijão", quantity: 1, unit: null });

    expect(optimisticDeleteItem(patched, baseItem.id)).toEqual([]);
  });

  it("serializes snapshots for prop reconciliation", () => {
    expect(serializeListItemsSnapshot([baseItem])).toContain(baseItem.id);
    expect(serializeListItemsSnapshot([baseItem])).not.toBe(serializeListItemsSnapshot([]));
  });

  it("formats added-by labels", () => {
    expect(formatAddedByLabel("user-1", { "user-1": "Ana" })).toBe("Adicionado por Ana");
    expect(formatAddedByLabel("user-1", { "user-1": "  " })).toBe("Adicionado por membro");
    expect(formatAddedByLabel(null, {})).toBeNull();
  });
});
