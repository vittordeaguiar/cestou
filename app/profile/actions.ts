"use server";

import { revalidatePath } from "next/cache";

import { type FieldErrors, validateProfileName } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: FieldErrors<"name">;
  message?: string;
  name?: string;
};

export const initialProfileActionState: ProfileActionState = {
  status: "idle",
  fieldErrors: {},
};

export async function updateProfileNameAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const validation = validateProfileName(formData.get("name"));

  if (!validation.data) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      message: "Revise o campo destacado.",
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return {
        status: "error",
        fieldErrors: {},
        message: "Sua sessão expirou. Entre novamente para continuar.",
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: validation.data.name })
      .eq("id", userId)
      .select("display_name")
      .single();

    if (error || !data) {
      return {
        status: "error",
        fieldErrors: {},
        message: "Não foi possível atualizar seu nome. Tente novamente.",
      };
    }

    revalidatePath("/profile");

    return {
      status: "success",
      fieldErrors: {},
      name: data.display_name ?? validation.data.name,
    };
  } catch {
    return {
      status: "error",
      fieldErrors: {},
      message: "Não foi possível atualizar seu nome. Tente novamente.",
    };
  }
}
