/**
 * tests/db/pair-code-hardening.test.ts
 *
 * Executes migration 203 against a real Postgres (PGlite, in-process) and
 * asserts the six invariants the fix depends on.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS TEST COVERS — and, more importantly, WHAT IT DOES NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COVERS (real Postgres semantics, not a simulation):
 *   · The plpgsql control flow of join_couple_by_pair_code, rotate_pair_code
 *     and generate_pair_code, executed from the actual migration file on disk.
 *   · TRANSACTION semantics — specifically that the couple_join_attempts row
 *     SURVIVES a failed attempt. This is the whole reason the test exists: an
 *     earlier draft used RAISE for each failure, which aborts the transaction
 *     and rolls the counter row back with it, leaving the rate limiter inert.
 *     No amount of reading catches that; only running it does.
 *   · Constraint enforcement: the PRIMARY KEY on pair_codes_issued, which is
 *     what actually guarantees a retired code is never reissued.
 *
 * DOES NOT COVER — these need the real Supabase project:
 *   · RLS. Policies are created but PGlite has no Supabase role system, so
 *     nothing here proves a policy admits or denies the right caller.
 *   · Supabase's ROLE BEHAVIOUR. anon/authenticated/service_role are created
 *     below as bare roles. Invariant ו does verify the catalog state — that no
 *     grant exists, RLS is enabled AND forced, and no policy is defined — which
 *     is a real check and the one blocking this migration. What it cannot show
 *     is that a PostgREST request actually assumes those roles, because Supabase
 *     default privileges and the JWT→role mapping do not exist here.
 *   · The real auth.uid(). It is shimmed to read a session setting instead of
 *     a JWT claim, so this proves the FUNCTION LOGIC keyed on a caller id, not
 *     that PostgREST supplies that id correctly.
 *   · The 029/042 originals. couples and couple_members are recreated below
 *     with the columns 203 touches; a column added elsewhere and not mirrored
 *     here would not be caught.
 *
 * So: this is a logic-and-transaction test. Passing it does NOT mean 203 is
 * safe to run on production — that still needs the verify script against the
 * real database. Treating this as full coverage would be worse than having no
 * test at all.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION = resolve(process.cwd(), "supabase/migrations/203_pair_code_hardening.sql");

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const USER_C = "00000000-0000-0000-0000-00000000000c";

let db: PGlite;

/** Scaffolding only — see the header. Shared so the re-run check can build a
 *  second, throwaway database from the same starting point. */
const SHIM_SQL = `
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE auth.users (
      id    uuid PRIMARY KEY,
      email text
    );

    -- Stands in for Supabase's JWT-backed auth.uid().
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
      SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
    $fn$;

    -- Nobody is an admin in these tests.
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $fn$
      SELECT false;
    $fn$;

    -- Mirrors the columns migration 203 touches (029:20-40).
    CREATE TABLE public.couples (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pair_code    text,
      display_name text,
      created_by   uuid REFERENCES auth.users(id),
      is_active    boolean NOT NULL DEFAULT true,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX couples_pair_code_key
      ON public.couples (pair_code) WHERE is_active = true;

    CREATE TABLE public.couple_members (
      id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
      user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role      text NOT NULL DEFAULT 'partner',
      joined_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (couple_id, user_id)
    );
`;

/** Run as a given user — the shim for auth.uid(). */
async function actAs(userId: string | null) {
  await db.query(`SELECT set_config('test.uid', $1, false)`, [userId ?? ""]);
}

async function join(code: string): Promise<string | null> {
  const res = await db.query<{ join_couple_by_pair_code: string | null }>(
    `SELECT public.join_couple_by_pair_code($1) AS join_couple_by_pair_code`,
    [code],
  );
  return res.rows[0]?.join_couple_by_pair_code ?? null;
}

async function scalar<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<Record<string, T>>(sql, params);
  return Object.values(res.rows[0] ?? {})[0] as T;
}

