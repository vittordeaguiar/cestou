import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, revalidatePath, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import { leaveGroupAction, removeGroupMemberAction } from "@/app/app/groups/members-actions";
import { initialMemberActionState } from "@/lib/auth/action-state";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function membershipChain(result: { data: unknown; error: null }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("removeGroupMemberAction", () => {
  beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
    redirect.mockClear();
  });

  it("rejects missing session", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      },
    });

    await expect(
      removeGroupMemberAction(
        initialMemberActionState,
        formData({ groupId: "g1", memberUserId: "u2" }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      message: "Sua sessão expirou. Entre novamente para continuar.",
    });
  });

  it("blocks a non-owner from removing members", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "group_members") {
          return membershipChain({
            data: { group_id: "g1", role: "member" },
            error: null,
          });
        }

        if (table === "groups") {
          return membershipChain({ data: { id: "g1", name: "Casa" }, error: null });
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "list-1" }, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    await expect(
      removeGroupMemberAction(
        initialMemberActionState,
        formData({ groupId: "g1", memberUserId: "user-2" }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      message: "Apenas o responsável pode remover membros.",
    });
  });

  it("removes a member when the caller is the owner", async () => {
    const deleteEqRole = vi.fn().mockResolvedValue({ error: null });
    const deleteEqUser = vi.fn().mockReturnValue({ eq: deleteEqRole });
    const deleteEqGroup = vi.fn().mockReturnValue({ eq: deleteEqUser });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqGroup });

    let groupMembersSelectCalls = 0;

    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "owner-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "group_members") {
          groupMembersSelectCalls += 1;

          if (groupMembersSelectCalls === 1) {
            return membershipChain({
              data: { group_id: "g1", role: "owner" },
              error: null,
            });
          }

          if (groupMembersSelectCalls === 2) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "m2", role: "member" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }

          return { delete: deleteFn };
        }

        if (table === "groups") {
          return membershipChain({ data: { id: "g1", name: "Casa" }, error: null });
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "list-1" }, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    await expect(
      removeGroupMemberAction(
        initialMemberActionState,
        formData({ groupId: "g1", memberUserId: "user-2" }),
      ),
    ).resolves.toMatchObject({
      status: "success",
      message: "Membro removido do grupo.",
    });

    expect(deleteFn).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/app/groups/g1/members");
  });
});

describe("leaveGroupAction", () => {
  beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
    redirect.mockClear();
  });

  it("blocks the owner from leaving", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "owner-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "group_members") {
          return membershipChain({
            data: { group_id: "g1", role: "owner" },
            error: null,
          });
        }

        if (table === "groups") {
          return membershipChain({ data: { id: "g1", name: "Casa" }, error: null });
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "list-1" }, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    await expect(
      leaveGroupAction(initialMemberActionState, formData({ groupId: "g1" })),
    ).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("responsável não pode sair"),
    });
  });

  it("lets a member leave and redirects to group creation", async () => {
    const deleteEqRole = vi.fn().mockResolvedValue({ error: null });
    const deleteEqUser = vi.fn().mockReturnValue({ eq: deleteEqRole });
    const deleteEqGroup = vi.fn().mockReturnValue({ eq: deleteEqUser });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqGroup });
    let groupMembersCalls = 0;

    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-2" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "group_members") {
          groupMembersCalls += 1;

          if (groupMembersCalls === 1) {
            return membershipChain({
              data: { group_id: "g1", role: "member" },
              error: null,
            });
          }

          return { delete: deleteFn };
        }

        if (table === "groups") {
          return membershipChain({ data: { id: "g1", name: "Casa" }, error: null });
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "list-1" }, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    await expect(
      leaveGroupAction(initialMemberActionState, formData({ groupId: "g1" })),
    ).rejects.toThrow("REDIRECT:/app/groups/new");

    expect(deleteFn).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/app/groups/new");
  });
});
