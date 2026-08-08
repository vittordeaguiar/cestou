import { redirect } from "next/navigation";

import { CreateGroupForm } from "@/components/groups/create-group-form";
import { buildGroupListPath, getCurrentGroupMembership } from "@/lib/groups/membership";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Criar grupo — Cestou",
};

export default async function CreateGroupPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login?next=/app/groups/new");
  }

  const membership = await getCurrentGroupMembership(supabase, userId);

  if (membership) {
    redirect(buildGroupListPath(membership.groupId));
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <CreateGroupForm />
    </main>
  );
}
