"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { UsersIcon } from "lucide-react";

import { createGroupAction } from "@/app/app/groups/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/field-input";
import { initialGroupActionState } from "@/lib/auth/action-state";
import { GROUP_NAME_MAX_LENGTH, validateGroupName } from "@/lib/groups/validation";
import { toast } from "@/lib/toast";

function CreateGroupForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createGroupAction, initialGroupActionState);
  const [clientError, setClientError] = useState<string>();
  const error = clientError ?? state.fieldErrors.name;

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      toast.success({ title: state.message ?? "Grupo criado com sucesso." });
      router.replace(state.redirectTo);
    }
  }, [router, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateGroupName(new FormData(event.currentTarget).get("name"));
    setClientError(result.fieldErrors.name);

    if (!result.data) {
      event.preventDefault();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Criar grupo</CardTitle>
        <CardDescription>
          Dê um nome para a família ou grupo. Você será o responsável e já começa com uma lista
          compartilhada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate onSubmit={validateBeforeSubmit} className="grid gap-5">
          <fieldset disabled={pending} className="grid gap-5 disabled:opacity-100">
            <FieldInput
              id="name"
              name="name"
              label="Nome do grupo"
              autoComplete="organization"
              maxLength={GROUP_NAME_MAX_LENGTH}
              description="Por enquanto, cada pessoa pode participar de um grupo."
              error={error}
              required
            />
          </fieldset>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-small text-destructive">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={pending}>
            {pending ? "Criando grupo…" : null}
            {!pending ? <UsersIcon data-icon="inline-start" /> : null}
            {!pending ? "Criar grupo" : null}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export { CreateGroupForm };
