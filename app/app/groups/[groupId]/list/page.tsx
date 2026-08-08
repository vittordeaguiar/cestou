import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { buildCreateGroupPath, getCurrentGroupMembership } from "@/lib/groups/membership";
import { createClient } from "@/lib/supabase/server";

type GroupListPageProps = {
  params: Promise<{ groupId: string }>;
};

export async function generateMetadata({ params }: GroupListPageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();

  return {
    title: data?.name ? `${data.name} — Cestou` : "Lista — Cestou",
  };
}

export default async function GroupListPage({ params }: GroupListPageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect(`/auth/login?next=/app/groups/${groupId}/list`);
  }

  const membership = await getCurrentGroupMembership(supabase, userId);

  if (!membership) {
    redirect(buildCreateGroupPath());
  }

  if (membership.groupId !== groupId) {
    notFound();
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, status")
    .eq("id", membership.listId)
    .eq("group_id", groupId)
    .eq("status", "active")
    .maybeSingle();

  if (listError) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <ErrorState
          className="max-w-md"
          title="Lista indisponível"
          description="Não foi possível carregar a lista do grupo. Atualize a página e tente novamente."
        />
      </main>
    );
  }

  if (!list) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-caption text-muted-foreground">Lista compartilhada</p>
        <h1 className="text-display text-foreground">{membership.groupName}</h1>
        <p className="text-body text-muted-foreground">
          Seu grupo está pronto. Em breve você poderá adicionar itens por aqui.
        </p>
      </header>

      <EmptyState
        title="Lista vazia"
        description="Quando alguém adicionar o primeiro item, ele aparecerá nesta lista compartilhada."
        action={
          <Button asChild variant="outline">
            <Link href="/profile">Ir para o perfil</Link>
          </Button>
        }
      />
    </main>
  );
}
