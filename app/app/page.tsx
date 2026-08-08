import { redirect } from "next/navigation";

import {
  buildCreateGroupPath,
  buildGroupListPath,
  getCurrentGroupMembership,
} from "@/lib/groups/membership";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "App — Cestou",
};

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login?next=/app");
  }

  const membership = await getCurrentGroupMembership(supabase, userId);

  redirect(membership ? buildGroupListPath(membership.groupId) : buildCreateGroupPath());
}
