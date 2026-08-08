"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type MemberActionState } from "@/lib/auth/action-state";
import {
  buildCreateGroupPath,
  buildGroupMembersPath,
  getCurrentGroupMembership,
} from "@/lib/groups/membership";
import { createClient } from "@/lib/supabase/server";

function actionError(message: string): MemberActionState {
  return { status: "error", message };
}

export async function removeGroupMemberAction(
  _previousState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId =
    typeof formData.get("groupId") === "string" ? String(formData.get("groupId")) : "";
  const memberUserId =
    typeof formData.get("memberUserId") === "string" ? String(formData.get("memberUserId")) : "";

  if (!groupId || !memberUserId) {
    return actionError("Não foi possível remover o membro. Tente novamente.");
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError("Sua sessão expirou. Entre novamente para continuar.");
    }

    if (memberUserId === userId) {
      return actionError("Você não pode remover a si mesmo do grupo.");
    }

    const membership = await getCurrentGroupMembership(supabase, userId);

    if (!membership || membership.groupId !== groupId) {
      return actionError("Você não faz parte deste grupo.");
    }

    if (membership.role !== "owner") {
      return actionError("Apenas o responsável pode remover membros.");
    }

    const { data: target, error: targetError } = await supabase
      .from("group_members")
      .select("id, role")
      .eq("group_id", groupId)
      .eq("user_id", memberUserId)
      .maybeSingle();

    if (targetError || !target) {
      return actionError("Membro não encontrado neste grupo.");
    }

    if (target.role !== "member") {
      return actionError("Não é possível remover o responsável do grupo.");
    }

    const { error: deleteError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberUserId)
      .eq("role", "member");

    if (deleteError) {
      return actionError("Não foi possível remover o membro. Tente novamente.");
    }

    revalidatePath(buildGroupMembersPath(groupId));
    revalidatePath(`/app/groups/${groupId}/list`);

    return {
      status: "success",
      message: "Membro removido do grupo.",
    };
  } catch {
    return actionError("Não foi possível remover o membro. Tente novamente.");
  }
}

export async function leaveGroupAction(
  _previousState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId =
    typeof formData.get("groupId") === "string" ? String(formData.get("groupId")) : "";

  if (!groupId) {
    return actionError("Não foi possível sair do grupo. Tente novamente.");
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError("Sua sessão expirou. Entre novamente para continuar.");
    }

    const membership = await getCurrentGroupMembership(supabase, userId);

    if (!membership || membership.groupId !== groupId) {
      return actionError("Você não faz parte deste grupo.");
    }

    if (membership.role !== "member") {
      return actionError(
        "O responsável não pode sair do grupo. Transfira a responsabilidade antes de sair.",
      );
    }

    const { error: deleteError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("role", "member");

    if (deleteError) {
      return actionError("Não foi possível sair do grupo. Tente novamente.");
    }

    revalidatePath("/app");
    revalidatePath(buildGroupMembersPath(groupId));
  } catch {
    return actionError("Não foi possível sair do grupo. Tente novamente.");
  }

  redirect(buildCreateGroupPath());
}
