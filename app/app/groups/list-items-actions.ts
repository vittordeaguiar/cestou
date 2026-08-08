"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ListItemActionState } from "@/lib/auth/action-state";
import {
  buildGroupListPath,
  getCurrentGroupMembership,
  type GroupMembership,
} from "@/lib/groups/membership";
import { isUuid } from "@/lib/lists/sync";
import { validateListItemInput } from "@/lib/lists/validation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

function actionError(
  message: string,
  fieldErrors: ListItemActionState["fieldErrors"] = {},
): ListItemActionState {
  return { status: "error", fieldErrors, message };
}

function readStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

type MembershipResult =
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      userId: string;
      membership: GroupMembership;
    }
  | { ok: false; error: ListItemActionState };

async function requireGroupMembership(groupId: string): Promise<MembershipResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId || typeof userId !== "string") {
    return { ok: false, error: actionError("Sua sessão expirou. Entre novamente para continuar.") };
  }

  if (!groupId) {
    return { ok: false, error: actionError("Grupo inválido.") };
  }

  const membership = await getCurrentGroupMembership(supabase, userId);

  if (!membership || membership.groupId !== groupId) {
    return { ok: false, error: actionError("Você não faz parte deste grupo.") };
  }

  return { ok: true, supabase, userId, membership };
}

export async function createListItemAction(
  _previousState: ListItemActionState,
  formData: FormData,
): Promise<ListItemActionState> {
  const groupId = readStringField(formData, "groupId");
  const itemId = readStringField(formData, "itemId");
  const validation = validateListItemInput({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
  });

  if (!validation.data) {
    return actionError("Revise os campos destacados.", validation.fieldErrors);
  }

  if (!isUuid(itemId)) {
    return actionError("Item inválido.");
  }

  try {
    const auth = await requireGroupMembership(groupId);
    if (!auth.ok) {
      return auth.error;
    }

    const { error } = await auth.supabase.from("list_items").insert({
      id: itemId,
      list_id: auth.membership.listId,
      name: validation.data.name,
      quantity: validation.data.quantity,
      unit: validation.data.unit,
      created_by: auth.userId,
    });

    if (error) {
      return actionError("Não foi possível adicionar o item. Tente novamente.");
    }

    revalidatePath(buildGroupListPath(groupId));

    return {
      status: "success",
      fieldErrors: {},
      message: "Item adicionado.",
    };
  } catch {
    return actionError("Não foi possível adicionar o item. Tente novamente.");
  }
}

export async function updateListItemAction(
  _previousState: ListItemActionState,
  formData: FormData,
): Promise<ListItemActionState> {
  const groupId = readStringField(formData, "groupId");
  const itemId = readStringField(formData, "itemId");
  const validation = validateListItemInput({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
  });

  if (!isUuid(itemId)) {
    return actionError("Item inválido.");
  }

  if (!validation.data) {
    return actionError("Revise os campos destacados.", validation.fieldErrors);
  }

  try {
    const auth = await requireGroupMembership(groupId);
    if (!auth.ok) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("list_items")
      .update({
        name: validation.data.name,
        quantity: validation.data.quantity,
        unit: validation.data.unit,
      })
      .eq("id", itemId)
      .eq("list_id", auth.membership.listId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return actionError("Não foi possível atualizar o item. Tente novamente.");
    }

    revalidatePath(buildGroupListPath(groupId));

    return {
      status: "success",
      fieldErrors: {},
      message: "Item atualizado.",
    };
  } catch {
    return actionError("Não foi possível atualizar o item. Tente novamente.");
  }
}

export async function deleteListItemAction(
  _previousState: ListItemActionState,
  formData: FormData,
): Promise<ListItemActionState> {
  const groupId = readStringField(formData, "groupId");
  const itemId = readStringField(formData, "itemId");

  if (!isUuid(itemId)) {
    return actionError("Item inválido.");
  }

  try {
    const auth = await requireGroupMembership(groupId);
    if (!auth.ok) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("list_items")
      .delete()
      .eq("id", itemId)
      .eq("list_id", auth.membership.listId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return actionError("Não foi possível remover o item. Tente novamente.");
    }

    revalidatePath(buildGroupListPath(groupId));

    return {
      status: "success",
      fieldErrors: {},
      message: "Item removido.",
    };
  } catch {
    return actionError("Não foi possível remover o item. Tente novamente.");
  }
}

function readPurchasedField(formData: FormData): boolean | null {
  const value = readStringField(formData, "purchased");
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export async function setListItemPurchasedAction(
  _previousState: ListItemActionState,
  formData: FormData,
): Promise<ListItemActionState> {
  const groupId = readStringField(formData, "groupId");
  const itemId = readStringField(formData, "itemId");
  const purchased = readPurchasedField(formData);

  if (!isUuid(itemId) || purchased === null) {
    return actionError("Item inválido.");
  }

  try {
    const auth = await requireGroupMembership(groupId);
    if (!auth.ok) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("list_items")
      .update({ purchased })
      .eq("id", itemId)
      .eq("list_id", auth.membership.listId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return actionError("Não foi possível atualizar o item. Tente novamente.");
    }

    revalidatePath(buildGroupListPath(groupId));

    return {
      status: "success",
      fieldErrors: {},
      message: purchased ? "Item marcado como comprado." : "Item marcado como pendente.",
    };
  } catch {
    return actionError("Não foi possível atualizar o item. Tente novamente.");
  }
}
