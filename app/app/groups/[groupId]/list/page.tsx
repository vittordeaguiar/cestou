import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ErrorState } from "@/components/feedback/error-state";
import { ListItemsPanel } from "@/components/lists/list-items-panel";
import { Button } from "@/components/ui/button";
import {
  buildCreateGroupPath,
  buildGroupMembersPath,
  getCurrentGroupMembership,
  listGroupMembers,
} from "@/lib/groups/membership";
import { listActiveListItems } from "@/lib/lists/items";
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

  const [items, members] = await Promise.all([
    listActiveListItems(supabase, list.id),
    listGroupMembers(supabase, groupId),
  ]);

  const memberNamesByUserId = Object.fromEntries(
    members.map((member) => [member.userId, member.displayName]),
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-caption text-muted-foreground">Lista compartilhada</p>
        <div className="space-y-2">
          <h1 className="text-display text-foreground">{membership.groupName}</h1>
          <p className="text-body text-muted-foreground">
            Adicione, edite e remova itens com o restante do grupo.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={buildGroupMembersPath(groupId)}>Membros</Link>
        </Button>
      </header>

      <ListItemsPanel
        groupId={groupId}
        listId={list.id}
        currentUserId={userId}
        memberNamesByUserId={memberNamesByUserId}
        items={items}
      />
    </main>
  );
}
