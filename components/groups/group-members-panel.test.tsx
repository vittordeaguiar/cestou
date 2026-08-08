// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { leaveGroupAction, removeGroupMemberAction, routerRefresh, toastError, toastSuccess } =
  vi.hoisted(() => ({
    leaveGroupAction: vi.fn(),
    removeGroupMemberAction: vi.fn(),
    routerRefresh: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  }));

vi.mock("@/app/app/groups/members-actions", () => ({
  leaveGroupAction,
  removeGroupMemberAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: routerRefresh }) }));
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { GroupMembersPanel } from "@/components/groups/group-members-panel";

const members = [
  {
    membershipId: "m1",
    userId: "owner-1",
    role: "owner" as const,
    displayName: "Ana",
  },
  {
    membershipId: "m2",
    userId: "user-2",
    role: "member" as const,
    displayName: "Bruno",
  },
];

describe("GroupMembersPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    leaveGroupAction.mockReset();
    removeGroupMemberAction.mockReset();
    routerRefresh.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("lets the owner open a remove confirmation for members", async () => {
    const user = userEvent.setup();

    render(
      <GroupMembersPanel
        groupId="g1"
        currentUserId="owner-1"
        currentRole="owner"
        members={members}
        pendingInvites={[]}
      />,
    );

    expect(screen.getByText("Convites pendentes")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Sair do grupo" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByRole("heading", { name: "Remover membro" })).not.toBeNull();
    expect(removeGroupMemberAction).not.toHaveBeenCalled();
  });

  it("shows leave for a regular member and hides pending invites", async () => {
    const user = userEvent.setup();

    render(
      <GroupMembersPanel
        groupId="g1"
        currentUserId="user-2"
        currentRole="member"
        members={members}
        pendingInvites={[]}
      />,
    );

    expect(screen.queryByText("Convites pendentes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Sair do grupo" }));
    expect(screen.getByRole("heading", { name: "Sair do grupo" })).not.toBeNull();
    expect(leaveGroupAction).not.toHaveBeenCalled();
  });
});
