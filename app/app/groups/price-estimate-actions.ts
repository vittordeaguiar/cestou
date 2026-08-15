"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGroupListPath, getCurrentGroupMembership } from "@/lib/groups/membership";
import { isUuid } from "@/lib/lists/sync";
import { isItemCategory } from "@/lib/lists/category";
import { type PriceEstimateActionState } from "@/lib/pricing/action-state";
import { estimatePendingItems, type PendingPriceItem } from "@/lib/pricing/estimate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

function actionError(message: string): PriceEstimateActionState {
  return { status: "error", message };
}

function readGroupId(formData: FormData) {
  const value = formData.get("groupId");
  return typeof value === "string" ? value : "";
}

async function releaseLock(
  admin: SupabaseClient<Database>,
  listId: string,
  lockToken: string,
  userId: string,
) {
  try {
    await admin.rpc("release_price_estimate_lock", {
      target_list_id: listId,
      lock_token: lockToken,
      requested_by: userId,
    });
  } catch {
    // The database lock expires automatically; never replace the safe Action error.
  }
}

async function runPriceEstimateAction(groupId: string): Promise<PriceEstimateActionState> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId || typeof userId !== "string") {
    return actionError("Sua sessão expirou. Entre novamente para continuar.");
  }

  const membership = await getCurrentGroupMembership(supabase, userId);
  if (!membership || membership.groupId !== groupId) {
    return actionError("Você não faz parte deste grupo.");
  }

  const { data: records, error: itemsError } = await supabase
    .from("list_items")
    .select("id, name, quantity, unit, category")
    .eq("list_id", membership.listId)
    .eq("purchased", false)
    .order("created_at", { ascending: true });

  if (itemsError || !records) {
    return actionError("Não foi possível carregar os itens pendentes. Tente novamente.");
  }

  if (records.length === 0) {
    return actionError("Adicione ao menos um item pendente antes de solicitar a estimativa.");
  }

  const items: PendingPriceItem[] = records.map((record) => ({
    id: record.id,
    name: record.name,
    quantity: Number(record.quantity),
    unit: record.unit,
    category: isItemCategory(record.category) ? record.category : null,
  }));
  const lockToken = crypto.randomUUID();
  const admin = createAdminClient();
  const { data: lockAcquired, error: lockError } = await admin.rpc("acquire_price_estimate_lock", {
    target_list_id: membership.listId,
    lock_token: lockToken,
    requested_by: userId,
  });

  if (lockError) {
    return actionError("Não foi possível iniciar a estimativa. Tente novamente.");
  }

  if (!lockAcquired) {
    return {
      status: "rate_limited",
      message: "Uma estimativa desta lista já está em andamento.",
    };
  }

  try {
    const result = await estimatePendingItems(items);
    const { error: finishError } = await admin.rpc("finish_price_estimate", {
      target_list_id: membership.listId,
      lock_token: lockToken,
      estimated_total: result.totalAmount,
      missing_items: result.itemsNotFound,
      requested_by: userId,
    });

    if (finishError) {
      await releaseLock(admin, membership.listId, lockToken, userId);
      return actionError("A estimativa foi calculada, mas não pôde ser salva. Tente novamente.");
    }

    revalidatePath(buildGroupListPath(groupId));

    return {
      status: result.status === "complete" ? "success" : "partial",
      message:
        result.status === "complete"
          ? "Estimativa atualizada."
          : "Estimativa atualizada com alguns itens sem preço.",
      estimatedTotal: result.totalAmount,
      itemsProcessed: result.processedCount,
      itemsNotFound: result.itemsNotFound.length,
    };
  } catch {
    await releaseLock(admin, membership.listId, lockToken, userId);
    return actionError("Não foi possível calcular a estimativa agora. Tente novamente.");
  }
}

export async function requestPriceEstimateAction(
  _previousState: PriceEstimateActionState,
  formData: FormData,
): Promise<PriceEstimateActionState> {
  const groupId = readGroupId(formData);
  if (!isUuid(groupId)) {
    return actionError("Grupo inválido.");
  }

  try {
    return await runPriceEstimateAction(groupId);
  } catch {
    return actionError("Não foi possível iniciar a estimativa. Tente novamente.");
  }
}
