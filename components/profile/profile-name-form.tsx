"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";

import { updateProfileNameAction } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { FieldInput } from "@/components/ui/field-input";
import { initialProfileActionState } from "@/lib/auth/action-state";
import { validateProfileName } from "@/lib/auth/validation";
import { toast } from "@/lib/toast";

type ProfileNameFormProps = {
  displayName: string;
};

function ProfileNameForm({ displayName }: ProfileNameFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfileNameAction,
    initialProfileActionState,
  );
  const [clientError, setClientError] = useState<string>();
  const error = clientError ?? state.fieldErrors.name;

  useEffect(() => {
    if (state.status === "success") {
      toast.success({ title: "Nome atualizado." });
    }
  }, [state.status]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateProfileName(new FormData(event.currentTarget).get("name"));
    setClientError(result.fieldErrors.name);

    if (!result.data) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} noValidate onSubmit={validateBeforeSubmit} className="grid gap-5">
      <fieldset disabled={pending} className="grid gap-5 disabled:opacity-100">
        <FieldInput
          id="name"
          name="name"
          label="Nome"
          autoComplete="name"
          defaultValue={displayName}
          error={error}
          required
        />
      </fieldset>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-small text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        {pending ? "Salvando…" : "Salvar nome"}
      </Button>
    </form>
  );
}

export { ProfileNameForm };
