"use server";

import { redirect } from "next/navigation";

import { getSafeNext } from "@/lib/auth/redirect";
import { type FieldErrors, validateLogin, validateSignUp } from "@/lib/auth/validation";
import { getSupabaseSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: FieldErrors;
  message?: string;
  redirectTo?: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  fieldErrors: {},
};

function actionError(message: string, fieldErrors: FieldErrors = {}): AuthActionState {
  return { status: "error", fieldErrors, message };
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = validateSignUp({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!result.data) {
    return actionError("Revise os campos destacados.", result.fieldErrors);
  }

  try {
    const emailRedirectTo = getSupabaseSiteUrl();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo,
        data: {
          display_name: result.data.name,
        },
      },
    });

    if (error || !data.user) {
      return actionError("Não foi possível criar sua conta. Verifique os dados e tente novamente.");
    }

    return data.session
      ? {
          status: "success",
          fieldErrors: {},
          message: "Conta criada com sucesso.",
          redirectTo: getSafeNext(formData.get("next")),
        }
      : {
          status: "success",
          fieldErrors: {},
          message: "Conta criada. Faça login para continuar.",
          redirectTo: "/auth/login",
        };
  } catch {
    return actionError("Não foi possível criar sua conta. Tente novamente.");
  }
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = validateLogin({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.data) {
    return actionError("Revise os campos destacados.", result.fieldErrors);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(result.data);

    if (error || !data.session) {
      return actionError("E-mail ou senha inválidos.");
    }

    return {
      status: "success",
      fieldErrors: {},
      message: "Login realizado com sucesso.",
      redirectTo: getSafeNext(formData.get("next")),
    };
  } catch {
    return actionError("Não foi possível entrar agora. Tente novamente.");
  }
}

export async function logoutAction(
  previousState: AuthActionState = initialAuthActionState,
  formData?: FormData,
): Promise<AuthActionState> {
  void previousState;
  void formData;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      return actionError("Não foi possível encerrar a sessão. Tente novamente.");
    }
  } catch {
    return actionError("Não foi possível encerrar a sessão. Tente novamente.");
  }

  redirect("/auth/login?notice=logout");
  return initialAuthActionState;
}
