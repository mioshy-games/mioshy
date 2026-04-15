import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileSpinRow = {
  spins_used: number;
  last_spin_reset: string | null;
};

const RESET_AFTER_DAYS = 7;

export async function getAndMaybeResetUserSpins(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSpinRow> {
  const { data, error } = await supabase
    .from("profiles")
    .select("spins_used, last_spin_reset")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { spins_used: 0, last_spin_reset: null };
  }

  const last = data.last_spin_reset ? new Date(data.last_spin_reset).getTime() : null;
  const shouldReset =
    last == null ||
    Date.now() - last > RESET_AFTER_DAYS * 24 * 60 * 60 * 1000;

  if (!shouldReset) return data;

  const { data: updated } = await supabase
    .from("profiles")
    .update({ spins_used: 0, last_spin_reset: new Date().toISOString() })
    .eq("id", userId)
    .select("spins_used, last_spin_reset")
    .maybeSingle();

  return updated ?? { spins_used: 0, last_spin_reset: new Date().toISOString() };
}

export async function incrementUserSpins(
  supabase: SupabaseClient,
  userId: string,
  nextValue: number,
) {
  await supabase
    .from("profiles")
    .update({ spins_used: nextValue })
    .eq("id", userId);
}

const GUEST_KEY = "mioshy:guest_spins_v1";
const GUEST_LOCK_KEY = "mioshy:guest_lock_until_v1";

export function getGuestSpins(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(GUEST_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function setGuestSpins(n: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_KEY, String(Math.max(0, Math.floor(n))));
}

export function getGuestLockUntilMs(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GUEST_LOCK_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function lockGuestUntilTomorrow() {
  if (typeof window === "undefined") return;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  window.localStorage.setItem(GUEST_LOCK_KEY, String(tomorrow.getTime()));
}