/** A fresh couple with a known code, one owner, and no partner yet. */
async function makeCouple(code: string, owner: string): Promise<string> {
  const id = await scalar<string>(
    `INSERT INTO public.couples (pair_code, created_by, is_active)
     VALUES ($1, $2, true) RETURNING id`,
    [code, owner],
  );
  await db.query(
    `INSERT INTO public.couple_members (couple_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [id, owner],
  );
  await db.query(`INSERT INTO public.pair_codes_issued (code) VALUES ($1) ON CONFLICT DO NOTHING`, [code]);
  return id;
}

beforeAll(async () => {
  db = new PGlite();

  // ── Shims. Everything here is scaffolding, NOT the thing under test. ──────
  await db.exec(SHIM_SQL);

  await db.query(
    `INSERT INTO auth.users (id, email) VALUES ($1,'a@x.test'),($2,'b@x.test'),($3,'c@x.test')`,
    [USER_A, USER_B, USER_C],
  );

  // ── The actual migration, executed verbatim from disk ─────────────────────
  await db.exec(readFileSync(MIGRATION, "utf8"));
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM public.couple_members;
    DELETE FROM public.couple_join_attempts;
    DELETE FROM public.couple_pair_code_rotations;
    DELETE FROM public.couples;
  `);
  await actAs(null);
});

// ─────────────────────────────────────────────────────────────────────────────

describe("א. the attempt counter actually accumulates", () => {
  it("records five failures, then blocks the sixth even with a VALID code", async () => {
    const coupleId = await makeCouple("AAAAAA", USER_A);
    await actAs(USER_B);

    for (let i = 0; i < 5; i++) {
      expect(await join("ZZZZZZ"), `attempt ${i + 1}`).toBeNull();
    }

    // THE assertion: the rows survived. A RAISE anywhere would have rolled
    // them back and this would be 0.
    const recorded = Number(
      await scalar(`SELECT count(*) FROM public.couple_join_attempts WHERE user_id = $1`, [USER_B]),
    );
    expect(recorded).toBe(5);

    // Sixth attempt uses the REAL code. It must still fail — that is what
    // distinguishes "rate limited" from "wrong code".
    expect(await join("AAAAAA")).toBeNull();
    expect(
      Number(await scalar(`SELECT count(*) FROM public.couple_members WHERE couple_id = $1`, [coupleId])),
    ).toBe(1);
  });

  it("counts per CALLER, not per code — a second user is unaffected", async () => {
    await makeCouple("BBBBBB", USER_A);
    await actAs(USER_B);
    for (let i = 0; i < 6; i++) await join("ZZZZZZ");

    await actAs(USER_C);
    expect(await join("BBBBBB")).not.toBeNull();
  });
});

describe("ב. a successful join retires the code permanently", () => {
  it("marks it used, and the same code cannot be redeemed again", async () => {
    const coupleId = await makeCouple("CCCCCC", USER_A);

    await actAs(USER_B);
    expect(await join("CCCCCC")).toBe(coupleId);

    const usedAt = await scalar(`SELECT pair_code_used_at FROM public.couples WHERE id = $1`, [coupleId]);
    expect(usedAt).not.toBeNull();

    await actAs(USER_C);
    expect(await join("CCCCCC")).toBeNull();
  });

  it("a member leaving does NOT revive the old code", async () => {
    const coupleId = await makeCouple("DDDDDD", USER_A);
    await actAs(USER_B);
    await join("DDDDDD");

    // Partner leaves — the couple is back to one seat.
    await db.query(`DELETE FROM public.couple_members WHERE couple_id = $1 AND user_id = $2`, [coupleId, USER_B]);
    expect(
      Number(await scalar(`SELECT count(*) FROM public.couple_members WHERE couple_id = $1`, [coupleId])),
    ).toBe(1);

    await actAs(USER_C);
    expect(await join("DDDDDD")).toBeNull();
  });
});

