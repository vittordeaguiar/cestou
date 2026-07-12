"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { LogInIcon, UserPlusIcon } from "lucide-react";

import {
  initialAuthActionState,
  loginAction,
  signUpAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/field-input";
import { toast } from "@/lib/toast";
import { type FieldErrors, validateLogin, validateSignUp } from "@/lib/auth/validation";

type AuthMode = "login" | "sign-up";

type AuthFormProps = {
  mode: AuthMode;
  nextValue: string;
  notice?: "logout";
};

function AuthForm({ mode, nextValue, notice }: AuthFormProps) {
  const router = useRouter();
  const action = mode === "login" ? loginAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialAuthActionState);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const isSignUp = mode === "sign-up";
  const fieldErrors = { ...state.fieldErrors, ...clientErrors };

  useEffect(() => {
    if (notice === "logout") {
      toast.success({ title: "Sessão encerrada." });
    }
  }, [notice]);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      toast.success({ title: state.message ?? "Operação concluída." });
      router.replace(state.redirectTo);
    }
  }, [router, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = isSignUp
      ? validateSignUp({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          passwordConfirmation: data.get("passwordConfirmation"),
        })
      : validateLogin({
          email: data.get("email"),
          password: data.get("password"),
        });

    setClientErrors(result.fieldErrors);

    if (!result.data) {
      event.preventDefault();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignUp ? "Crie sua conta" : "Boas-vindas de volta"}</CardTitle>
        <CardDescription>
          {isSignUp
            ? "Comece a organizar as compras em grupo."
            : "Entre para continuar organizando suas compras."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate onSubmit={validateBeforeSubmit} className="grid gap-5">
          <input type="hidden" name="next" value={nextValue} />
          <fieldset disabled={pending} className="grid gap-5 disabled:opacity-100">
            {isSignUp ? (
              <FieldInput
                id="name"
                name="name"
                label="Nome"
                autoComplete="name"
                error={fieldErrors.name}
                required
              />
            ) : null}
            <FieldInput
              id="email"
              name="email"
              type="email"
              label="E-mail"
              autoComplete="email"
              inputMode="email"
              error={fieldErrors.email}
              required
            />
            <FieldInput
              id="password"
              name="password"
              type="password"
              label="Senha"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              error={fieldErrors.password}
              description={isSignUp ? "Use pelo menos 8 caracteres." : undefined}
              minLength={8}
              required
            />
            {isSignUp ? (
              <FieldInput
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                label="Confirme a senha"
                autoComplete="new-password"
                error={fieldErrors.passwordConfirmation}
                minLength={8}
                required
              />
            ) : null}
          </fieldset>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-small text-destructive">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={pending}>
            {pending ? (isSignUp ? "Criando conta…" : "Entrando…") : null}
            {!pending && isSignUp ? <UserPlusIcon data-icon="inline-start" /> : null}
            {!pending && !isSignUp ? <LogInIcon data-icon="inline-start" /> : null}
            {!pending && (isSignUp ? "Criar conta" : "Entrar")}
          </Button>
        </form>
        <p className="text-small text-muted-foreground mt-5 text-center">
          {isSignUp ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
          <Link
            className="text-primary font-medium underline-offset-4 hover:underline"
            href={isSignUp ? "/auth/login" : "/auth/sign-up"}
          >
            {isSignUp ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export { AuthForm };
export type { AuthFormProps, AuthMode, AuthActionState };
