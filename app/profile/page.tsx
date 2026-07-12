import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { ErrorState } from "@/components/feedback/error-state";
import { ProfileNameForm } from "@/components/profile/profile-name-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldInput } from "@/components/ui/field-input";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Perfil — Cestou",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login?next=/profile");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <ErrorState
          className="max-w-md"
          title="Perfil indisponível"
          description="Não foi possível carregar seu perfil. Atualize a página e tente novamente."
        />
      </main>
    );
  }

  const email = typeof claims.email === "string" ? claims.email : "E-mail indisponível";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Seu perfil</CardTitle>
          <CardDescription>Atualize como seu nome aparece para o grupo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-7">
          <ProfileNameForm displayName={profile.display_name ?? ""} />
          <FieldInput id="email" label="E-mail" value={email} readOnly aria-readonly="true" />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
          <p className="text-caption text-muted-foreground">
            O e-mail não pode ser alterado nesta etapa.
          </p>
          <LogoutButton />
        </CardFooter>
      </Card>
    </main>
  );
}