describe("ג. a retired code is never reissued", () => {
  it("stays reserved after rotation, and the reservation is enforced by the PK", async () => {
    const coupleId = await makeCouple("EEEEEE", USER_A);

    await actAs(USER_A);
    const newCode = await scalar<string>(`SELECT public.rotate_pair_code($1)`, [coupleId]);
    expect(newCode).not.toBe("EEEEEE");

    // Both the old and the new code remain reserved forever.
    for (const code of ["EEEEEE", newCode]) {
      expect(
        Number(await scalar(`SELECT count(*) FROM public.pair_codes_issued WHERE code = $1`, [code])),
      ).toBe(1);
    }

    // The reservation is a real constraint, not a convention.
    await expect(
      db.query(`INSERT INTO public.pair_codes_issued (code) VALUES ('EEEEEE')`),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("generate_pair_code never returns a code it has already issued", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = await scalar<string>(`SELECT public.generate_pair_code()`);
      expect(seen.has(code), `reissued ${code}`).toBe(false);
      seen.add(code);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});

describe("ד. rotation invalidates the previous code and is rate limited", () => {
  it("kills the old code the instant it commits", async () => {
    const coupleId = await makeCouple("FFFFFF", USER_A);
    await actAs(USER_A);
    const newCode = await scalar<string>(`SELECT public.rotate_pair_code($1)`, [coupleId]);

    await actAs(USER_B);
    expect(await join("FFFFFF")).toBeNull();
    expect(await join(newCode)).toBe(coupleId);
  });

  it("allows five rotations per hour and refuses the sixth", async () => {
    const coupleId = await makeCouple("GGGGGG", USER_A);
    await actAs(USER_A);
    for (let i = 0; i < 5; i++) {
      await db.query(`SELECT public.rotate_pair_code($1)`, [coupleId]);
    }
    await expect(db.query(`SELECT public.rotate_pair_code($1)`, [coupleId])).rejects.toThrow(
      /too many rotations/i,
    );
  });

  it("sets a FRESH expiry on rotation — a DEFAULT would not apply to an UPDATE", async () => {
    // A column DEFAULT fires on INSERT only. rotate_pair_code updates an
    // existing row, so if it leaned on the default the new code would inherit
    // the OLD expiry — and for a couple older than 14 days it would be born
    // already expired. This is the same bug as the missing DEFAULT, one level
    // up, and this test exists so nobody "simplifies" the explicit assignment
    // away later.
    const coupleId = await makeCouple("MMMMMM", USER_A);
    await db.query(
      `UPDATE public.couples
          SET created_at = now() - INTERVAL '20 days',
              pair_code_expires_at = now() - INTERVAL '6 days'
        WHERE id = $1`,
      [coupleId],
    );

    await actAs(USER_A);
    const newCode = await scalar<string>(`SELECT public.rotate_pair_code($1)`, [coupleId]);

    const daysLeft = Number(
      await scalar(
        `SELECT round(EXTRACT(EPOCH FROM (pair_code_expires_at - now())) / 86400)::int
           FROM public.couples WHERE id = $1`,
        [coupleId],
      ),
    );
    expect(daysLeft).toBe(14);

    // And the freshly rotated code is actually redeemable, which it would not
    // be if it had inherited the expired window.
    await actAs(USER_B);
    expect(await join(newCode)).toBe(coupleId);
  });

  it("refuses a caller who is not a member", async () => {
    const coupleId = await makeCouple("HHHHHH", USER_A);
    await actAs(USER_C);
    await expect(db.query(`SELECT public.rotate_pair_code($1)`, [coupleId])).rejects.toThrow(
      /not a member/i,
    );
  });
});

describe("ה. every failure path is indistinguishable", () => {
  it("returns exactly the same value for wrong, expired, used, full and blocked", async () => {
    // wrong
    await actAs(USER_B);
    const wrong = await join("ZZZZZZ");

    // expired
    const expiredId = await makeCouple("JJJJJJ", USER_A);
    await db.query(`UPDATE public.couples SET pair_code_expires_at = now() - INTERVAL '1 day' WHERE id = $1`, [expiredId]);
    const expired = await join("JJJJJJ");

    // already used
    const usedId = await makeCouple("KKKKKK", USER_A);
    await db.query(`UPDATE public.couples SET pair_code_used_at = now() WHERE id = $1`, [usedId]);
    const used = await join("KKKKKK");

    // full (two members, code still nominally live)
    const fullId = await makeCouple("LLLLLL", USER_A);
    await db.query(`INSERT INTO public.couple_members (couple_id, user_id, role) VALUES ($1,$2,'partner')`, [fullId, USER_C]);
    const full = await join("LLLLLL");

    // rate limited — the fifth failure above already took us to the threshold
    const blocked = await join("ZZZZZZ");

    const results = [wrong, expired, used, full, blocked];
    expect(results).toEqual([null, null, null, null, null]);
    expect(new Set(results).size).toBe(1);
  });
});

describe("ו. the three new tables are unreachable from anon and authenticated", () => {
  // The blocking condition on this migration. pair_codes_issued is the complete
  // list of every code that has ever existed: if anon or authenticated can read
  // it, the fix inverts — an attacker stops guessing and starts reading, then
  // joins every couple with a free seat. Same proof shape as C1 on user_sessions.
  const TABLES = [
    "pair_codes_issued",
    "couple_join_attempts",
    "couple_pair_code_rotations",
  ];

  it("grants no table privilege of any kind to anon or authenticated", async () => {
    const res = await db.query<{ grantee: string; table_name: string; privilege_type: string }>(
      `SELECT grantee, table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
          AND grantee = ANY(ARRAY['anon','authenticated'])
        ORDER BY table_name, grantee, privilege_type`,
      [TABLES],
    );
    // Must be empty. Any row here is a hole.
    expect(res.rows).toEqual([]);
  });

  it("has RLS both enabled and FORCED on all three", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname = ANY($1) AND relnamespace = 'public'::regnamespace
        ORDER BY relname`,
      [TABLES],
    );
    expect(res.rows).toHaveLength(3);
    for (const r of res.rows) {
      expect(r.relrowsecurity, `${r.relname} RLS enabled`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} RLS forced`).toBe(true);
    }
  });

  it("defines zero policies on them — the SECURITY DEFINER functions are the only path", async () => {
    const res = await db.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [TABLES],
    );
    expect(res.rows).toEqual([]);
  });
});

