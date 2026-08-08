import { describe, expect, it } from "vitest";

import {
  buildCreateGroupPath,
  buildGroupListPath,
  buildGroupMembersPath,
  filterPendingInvites,
  formatMemberDisplayName,
  isAlreadyInGroupError,
} from "@/lib/groups/membership";

describe("group path helpers", () => {
  it("builds the create, list, and members routes", () => {
    expect(buildCreateGroupPath()).toBe("/app/groups/new");
    expect(buildGroupListPath("abc-123")).toBe("/app/groups/abc-123/list");
    expect(buildGroupMembersPath("abc-123")).toBe("/app/groups/abc-123/members");
  });
});

describe("isAlreadyInGroupError", () => {
  it("detects the v1 one-group constraint", () => {
    expect(
      isAlreadyInGroupError({ code: "P0001", message: "User already belongs to a group" }),
    ).toBe(true);
    expect(isAlreadyInGroupError({ message: "User already belongs to a group" })).toBe(true);
    expect(isAlreadyInGroupError({ code: "42501", message: "Authentication required" })).toBe(
      false,
    );
    expect(isAlreadyInGroupError(null)).toBe(false);
  });
});

describe("filterPendingInvites", () => {
  it("keeps only non-expired pending invites", () => {
    const now = new Date("2026-08-08T12:00:00.000Z");

    expect(
      filterPendingInvites(
        [
          {
            id: "1",
            email: "a@example.com",
            status: "pending",
            expires_at: "2026-08-09T12:00:00.000Z",
            created_at: "2026-08-07T12:00:00.000Z",
          },
          {
            id: "2",
            email: "b@example.com",
            status: "pending",
            expires_at: "2026-08-01T12:00:00.000Z",
            created_at: "2026-07-31T12:00:00.000Z",
          },
          {
            id: "3",
            email: "c@example.com",
            status: "revoked",
            expires_at: "2026-08-09T12:00:00.000Z",
            created_at: "2026-08-07T12:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([
      {
        id: "1",
        email: "a@example.com",
        expiresAt: "2026-08-09T12:00:00.000Z",
        createdAt: "2026-08-07T12:00:00.000Z",
      },
    ]);
  });
});

describe("formatMemberDisplayName", () => {
  it("falls back when the profile has no name", () => {
    expect(formatMemberDisplayName(" Ana ")).toBe("Ana");
    expect(formatMemberDisplayName(null)).toBe("Sem nome");
    expect(formatMemberDisplayName("   ")).toBe("Sem nome");
  });
});
