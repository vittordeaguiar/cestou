"use client";

import { useActionState } from "react";
import { LogOutIcon } from "lucide-react";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/lib/auth/action-state";

function LogoutButton() {
  const [state, formAction, pending] = useActionState(logoutAction, initialAuthActionState);

  return (
    <form action={formAction} className="w-full sm:w-auto">
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-caption text-destructive mb-2 sm:max-w-60">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="outline" loading={pending} className="w-full sm:w-auto">
        {pending ? "Saindo…" : <LogOutIcon data-icon="inline-start" />}
        {!pending ? "Sair" : null}
      </Button>
    </form>
  );
}

export { LogoutButton };
