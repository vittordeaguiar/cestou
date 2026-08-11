import { describe, expect, it } from "vitest";

import type { ListItemRow } from "@/lib/lists/items";
import {
  applyListItemChange,
  formatAddedByLabel,
  isUuid,
  mapRealtimeRowToListItem,
  mergeServerListItems,
  optimisticCreateItem,
  optimisticDeleteItem,
  optimisticSetPurchased,
  optimisticUpdateItem,
  serializeListItemsSnapshot,
} from "@/lib/lists/sync";

const baseItem: ListItemRow = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "list-1",
  name: "Arroz",
  quantity: 2,
  unit: "kg",
  category: null,
  purchased: false,
  createdBy: "user-1",
  createdAt: "2026-08-08T12:00:00.000Z",
};

describe("list item sync helpers", () => {
  it("validates uuid strings", () => {
    expect(isUuid(baseItem.id)).toBe(true);
    expect(isUuid("item-1")).toBe(false);
  });

  it("maps realtime rows including purchased and category and ignores incomplete payloads", () => {
    expect(
      mapRealtimeRowToListItem({
        id: baseItem.id,
        list_id: baseItem.listId,
        name: baseItem.name,
        quantity: "2.5",
        unit: "kg",
        category: "mercado",
        purchased: true,
        created_by: "user-1",
        created_at: baseItem.createdAt,
      }),
    ).toEqual({
      ...baseItem,
      quantity: 2.5,
      category: "mercado",
      purchased: true,
    });

    expect(
      mapRealtimeRowToListItem({
        id: baseItem.id,
        list_id: baseItem.listId,
        name: baseItem.name,
        quantity: 1,
        created_at: baseItem.createdAt,
      }),
    ).toMatchObject({ purchased: false, category: null });

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
        purchased: false,
        created_by: baseItem.createdBy,
        created_at: baseItem.createdAt,
      },
      old: null,
    });

    expect(inserted).toHaveLength(1);

    const updated = applyListItemChange(inserted, {
      eventType: "UPDATE",
      new: {
        id: baseItem.id,
        list_id: baseItem.listId,
        name: "Arroz integral",
        quantity: 3,
        unit: "kg",
        category: "outro",
        purchased: true,
        created_by: baseItem.createdBy,
        created_at: baseItem.createdAt,
      },
      old: { id: baseItem.id },
    });
    expect(updated[0]?.name).toBe("Arroz integral");
    expect(updated[0]?.category).toBe("outro");
    expect(updated[0]?.purchased).toBe(true);

    const deleted = applyListItemChange(updated, {
      eventType: "DELETE",
      new: null,
      old: { id: baseItem.id },
    });
    expect(deleted).toEqual([]);
  });

  it("supports optimistic create update purchased and delete", () => {
    const created = optimisticCreateItem([], baseItem);
    expect(created).toEqual([baseItem]);

    const patched = optimisticUpdateItem(created, baseItem.id, {
      name: "Feijão",
      quantity: 1,
      unit: null,
      category: "mercado",
    });
    expect(patched[0]).toMatchObject({
      name: "Feijão",
      quantity: 1,
      unit: null,
      category: "mercado",
    });

    const purchased = optimisticSetPurchased(patched, baseItem.id, true);
    expect(purchased[0]?.purchased).toBe(true);

    expect(optimisticDeleteItem(purchased, baseItem.id)).toEqual([]);
  });

  it("serializes snapshots including purchased and category state", () => {
    expect(serializeListItemsSnapshot([baseItem])).toContain(":0:");
    expect(serializeListItemsSnapshot([{ ...baseItem, purchased: true }])).toContain(":1:");
    expect(serializeListItemsSnapshot([baseItem])).not.toBe(
      serializeListItemsSnapshot([{ ...baseItem, purchased: true }]),
    );
    expect(serializeListItemsSnapshot([{ ...baseItem, category: "farmacia" }])).toContain(
      ":farmacia:",
    );
  });

  it("formats added-by labels", () => {
    expect(formatAddedByLabel("user-1", { "user-1": "Ana" })).toBe("Adicionado por Ana");
    expect(formatAddedByLabel("user-1", { "user-1": "  " })).toBe("Adicionado por membro");
    expect(formatAddedByLabel(null, {})).toBeNull();
  });

  it("merges server snapshots with in-flight local rows", () => {
    const pendingCreate: ListItemRow = {
      ...baseItem,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Leite",
      createdAt: "2026-08-08T12:01:00.000Z",
    };
    const serverOnly: ListItemRow = {
      ...baseItem,
      name: "Arroz integral",
    };

    const merged = mergeServerListItems(
      [pendingCreate],
      [serverOnly, { ...baseItem, id: "33333333-3333-4333-8333-333333333333", name: "Gone" }],
      new Set(["33333333-3333-4333-8333-333333333333"]),
    );

    expect(merged.map((item) => item.id)).toEqual([serverOnly.id, pendingCreate.id]);
  });

  it("keeps in-flight purchased toggles when catching up from the server", () => {
    const localToggle: ListItemRow = { ...baseItem, purchased: true };
    const staleServer: ListItemRow = { ...baseItem, purchased: false };

    const merged = mergeServerListItems([localToggle], [staleServer], new Set([baseItem.id]));

    expect(merged).toEqual([localToggle]);
  });
});
