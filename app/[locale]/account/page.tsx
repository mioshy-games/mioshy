import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Heart, UserRoundCog, Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileGate } from "@/lib/auth/profile-gate";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import {
  listInvitationsForCouple,
  toInvitationUiSummary,
  type CoupleInvitationRow,
} from "@/lib/between-us/invitations";
import {
  cancelSubscription,
  freezeSubscription,
  resumeSubscription,
} from "./actions";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import { InvitePartnerByEmail } from "@/components/between-us/InvitePartnerByEmail";

type SubscriptionRow = {
  id: string;
  plan: "weekly" | "monthly" | "annual";
  status:
    | "active"
    | "cancelled"
    | "expired"
    | "past_due"
    | "blocked"
    | "frozen";
  current_period_end: string | null;
  grace_until: string | null;
  payment_method_id: string | null;
};

type ChargeRow = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "succeeded" | "failed";
  invoice_url: string | null;
  created_at: string;
};

type PaymentMethodRow = {
  id: string;
  card_brand: string | null;
  last4: string | null;
  status: "active" | "expired" | "revoked";
};

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const sp = (await searchParams) ?? {};
  // Two-tab layout (profile + billing) on a single URL - per spec a single
  // "החשבון שלי" header item houses both. Default = profile.
  const activeTab: "profile" | "billing" =
    sp.tab === "billing" ? "billing" : "profile";
  const t = await getTranslations({ locale, namespace: "account" });
  const supabase = await createServerSupabaseClient();
  const isHe = locale === "he";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth`);
  }

  // Profile completeness - drives the "complete profile" nudge on this page
  const profileGate = await getProfileGate();

  // Couple context + invitation history (for the "couple space" section)
  const coupleCtx = await getCurrentCoupleContext();
  const allInvitations: CoupleInvitationRow[] = coupleCtx?.couple_id
    ? await listInvitationsForCouple(coupleCtx.couple_id).catch(() => [])
    : [];
  const pendingInvitation = toInvitationUiSummary(
    allInvitations.find((i) => i.status === "pending") ?? null,
  );
  const pastInvitations = allInvitations.filter(
    (i) => i.status !== "pending",
  );
  const isCoupleOwner = coupleCtx?.role === "owner";
  const coupleNeedsPartner =
    !!coupleCtx?.couple_id && (coupleCtx.partner_count ?? 0) < 2;

  // Latest subscription (any status) - we still want to show cancelled/frozen
  const { data: subRaw } = await supabase
    .from("subscriptions")
    .select(
      "id, plan, status, current_period_end, grace_until, payment_method_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = (subRaw as SubscriptionRow | null) ?? null;

  // Full charge history (RLS guarantees only this user's rows)
  const { data: chargesRaw } = await supabase
    .from("subscription_charges")
    .select("id, amount, currency, status, invoice_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);

  const charges = (chargesRaw as ChargeRow[] | null) ?? [];

  // Payment method (masked - token_enc stays server-side)
  const { data: pmRaw } = sub?.payment_method_id
    ? await supabase
        .from("customer_payment_methods")
        .select("id, card_brand, last4, status")
        .eq("id", sub.payment_method_id)
        .maybeSingle()
    : { data: null };

  const pm = (pmRaw as PaymentMethodRow | null) ?? null;

  const plan = sub?.plan ?? null;
  const renewal =
    sub?.status === "active" && sub.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString(locale)
      : null;

  const statusLabel = (() => {
    if (!sub) return null;
    switch (sub.status) {
      case "active":    return t("statusActive");
      case "cancelled": return t("statusCancelled");
      case "frozen":    return t("statusFrozen");
      case "past_due":  return t("statusPastDue");
      case "blocked":   return t("statusBlocked");
      case "expired":   return t("statusExpired");
      default:          return sub.status;
    }
  })();

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency || "ILS",
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-10"
      dir={isHe ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LogoutButton className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition" />
      </div>

      {/* ── Grace / blocked banners (always visible across tabs) ────────── */}
      {sub?.status === "past_due" && (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {t("graceNotice")}
        </div>
      )}
      {sub?.status === "blocked" && (
        <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {t("blockedNotice")}
        </div>
      )}

      {/* ── Tab nav - two URLs (?tab=profile|billing) under one menu item ── */}
      <nav
        role="tablist"
        className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-sm"
      >
        <Link
          role="tab"
          aria-selected={activeTab === "profile"}
          href="/account"
          className={
            activeTab === "profile"
              ? "rounded-full bg-white/15 px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-white/65 hover:text-white"
          }
        >
          {isHe ? "פרטים" : "Profile"}
        </Link>
        <Link
          role="tab"
          aria-selected={activeTab === "billing"}
          href="/account?tab=billing"
          className={
            activeTab === "billing"
              ? "rounded-full bg-white/15 px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-white/65 hover:text-white"
          }
        >
          {isHe ? "תשלומים וחשבוניות" : "Billing & invoices"}
        </Link>
      </nav>

      {/* ── PROFILE TAB ──────────────────────────────────────────────────── */}
      {activeTab === "profile" ? (
      <>
      {/* ── Account identity ─────────────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t("email")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
            {profileGate ? (
              <div className="mt-3 text-xs text-muted-foreground">
                {isHe ? "שם מלא" : "Full name"}:{" "}
                <span className="font-semibold text-foreground">
                  {profileGate.full_name ?? (isHe ? "חסר" : "Missing")}
                </span>
                <span className="mx-2">·</span>
                {isHe ? "נייד" : "Mobile"}:{" "}
                <span className="font-semibold text-foreground">
                  {profileGate.mobile ?? (isHe ? "חסר" : "Missing")}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/account/profile"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white/85 transition hover:bg-white/10"
            >
              <UserRoundCog className="h-4 w-4" />
              {profileGate && !profileGate.complete
                ? isHe
                  ? "השלמת הפרופיל"
                  : "Complete profile"
                : isHe
                  ? "עריכת הפרופיל"
                  : "Edit profile"}
            </Link>
            <RedeemCodeButton isHe={isHe} variant="pill" />
          </div>
        </div>
        {profileGate && !profileGate.complete ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            {isHe
              ? "הפרופיל שלכם חסר פרטים. השלימו אותם כדי להתחיל לצמד ולפתוח משחקים."
              : "Your profile is missing details. Complete it to start pairing and unlock games."}
          </div>
        ) : null}
      </div>

      {/* ── Couple space ─────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-fuchsia-400" />
              {isHe ? "החלל הזוגי שלי" : "My couple space"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {coupleCtx?.couple_id
                ? coupleCtx.partner_count === 2
                  ? isHe
                    ? "החלל שלכם פעיל - שני חשבונות מחוברים."
                    : "Your couple is live - two accounts linked."
                  : isHe
                    ? "יש לכם חלל זוגי פעיל. מחכים שהפרטנר/ית יצטרפו."
                    : "You have an active couple space. Waiting for your partner to join."
                : isHe
                  ? "עוד לא יצרתם חלל זוגי. הוא יווצר אוטומטית ברכישה הראשונה."
                  : "No couple space yet - it's created automatically when you make your first purchase."}
            </p>
          </div>
          {coupleCtx?.couple_id ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
              <Users className="h-3.5 w-3.5 text-fuchsia-300" />
              {coupleCtx.partner_count}/2
            </div>
          ) : null}
        </div>

        {coupleCtx?.couple_id && coupleNeedsPartner ? (
          <div className="mt-4">
            <InvitePartnerByEmail
              locale={isHe ? "he" : "en"}
              isHe={isHe}
              invitation={pendingInvitation}
              canInvite={isCoupleOwner}
            />
          </div>
        ) : null}

        {coupleCtx?.couple_id && coupleCtx.partner_count === 2 ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {isHe
              ? "שני החשבונות פעילים. כל רכישה שתעשו תופיע אוטומטית אצל שניכם."
              : "Both accounts are active. Any purchase you make is shared automatically."}
          </div>
        ) : null}

        {pastInvitations.length > 0 ? (
          <details className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <summary className="cursor-pointer select-none font-semibold text-white/85">
              {isHe
                ? `הזמנות קודמות (${pastInvitations.length})`
                : `Past invitations (${pastInvitations.length})`}
            </summary>
            <ul className="mt-3 divide-y divide-white/10">
              {pastInvitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="truncate font-mono text-xs" dir="ltr">
                    {inv.invitee_email}
                  </span>
                  <span
                    className={
                      inv.status === "accepted"
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300"
                        : inv.status === "revoked"
                          ? "rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300"
                          : "rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/70"
                    }
                  >
                    {inv.status === "accepted"
                      ? isHe
                        ? "התקבלה"
                        : "Accepted"
                      : inv.status === "revoked"
                        ? isHe
                          ? "בוטלה"
                          : "Revoked"
                        : isHe
                          ? "פגה"
                          : "Expired"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      </>
      ) : null}

      {/* ── BILLING TAB ──────────────────────────────────────────────────── */}
      {activeTab === "billing" ? (
      <>
      {/* ── Plan + controls ──────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Per Itzik 2026-05-07: account labels were `text-sm
              font-semibold` and values `text-sm text-muted-foreground`
              — both faded into the dark gradient bg of the page. The
              "סטטוס: פעיל" line was nearly invisible. Bumped labels to
              13px uppercase tracking-wide white/55 (clear "field
              label" feel), and values to 18px font-semibold white
              (full opacity). The combination is the SaaS-readable
              spec-row pattern. */}
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
              {t("plan")}
            </div>
            <div className="mt-1.5 text-[18px] font-semibold text-white">
              {plan ? t(`plans.${plan}` as never) : t("noPlan")}
            </div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
              {t("status")}
            </div>
            <div className="mt-1.5 text-[18px] font-semibold text-white">
              {statusLabel ?? "-"}
            </div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
              {t("renewal")}
            </div>
            <div className="mt-1.5 text-[18px] font-semibold text-white">
              {renewal ?? t("noRenewal")}
            </div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
              {t("paymentMethod")}
            </div>
            <div className="mt-1.5 text-[18px] font-semibold text-white">
              {pm && pm.status === "active" && pm.last4
                ? t("paymentMethodEndsWith", { last4: pm.last4 })
                : t("paymentMethodNone")}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {sub?.status === "active" && (
            <>
              <form
                action={async () => {
                  "use server";
                  await freezeSubscription(sub.id);
                }}
              >
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                  title={t("freezeConfirm")}
                >
                  {t("freeze")}
                </button>
              </form>

              <form
                action={async () => {
                  "use server";
                  await cancelSubscription(sub.id);
                }}
              >
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 transition"
                  title={t("cancelConfirm")}
                >
                  {t("cancel")}
                </button>
              </form>
            </>
          )}

          {sub?.status === "frozen" && (
            <form
              action={async () => {
                "use server";
                await resumeSubscription(sub.id);
              }}
            >
              <button
                type="submit"
                className="min-h-[44px] rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 transition"
                title={t("resumeConfirm")}
              >
                {t("resume")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Invoices ─────────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border p-5">
        <div className="text-sm font-semibold">{t("invoices")}</div>
        {charges.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("invoicesPlaceholder")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {charges.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-white/90">
                    {formatAmount(Number(c.amount), c.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      c.status === "succeeded"
                        ? "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300"
                        : c.status === "failed"
                        ? "rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300"
                        : "rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70"
                    }
                  >
                    {c.status === "succeeded"
                      ? t("invoiceSucceeded")
                      : c.status === "failed"
                      ? t("invoiceFailed")
                      : c.status}
                  </span>
                  {c.invoice_url ? (
                    <a
                      href={c.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      {t("invoiceDownload")}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>
      ) : null}
    </main>
  );
}
