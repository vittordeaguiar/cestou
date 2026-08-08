import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createGroupAction } from "@/app/app/groups/actions";
import { initialGroupActionState } from "@/lib/auth/action-state";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function mockMembershipQueries(options: {
  membership?: { group_id: string; role: "owner" | "member" } | null;
  group?: { id: string; name: string } | null;
  list?: { id: string } | null;
  sequence?: Array<{
    membership?: { group_id: string; role: "owner" | "member" } | null;
    group?: { id: string; name: string } | null;
    list?: { id: string } | null;
  }>;
}) {
  const sequence = options.sequence ?? [
    {
      membership: options.membership ?? null,
      group: options.group ?? null,
      list: options.list ?? null,
    },
  ];
  let callIndex = 0;

  return {
    from: vi.fn((table: string) => {
      const current = sequence[Math.min(callIndex, sequence.length - 1)]!;

      if (table === "group_members") {
        callIndex += 1;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: current.membership ?? null,
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
                data: current.group ?? null,
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: current.list ?? null,
                error: null,
              }),
            }),
          }),
        }),
      };
    }),
  };
}

describe("createGroupAction", () => {
  beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
  });

  it("returns field errors before calling Supabase", async () => {
    await expect(
      createGroupAction(initialGroupActionState, formData({ name: "  " })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { name: "Informe o nome do grupo." },
    });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates a group and redirects to the shared list", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "group-1", name: "Família Silva" },
      error: null,
    });

    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-1" } },
          error: null,
        }),
      },
      rpc,
      ...mockMembershipQueries({
        sequence: [
          { membership: null },
          {
            membership: { group_id: "group-1", role: "owner" },
            group: { id: "group-1", name: "Família Silva" },
            list: { id: "list-1" },
          },
        ],
      }),
    });

    await expect(
      createGroupAction(initialGroupActionState, formData({ name: "  Família Silva  " })),
    ).resolves.toMatchObject({
      status: "success",
      redirectTo: "/app/groups/group-1/list",
    });

    expect(rpc).toHaveBeenCalledWith("create_group", { group_name: "Família Silva" });
    expect(revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("blocks creating a second group when the user already has one", async () => {
    const rpc = vi.fn();

    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-1" } },
          error: null,
        }),
      },
      rpc,
      ...mockMembershipQueries({
        membership: { group_id: "group-1", role: "owner" },
        group: { id: "group-1", name: "Família Silva" },
        list: { id: "list-1" },
      }),
    });

    await expect(
      createGroupAction(initialGroupActionState, formData({ name: "Outro grupo" })),
    ).resolves.toMatchObject({
      status: "success",
      redirectTo: "/app/groups/group-1/list",
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the database one-group error to a user-facing message", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "User already belongs to a group" },
      }),
      ...mockMembershipQueries({
        sequence: [{ membership: null }, { membership: null }],
      }),
    });

    await expect(
      createGroupAction(initialGroupActionState, formData({ name: "Família" })),
    ).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("apenas um"),
    });
  });
});
