import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Limits for actions that fetch from Google on the user's behalf. */
export const LIMITS = {
  sheetRead: { kind: "sheet_read", max: 30, minutes: 10 },
  refresh: { kind: "refresh", max: 20, minutes: 10 },
} as const;

/** Takes one token for the signed-in user; false when they're over the limit. */
export async function allow(db: SupabaseClient, limit: (typeof LIMITS)[keyof typeof LIMITS]): Promise<boolean> {
  const { data, error } = await db.rpc("take_rate_token", {
    p_kind: limit.kind,
    p_max: limit.max,
    p_window: `${limit.minutes} minutes`,
  });
  // Fail open on infrastructure errors so a DB hiccup doesn't block users.
  if (error) {
    console.error("Rate limit check failed:", error.message);
    return true;
  }
  return data === true;
}

export const tooMany = (minutes: number) => ({
  ok: false as const,
  error: `You're doing that a lot — please wait a few minutes (limit resets within ${minutes} min).`,
});
