import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user id, or sends the visitor to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");
  return { id, supabase };
}

/** Signed-in admin (profiles.is_admin), or a 404 for everyone else. */
export async function requireAdmin() {
  const user = await requireUser();
  const { data } = await user.supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!data?.is_admin) notFound();
  return user;
}

export async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null) {
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return !!data?.is_admin;
}
