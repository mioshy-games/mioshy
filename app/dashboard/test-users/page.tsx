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

/** Pending invitation — an email added before signup. */
export interface PendingInvitationRow {
  email: string;
  note: string | null;
  invitedAt: string | null;
  invitedByName: string | null;
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

  // Fetch the whitelist + resolve emails + the "marked by" admin name.
  // Email lives in auth.users, exposed via the admin_users_overview
  // view. We join client-side (two reads, in-memory merge) because
  // PostgREST won't FK-traverse into auth.* automatically.
  const { data: rows } = await admin
    .from("profiles")
    .select("id, full_name, test_user_note, test_user_marked_at, test_user_marked_by")
    .eq("is_test_user", true)
    .order("test_user_marked_at", { ascending: false });

  type RawRow = {
    id: string;
    full_name: string | null;
    test_user_note: string | null;
    test_user_marked_at: string | null;
    test_user_marked_by: string | null;
  };
  const raw = (rows ?? []) as RawRow[];

  // Pull emails for every whitelisted profile in one batch.
  const profileIds = raw.map((r) => r.id);
  let emailByUserId = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: viewRows } = await admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", profileIds);
    emailByUserId = new Map(
      ((viewRows ?? []) as Array<{ user_id: string; email: string | null }>)
        .map((r) => [r.user_id, r.email]),
    );
  }

  // Resolve the "marked by" admin names. admin_users_overview only
  // carries {user_id, email}, so we batch-fetch full_name separately
  // from profiles and merge.
  const markerIds = Array.from(
    new Set(
      raw.map((r) => r.test_user_marked_by).filter((x): x is string => !!x),
    ),
  );
  const markerNames = new Map<string, string | null>();
  if (markerIds.length > 0) {
    const [emailRes, nameRes] = await Promise.all([
      admin
        .from("admin_users_overview")
        .select("user_id, email")
        .in("user_id", markerIds),
      admin
        .from("profiles")
        .select("id, full_name")
        .in("id", markerIds),
    ]);
    const emailByUser = new Map(
      ((emailRes.data ?? []) as Array<{ user_id: string; email: string | null }>)
        .map((r) => [r.user_id, r.email]),
    );
    const nameByUser = new Map(
      ((nameRes.data ?? []) as Array<{ id: string; full_name: string | null }>)
        .map((r) => [r.id, r.full_name]),
    );
    for (const id of markerIds) {
      const name = nameByUser.get(id)?.trim();
      const email = emailByUser.get(id);
      markerNames.set(id, name || email || null);
    }
  }

  const items: TestUserRow[] = raw.map((r) => ({
    id: r.id,
    fullName: r.full_name?.trim() || null,
    email: emailByUserId.get(r.id) ?? null,
    note: r.test_user_note,
    markedAt: r.test_user_marked_at,
    markedByName: r.test_user_marked_by
      ? markerNames.get(r.test_user_marked_by) ?? null
      : null,
  }));

  // Pending invitations — emails added before the holder signed up.
  // signupAction auto-claims these so they only live in the table until
  // the user actually signs up.
  const { data: pendingRaw } = await admin
    .from("test_user_invitations")
    .select("email, note, invited_at, invited_by")
    .is("claimed_at", null)
    .order("invited_at", { ascending: false });
  type PendingRaw = {
    email: string;
    note: string | null;
    invited_at: string | null;
    invited_by: string | null;
  };
  const pendingRows = (pendingRaw ?? []) as PendingRaw[];
  const pendingMarkerIds = Array.from(
    new Set(
      pendingRows
        .map((r) => r.invited_by)
        .filter((x): x is string => !!x && !markerNames.has(x)),
    ),
  );
  if (pendingMarkerIds.length > 0) {
    const [emailRes2, nameRes2] = await Promise.all([
      admin
        .from("admin_users_overview")
        .select("user_id, email")
        .in("user_id", pendingMarkerIds),
      admin
        .from("profiles")
        .select("id, full_name")
        .in("id", pendingMarkerIds),
    ]);
    const emailByUser = new Map(
      ((emailRes2.data ?? []) as Array<{ user_id: string; email: string | null }>)
        .map((r) => [r.user_id, r.email]),
    );
    const nameByUser = new Map(
      ((nameRes2.data ?? []) as Array<{ id: string; full_name: string | null }>)
        .map((r) => [r.id, r.full_name]),
    );
    for (const id of pendingMarkerIds) {
      const name = nameByUser.get(id)?.trim();
      const email = emailByUser.get(id);
      markerNames.set(id, name || email || null);
    }
  }
  const pending: PendingInvitationRow[] = pendingRows.map((r) => ({
    email: r.email,
    note: r.note,
    invitedAt: r.invited_at,
    invitedByName: r.invited_by ? markerNames.get(r.invited_by) ?? null : null,
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

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations · {pending.length}</CardTitle>
            <CardDescription>
              These emails were invited before they had an account. When
              they sign up, they&apos;re auto-granted on the first page
              render. Remove to revoke the invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TestUsersClient mode="pending" initialList={[]} pending={pending} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
