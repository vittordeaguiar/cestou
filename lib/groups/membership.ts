import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type GroupMembership = {
  groupId: string;
  listId: string;
  groupName: string;
  role: Database["public"]["Enums"]["group_member_role"];
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

export function buildGroupListPath(groupId: string): string {
  return `/app/groups/${groupId}/list`;
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
