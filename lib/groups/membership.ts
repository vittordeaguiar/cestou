import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type GroupMembership = {
  groupId: string;
  listId: string;
  groupName: string;
  role: Database["public"]["Enums"]["group_member_role"];
};

export type GroupMemberRow = {
  membershipId: string;
  userId: string;
  role: Database["public"]["Enums"]["group_member_role"];
  displayName: string | null;
};

export type PendingGroupInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

type InviteCandidate = {
  id: string;
  email: string;
  status: Database["public"]["Enums"]["group_invite_status"];
  expires_at: string;
  created_at: string;
};

/**
 * Returns the caller's single group membership and its active shared list, or null.
 */
export async function getCurrentGroupMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<GroupMembership | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return null;
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", membership.group_id)
    .maybeSingle();

  if (groupError || !group) {
    return null;
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("group_id", group.id)
    .eq("status", "active")
    .maybeSingle();

  if (listError || !list) {
    return null;
  }

  return {
    groupId: group.id,
    listId: list.id,
    groupName: group.name,
    role: membership.role,
  };
}

export async function listGroupMembers(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<GroupMemberRow[]> {
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("id, user_id, role, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (membersError || !members || members.length === 0) {
    return [];
  }

  const userIds = members.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  if (profilesError) {
    return [];
  }

  const namesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return members.map((member) => ({
    membershipId: member.id,
    userId: member.user_id,
    role: member.role,
    displayName: namesById.get(member.user_id) ?? null,
  }));
}

export function filterPendingInvites(
  invites: InviteCandidate[],
  now = new Date(),
): PendingGroupInvite[] {
  const nowMs = now.getTime();

  return invites
    .filter((invite) => invite.status === "pending" && Date.parse(invite.expires_at) > nowMs)
    .map((invite) => ({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
    }));
}

export async function listPendingGroupInvites(
  supabase: SupabaseClient<Database>,
  groupId: string,
  now = new Date(),
): Promise<PendingGroupInvite[]> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("id, email, status, expires_at, created_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return filterPendingInvites(data, now);
}

export function buildGroupListPath(groupId: string): string {
  return `/app/groups/${groupId}/list`;
}

export function buildGroupMembersPath(groupId: string): string {
  return `/app/groups/${groupId}/members`;
}

export function buildCreateGroupPath(): string {
  return "/app/groups/new";
}

export function isAlreadyInGroupError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "P0001" ||
    error.message === "User already belongs to a group" ||
    Boolean(error.message?.includes("User already belongs to a group"))
  );
}

export function formatMemberDisplayName(displayName: string | null): string {
  const normalized = displayName?.trim();
  return normalized ? normalized : "Sem nome";
}
