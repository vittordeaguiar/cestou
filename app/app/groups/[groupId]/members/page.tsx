import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ErrorState } from "@/components/feedback/error-state";
import { GroupMembersPanel } from "@/components/groups/group-members-panel";
import { Button } from "@/components/ui/button";
import {
  buildCreateGroupPath,
  buildGroupListPath,
  getCurrentGroupMembership,
  listGroupMembers,
  listPendingGroupInvites,
} from "@/lib/groups/membership";
import { createClient } from "@/lib/supabase/server";

type GroupMembersPageProps = {
  params: Promise<{ groupId: string }>;
};

export async function generateMetadata({ params }: GroupMembersPageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();

  return {
    title: data?.name ? `Membros · ${data.name} — Cestou` : "Membros — Cestou",
  };
}

export default async function GroupMembersPage({ params }: GroupMembersPageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect(`/auth/login?next=/app/groups/${groupId}/members`);
  }

  const membership = await getCurrentGroupMembership(supabase, userId);

  if (!membership) {
    redirect(buildCreateGroupPath());
  }

  if (membership.groupId !== groupId) {
    notFound();
  }

  const members = await listGroupMembers(supabase, groupId);
  const pendingInvites =
    membership.role === "owner" ? await listPendingGroupInvites(supabase, groupId) : [];

  if (members.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <ErrorState
          className="max-w-md"
          title="Membros indisponíveis"
          description="Não foi possível carregar os membros do grupo. Atualize a página e tente novamente."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-caption text-muted-foreground">Gerenciar grupo</p>
        <div className="space-y-2">
          <h1 className="text-display text-foreground">{membership.groupName}</h1>
          <p className="text-body text-muted-foreground">
            Veja quem participa do grupo
            {membership.role === "owner" ? " e acompanhe convites pendentes." : "."}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={buildGroupListPath(groupId)}>Voltar para a lista</Link>
        </Button>
      </header>

      <GroupMembersPanel
        groupId={groupId}
        currentUserId={userId}
        currentRole={membership.role}
        members={members}
        pendingInvites={pendingInvites}
      />
    </main>
  );
}
