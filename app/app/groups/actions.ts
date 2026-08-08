"use server";

import { revalidatePath } from "next/cache";

import { type GroupActionState } from "@/lib/auth/action-state";
import {
  buildGroupListPath,
  getCurrentGroupMembership,
  isAlreadyInGroupError,
} from "@/lib/groups/membership";
import { validateGroupName } from "@/lib/groups/validation";
import { createClient } from "@/lib/supabase/server";

function actionError(
  message: string,
  fieldErrors: GroupActionState["fieldErrors"] = {},
): GroupActionState {
  return { status: "error", fieldErrors, message };
}

export async function createGroupAction(
  _previousState: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const validation = validateGroupName(formData.get("name"));

  if (!validation.data) {
    return actionError("Revise o campo destacado.", validation.fieldErrors);
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError("Sua sessão expirou. Entre novamente para continuar.");
    }

    const existingMembership = await getCurrentGroupMembership(supabase, userId);

    if (existingMembership) {
      return {
        status: "success",
        fieldErrors: {},
        message: "Você já participa de um grupo.",
        redirectTo: buildGroupListPath(existingMembership.groupId),
      };
    }

    const { data: createdGroup, error: createError } = await supabase.rpc("create_group", {
      group_name: validation.data.name,
    });

    if (createError || !createdGroup) {
      if (isAlreadyInGroupError(createError)) {
        const membership = await getCurrentGroupMembership(supabase, userId);

        if (membership) {
          return {
            status: "success",
            fieldErrors: {},
            message: "Você já participa de um grupo.",
            redirectTo: buildGroupListPath(membership.groupId),
          };
        }

        return actionError(
          "Você já participa de um grupo. Por enquanto, cada pessoa pode estar em apenas um.",
        );
      }

      return actionError("Não foi possível criar o grupo. Tente novamente.");
    }

    const membership = await getCurrentGroupMembership(supabase, userId);

    if (!membership || membership.groupId !== createdGroup.id) {
      return actionError(
        "O grupo foi criado, mas a lista compartilhada não ficou disponível. Atualize a página.",
      );
    }

    revalidatePath("/app");
    revalidatePath(buildGroupListPath(membership.groupId));

    return {
      status: "success",
      fieldErrors: {},
      message: "Grupo criado com sucesso.",
      redirectTo: buildGroupListPath(membership.groupId),
    };
  } catch {
    return actionError("Não foi possível criar o grupo. Tente novamente.");
  }
}