describe("ז. the migration is safe to run twice", () => {
  // There is no migration ledger in this project (FOLLOWUPS F21), so nothing
  // prevents a migration being applied twice — or being believed applied when
  // it was not. The standing rule from 202 onward is that a second run must be
  // a no-op: not an error, and not a duplicate. Proven, not asserted.
  async function freshDb() {
    const fresh = new PGlite();
    await fresh.exec(SHIM_SQL);
    await fresh.query(`INSERT INTO auth.users (id, email) VALUES ($1,'a@x.test')`, [USER_A]);
    return fresh;
  }

  const SQL = () => readFileSync(MIGRATION, "utf8");

  it("is a strict no-op when applied twice back to back", async () => {
    const fresh = await freshDb();
    await fresh.exec(SQL());

    const snap = async () =>
      JSON.stringify({
        codes: (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.pair_codes_issued`)).rows[0],
        couples: (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.couples`)).rows[0],
        attempts: (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.couple_join_attempts`)).rows[0],
      });

    const before = await snap();
    await expect(fresh.exec(SQL())).resolves.toBeDefined();
    expect(await snap()).toBe(before);
    await fresh.close();
  });

  it("stays a no-op with a couple created through the production path", async () => {
    const fresh = await freshDb();
    await fresh.exec(SQL());

    // The real path: the code comes from generate_pair_code(), which reserves
    // it in pair_codes_issued as it hands it out. A couple can only exist with
    // an unreserved code if someone bypassed the generator with raw SQL.
    const code = (
      await fresh.query<{ generate_pair_code: string }>(`SELECT public.generate_pair_code()`)
    ).rows[0]!.generate_pair_code;
    const coupleId = (
      await fresh.query<{ id: string }>(
        `INSERT INTO public.couples (pair_code, created_by, is_active) VALUES ($1,$2,true) RETURNING id`,
        [code, USER_A],
      )
    ).rows[0]!.id;
    await fresh.query(`INSERT INTO public.couple_members (couple_id,user_id,role) VALUES ($1,$2,'owner')`, [coupleId, USER_A]);

    const snap = async () =>
      JSON.stringify({
        codes: (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.pair_codes_issued`)).rows[0],
        row: (
          await fresh.query<{ e: string | null; u: string | null }>(
            `SELECT pair_code_expires_at::text AS e, pair_code_used_at::text AS u FROM public.couples WHERE id = $1`,
            [coupleId],
          )
        ).rows[0],
      });

    const before = await snap();
    await expect(fresh.exec(SQL())).resolves.toBeDefined();
    expect(await snap()).toBe(before);

    const dupes = await fresh.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (
         SELECT code FROM public.pair_codes_issued GROUP BY code HAVING count(*) > 1
       ) d`,
    );
    expect(dupes.rows[0]!.n).toBe(0);
    await fresh.close();
  });

  it("HEALS a code that bypassed the generator — documented, not accidental", async () => {
    // Raw INSERT, i.e. someone hand-created a couple in the SQL editor. The
    // backfill picks the code up on the next run and reserves it. This is the
    // one case where a re-run is not a strict no-op, and it is the desirable
    // direction: an unreserved live code could otherwise be handed to a second
    // couple by generate_pair_code.
    const fresh = await freshDb();
    await fresh.exec(SQL());
    await fresh.query(
      `INSERT INTO public.couples (pair_code, created_by, is_active) VALUES ('QQQQQQ',$1,true)`,
      [USER_A],
    );

    const before = Number(
      (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.pair_codes_issued WHERE code='QQQQQQ'`)).rows[0]!.n,
    );
    expect(before).toBe(0);

    await fresh.exec(SQL());

    const after = Number(
      (await fresh.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.pair_codes_issued WHERE code='QQQQQQ'`)).rows[0]!.n,
    );
    expect(after).toBe(1);
    await fresh.close();
  });
});
