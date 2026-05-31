/**
 * Resolves data for /my/settings.
 *
 *   - User profile (name + email + phone)
 *   - Subscription state (active / grace / blocked / none)
 *   - Next billing date if active
 *
 * Everything degrades to null if a query fails — the page falls back
 * to placeholder copy rather than crashing.
 */

import "server-only";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { createServiceRoleClient } from "@/lib/supabase-admin";

interface Args {
  userId: string;
  locale: "he" | "en";
}

export interface SettingsData {
  profile: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  subscription: {
    /** Localized status badge label, e.g. "פעיל" / "Active". */
    statusLabel: string;
    /** "active" tints sage; "neutral" tones it down. */
    statusTone: "active" | "neutral";
    /** Localized subtitle line under the row. */
    subtitle: string;
  } | null;
}

export async function getSettingsData(args: Args): Promise<SettingsData> {
  const { userId, locale } = args;
  const isHe = locale === "he";

  // 2026-05-31 — request-scoped auth read; reuses the same getUser
  // resolution every other shell helper paid for already.
  const { user } = await getRequestUser();

  // Defensive — shell auth gate already ran, but skip queries if the
  // session vanished mid-render.
  if (!user || user.id !== userId) {
    return {
      profile: { fullName: null, email: null, phone: null },
      subscription: null,
    };
  }

  const admin = createServiceRoleClient();

  let fullName: string | null = null;
  let phone: string | null = null;
  if (admin) {
    const { data: row } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();
    const p = row as { full_name: string | null; phone: string | null } | null;
    fullName = p?.full_name?.trim() || null;
    phone = p?.phone?.trim() || null;
  }

  // Subscription — pick the most relevant journey row.
  let subscription: SettingsData["subscription"] = null;
  if (admin) {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("product, status, current_period_end, journey_grace_until")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(5);
    const rows = (subs ?? []) as Array<{
      product: string;
      status: string;
      current_period_end: string | null;
      journey_grace_until: string | null;
    }>;
    const journey = rows.find((r) => r.product === "journey" && r.status === "active");
    const grace = rows.find((r) => r.product === "journey" && r.status === "grace");
    const games = rows.find((r) => r.product === "games" && r.status === "active");
    const pick = journey ?? grace ?? games ?? rows[0];

    if (pick) {
      const nextDate = pick.current_period_end
        ? new Date(pick.current_period_end).toLocaleDateString(
            isHe ? "he-IL" : "en-GB",
            { day: "numeric", month: "long" },
          )
        : null;
      const productLabel = (() => {
        if (pick.product === "journey") return isHe ? "ליווי שבועי" : "Weekly coaching";
        if (pick.product === "games") return isHe ? "משחקי הזוגות" : "Couples Games";
        if (pick.product === "adults") return isHe ? "מבוגרים" : "Adults";
        return pick.product;
      })();
      if (pick.status === "active") {
        subscription = {
          statusLabel: isHe ? "פעיל" : "Active",
          statusTone: "active",
          subtitle: nextDate
            ? isHe
              ? `${productLabel} · החיוב הבא ${nextDate}`
              : `${productLabel} · Next charge ${nextDate}`
            : productLabel,
        };
      } else if (pick.status === "grace") {
        subscription = {
          statusLabel: isHe ? "חידוש נדרש" : "Renewal needed",
          statusTone: "neutral",
          subtitle: nextDate
            ? isHe
              ? `${productLabel} · תוקף עד ${nextDate}`
              : `${productLabel} · Active until ${nextDate}`
            : productLabel,
        };
      } else {
        subscription = {
          statusLabel: isHe ? "לא פעיל" : "Inactive",
          statusTone: "neutral",
          subtitle: productLabel,
        };
      }
    }
  }

  return {
    profile: {
      fullName,
      email: user.email ?? null,
      phone,
    },
    subscription,
  };
}
