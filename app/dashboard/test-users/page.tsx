/**
 * /dashboard/test-users — whitelist management for QA/internal users.
 *
 * What it does:
 *   • Lists every profile with `is_test_user = true` (admin-only view).
 *   • Lets the admin add a new email to the whitelist (or remove one).
 *   • Shows audit columns: when the flag was last flipped + by whom.
 *
 * Behaviour:
 *   • When `is_test_user` is true, the entitlements gate auto-grants
 *     every product. The checkout flow detects the flag and skips
 *     Cardcom. Billing crons skip the user too. The signup → checkout
 *     → service flow is unchanged from the user's POV.
 *
 * Admin-only. `requireAdmin()` in the page guard means coaches see a
 * 403 if they try to navigate here directly. The route lives under
 * /dashboard/* so it inherits the sidebar.
 *
 * Added 2026-06-01.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TestUsersClient } from "@/components/dashboard/TestUsersClient";

export const dynamic = "force-dynamic";

export interface TestUserRow {
  id: string;
  fullName: string | null;
  email: string | null;
  note: string | null;
  markedAt: string | null;
  markedByName: string | null;
}

export default async function TestUsersPage() {
  await requireAdmin();

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Test users</h1>
        <p className="text-muted-foreground text-sm">
          Service role unavailable — check Supabase env vars.
        </p>
      </div>
    );
  }

  // Fetch the whitelist + resolve the "marked by" admin name in one
  // shot. We deliberately allow >50 rows here (this is an internal
  // tool — the volume will never realistically exceed a handful).
  const { data: rows } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, test_user_note, test_user_marked_at, test_user_marked_by",
    )
    .eq("is_test_user", true)
    .order("test_user_marked_at", { ascending: false });

  type RawRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    test_user_note: string | null;
    test_user_marked_at: string | null;
    test_user_marked_by: string | null;
  };
  const raw = (rows ?? []) as RawRow[];
  const markerIds = Array.from(
    new Set(
      raw.map((r) => r.test_user_marked_by).filter((x): x is string => !!x),
    ),
  );
  let markerNames = new Map<string, string | null>();
  if (markerIds.length > 0) {
    const { data: markers } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", markerIds);
    markerNames = new Map(
      ((markers ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
        .map((p) => [p.id, p.full_name?.trim() || p.email || null]),
    );
  }

  const items: TestUserRow[] = raw.map((r) => ({
    id: r.id,
    fullName: r.full_name?.trim() || null,
    email: r.email,
    note: r.test_user_note,
    markedAt: r.test_user_marked_at,
    markedByName: r.test_user_marked_by
      ? markerNames.get(r.test_user_marked_by) ?? null
      : null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test users</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Internal whitelist. Users on this list get every product
          unlocked automatically and are never charged — useful for
          QA, demos, and internal sanity checks. The user experience
          (signup → checkout → service) stays identical; we just skip
          the Cardcom step when their email matches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add user to whitelist</CardTitle>
          <CardDescription>
            Type the email of an existing account. The user must have
            signed up at least once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestUsersClient mode="add" initialList={items} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active whitelist · {items.length}</CardTitle>
          <CardDescription>
            Toggle off to revoke. Audit columns show who last flipped
            the flag and when.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestUsersClient mode="list" initialList={items} />
        </CardContent>
      </Card>
    </div>
  );
}
