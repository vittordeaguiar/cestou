import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
} from "@/app/app/groups/list-items-actions";
import { initialListItemActionState } from "@/lib/auth/action-state";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function mockAuthedClient(options: {
  insertError?: unknown;
  updateResult?: { data: unknown; error: unknown };
  deleteResult?: { data: unknown; error: unknown };
}) {
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(
      options.updateResult ?? options.deleteResult ?? { data: { id: "item-1" }, error: null },
    );

  createClient.mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "group_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { group_id: "g1", role: "owner" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "groups") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "g1", name: "Casa" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "list-1" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return {
        insert,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        }),
      };
    }),
  });

  return { insert, maybeSingle };
}

describe("list item actions", () => {
  beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
  });

  it("rejects invalid create input before calling Supabase", async () => {
    await expect(
      createListItemAction(
        initialListItemActionState,
        formData({ groupId: "g1", name: "", quantity: "0", unit: "" }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: {
        name: "Informe o nome do item.",
        quantity: "A quantidade deve ser maior que zero.",
      },
    });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects create without a valid client item id", async () => {
    await expect(
      createListItemAction(
        initialListItemActionState,
        formData({ groupId: "g1", name: "Arroz", quantity: "1", unit: "", itemId: "bad" }),
      ),
    ).resolves.toMatchObject({ status: "error", message: "Item inválido." });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates an item on the caller active list", async () => {
    const { insert } = mockAuthedClient({});
    const itemId = "11111111-1111-4111-8111-111111111111";

    await expect(
      createListItemAction(
        initialListItemActionState,
        formData({
          groupId: "g1",
          itemId,
          name: " Arroz ",
          quantity: "2,5",
          unit: " kg ",
        }),
      ),
    ).resolves.toMatchObject({ status: "success", message: "Item adicionado." });

    expect(insert).toHaveBeenCalledWith({
      id: itemId,
      list_id: "list-1",
      name: "Arroz",
      quantity: 2.5,
      unit: "kg",
      created_by: "user-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/app/groups/g1/list");
  });

  it("updates an item belonging to the group list", async () => {
    mockAuthedClient({
      updateResult: { data: { id: "item-1" }, error: null },
    });

    await expect(
      updateListItemAction(
        initialListItemActionState,
        formData({
          groupId: "g1",
          itemId: "item-1",
          name: "Feijão",
          quantity: "1",
          unit: "kg",
        }),
      ),
    ).resolves.toMatchObject({ status: "success", message: "Item atualizado." });
  });

  it("deletes an item belonging to the group list", async () => {
    mockAuthedClient({
      deleteResult: { data: { id: "item-1" }, error: null },
    });

    await expect(
      deleteListItemAction(
        initialListItemActionState,
        formData({ groupId: "g1", itemId: "item-1" }),
      ),
    ).resolves.toMatchObject({ status: "success", message: "Item removido." });
  });

  it("blocks mutations without a session", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      },
    });

    await expect(
      deleteListItemAction(
        initialListItemActionState,
        formData({ groupId: "g1", itemId: "item-1" }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      message: "Sua sessão expirou. Entre novamente para continuar.",
    });
  });
});
