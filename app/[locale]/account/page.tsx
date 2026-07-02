import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import {
  Heart,
  UserRoundCog,
  Users,
  CreditCard,
  Receipt,
  ShieldCheck,
  Mail,
  Phone,
  CalendarDays,
  CircleDot,
  Sparkles,
  AlertTriangle,
  Download,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileGate } from "@/lib/auth/profile-gate";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import {
  listInvitationsForCouple,
  type CoupleInvitationRow,
} from "@/lib/between-us/invitations";
import {
  cancelSubscription,
  freezeSubscription,
  resumeSubscription,
} from "./actions";
import { getCurrentUserPauseState } from "@/lib/billing/pause-state";
import { PauseSubscription } from "@/components/account/PauseSubscription";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";

type SubscriptionRow = {
  id: string;
  plan: "weekly" | "monthly" | "annual";
  status:
    | "active"
    | "cancelled"
    | "expired"
    | "past_due"
    | "blocked"
    | "frozen"
    | "trialing";
  current_period_end: string | null;
  grace_until: string | null;
  trial_ends_at: string | null;
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

  // Layer-3 pause state — read once, pass into the new pause component.
  const pauseState = await getCurrentUserPauseState();

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
  const pastInvitations = allInvitations.filter(
    (i) => i.status !== "pending",
  );

  // Latest subscription (any status) - we still want to show cancelled/frozen
  const { data: subRaw } = await supabase
    .from("subscriptions")
    .select(
      "id, plan, status, current_period_end, grace_until, trial_ends_at, payment_method_id",
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
      // A3: inline label (no new i18n key needed).
      case "trialing":  return isHe ? "בתקופת ניסיון" : "Free trial";
      default:          return sub.status;
    }
  })();

  // A3: trial disclosure — "you'll be charged on <date>". The first charge is
  // the snapshot amount (promo-aware) taken at signup; we don't re-resolve it
  // here, so we show the date and let the charge email carry the exact amount.
  const trialEndsLabel =
    sub?.status === "trialing" && sub.trial_ends_at
      ? new Date(sub.trial_ends_at).toLocaleDateString(locale)
      : null;

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

  // ─────────────────────────────────────────────────────────────
  // Derived display values for the hero
  // ─────────────────────────────────────────────────────────────
  const displayName =
    profileGate?.full_name?.trim() ||
    (user.email?.split("@")[0] ?? (isHe ? "חבר/ה" : "Friend"));
  const initials = (() => {
    const src = displayName || user.email || "";
    const parts = src.replace(/[._-]/g, " ").trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
  })();
  const subStatusTone = (() => {
    if (!sub) return "muted";
    if (sub.status === "active") return "emerald";
    if (sub.status === "trialing") return "emerald";
    if (sub.status === "frozen") return "sky";
    if (sub.status === "past_due") return "amber";
    if (sub.status === "blocked") return "rose";
    return "muted";
  })();
  const subStatusClasses: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
    sky:     "bg-sky-500/15 text-sky-200 border-sky-400/40",
    amber:   "bg-amber-500/15 text-amber-200 border-amber-400/40",
    rose:    "bg-rose-500/15 text-rose-200 border-rose-400/40",
    muted:   "bg-white/10 text-white/70 border-white/15",
  };

  return (
    <main
      className="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-fuchsia-500/[0.06] p-6 shadow-[0_8px_40px_-12px_rgba(232,121,249,0.25)] backdrop-blur-xl sm:p-8"
      >
        <div className="pointer-events-none absolute -end-20 -top-24 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-violet-500 text-xl font-extrabold text-white shadow-lg sm:h-20 sm:w-20 sm:text-2xl">
              {initials || "M"}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/90">
                {t("title")}
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {displayName}
              </h1>
              <p className="mt-1 truncate text-sm text-white/65" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>

          {/* Status pills row */}
          <div className="flex flex-wrap items-center gap-2">
            {sub && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${subStatusClasses[subStatusTone]}`}
              >
                <CircleDot className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
            )}
            {coupleCtx?.couple_id ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200">
                <Heart className="h-3.5 w-3.5" />
                {coupleCtx.partner_count}/2 {isHe ? "מחוברים" : "linked"}
              </span>
            ) : null}
            <LogoutButton className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-white/25 hover:bg-white/10 hover:text-white" />
          </div>
        </div>

        {/* Profile-completion alert (only when missing) */}
        {profileGate && !profileGate.complete ? (
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                {isHe
                  ? "הפרופיל שלכם חסר פרטים. השלימו כדי להתחיל לצמד ולפתוח משחקים."
                  : "Your profile is missing details. Complete it to start pairing and unlock games."}
              </span>
            </div>
            <Link
              href="/account/profile"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/20 px-3.5 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-400/30"
            >
              <UserRoundCog className="h-3.5 w-3.5" />
              {isHe ? "השלמה" : "Complete"}
            </Link>
          </div>
        ) : null}
      </section>

      {/* ── Grace / blocked banners ─────────────────────────────────────── */}
      {sub?.status === "past_due" && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("graceNotice")}</span>
        </div>
      )}
      {sub?.status === "blocked" && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("blockedNotice")}</span>
        </div>
      )}

      {/* ── TAB NAV (sticky, full-width, segmented) ─────────────────────── */}
      <nav
        role="tablist"
        className="mt-8 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
      >
        <Link
          role="tab"
          aria-selected={activeTab === "profile"}
          href="/account"
          className={
            activeTab === "profile"
              ? "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25"
              : "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/5 hover:text-white"
          }
        >
          <UserRoundCog className="h-4 w-4" />
          {isHe ? "פרופיל וזוגיות" : "Profile & couple"}
        </Link>
        <Link
          role="tab"
          aria-selected={activeTab === "billing"}
          href="/account?tab=billing"
          className={
            activeTab === "billing"
              ? "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25"
              : "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/5 hover:text-white"
          }
        >
          <CreditCard className="h-4 w-4" />
          {isHe ? "מנוי וחשבוניות" : "Billing & invoices"}
        </Link>
      </nav>

      {/* ── PROFILE TAB ─────────────────────────────────────────────────── */}
      {activeTab === "profile" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Couple space — wide card */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl lg:col-span-3">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isHe ? "החלל הזוגי שלי" : "My couple space"}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {coupleCtx?.couple_id
                      ? coupleCtx.partner_count === 2
                        ? isHe
                          ? "החלל שלכם פעיל — שני חשבונות מחוברים."
                          : "Your couple is live — two accounts linked."
                        : isHe
                          ? "החלל שלכם פעיל. מחכים שהפרטנר/ית יצטרפו."
                          : "Your couple is active. Waiting for your partner to join."
                      : isHe
                        ? "עוד לא יצרתם חלל זוגי. הוא יווצר אוטומטית ברכישה הראשונה."
                        : "No couple space yet — created automatically on first purchase."}
                  </p>
                </div>
              </div>
              {coupleCtx?.couple_id ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                  <Users className="h-3.5 w-3.5 text-fuchsia-300" />
                  {coupleCtx.partner_count}/2
                </span>
              ) : null}
            </header>

            {coupleCtx?.couple_id && coupleCtx.partner_count === 2 ? (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>
                  {isHe
                    ? "שני החשבונות פעילים. כל רכישה תופיע אוטומטית אצל שניכם."
                    : "Both accounts are active. Any purchase is shared automatically."}
                </span>
              </div>
            ) : null}

            {pastInvitations.length > 0 ? (
              <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/70">
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
                          ? isHe ? "התקבלה" : "Accepted"
                          : inv.status === "revoked"
                            ? isHe ? "בוטלה" : "Revoked"
                            : isHe ? "פגה" : "Expired"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {/* Account details — narrower side card */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl lg:col-span-2">
            <header className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isHe ? "פרטי החשבון" : "Account details"}
                </h2>
                <p className="mt-1 text-xs text-white/55">
                  {isHe ? "הנתונים שמשמשים לצימוד וחיוב." : "Used for pairing and billing."}
                </p>
              </div>
            </header>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    {isHe ? "אימייל" : "Email"}
                  </dt>
                  <dd className="mt-0.5 truncate font-semibold text-white" dir="ltr">
                    {user.email}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserRoundCog className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    {isHe ? "שם מלא" : "Full name"}
                  </dt>
                  <dd
                    className={`mt-0.5 font-semibold ${profileGate?.full_name ? "text-white" : "text-amber-300"}`}
                  >
                    {profileGate?.full_name ?? (isHe ? "חסר" : "Missing")}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    {isHe ? "נייד" : "Mobile"}
                  </dt>
                  <dd
                    className={`mt-0.5 font-semibold ${profileGate?.mobile ? "text-white" : "text-amber-300"}`}
                    dir="ltr"
                  >
                    {profileGate?.mobile ?? (isHe ? "חסר" : "Missing")}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/account/profile"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-bold text-white transition hover:bg-white/[0.12]"
              >
                <UserRoundCog className="h-4 w-4" />
                {profileGate && !profileGate.complete
                  ? isHe ? "השלמת הפרופיל" : "Complete profile"
                  : isHe ? "עריכת הפרופיל" : "Edit profile"}
              </Link>
              <RedeemCodeButton isHe={isHe} variant="pill" />
            </div>
          </section>
        </div>
      ) : null}

      {/* ── BILLING TAB ─────────────────────────────────────────────────── */}
      {activeTab === "billing" ? (
        <div className="mt-6 space-y-5">
          {/* Subscription overview */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <header className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isHe ? "המנוי שלי" : "My subscription"}
                </h2>
                <p className="mt-1 text-xs text-white/55">
                  {isHe ? "פרטי החיוב והחידוש." : "Plan, renewal and payment method."}
                </p>
              </div>
            </header>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {t("plan")}
                </div>
                <div className="mt-1.5 text-lg font-extrabold text-white">
                  {plan ? t(`plans.${plan}` as never) : t("noPlan")}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {t("status")}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-lg font-extrabold text-white">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      subStatusTone === "emerald"
                        ? "bg-emerald-400"
                        : subStatusTone === "rose"
                          ? "bg-rose-400"
                          : subStatusTone === "amber"
                            ? "bg-amber-400"
                            : subStatusTone === "sky"
                              ? "bg-sky-400"
                              : "bg-white/40"
                    }`}
                  />
                  {statusLabel ?? "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("renewal")}
                </div>
                <div className="mt-1.5 text-lg font-extrabold text-white">
                  {renewal ?? t("noRenewal")}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("paymentMethod")}
                </div>
                <div className="mt-1.5 text-lg font-extrabold text-white" dir="ltr">
                  {pm && pm.status === "active" && pm.last4
                    ? t("paymentMethodEndsWith", { last4: pm.last4 })
                    : t("paymentMethodNone")}
                </div>
              </div>
            </div>

            {/* Pause flow */}
            {sub?.status === "active" || pauseState.isActive ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <PauseSubscription
                  isHe={isHe}
                  hasActivePause={pauseState.isActive}
                  pausedUntil={pauseState.pausedUntil}
                />
              </div>
            ) : null}

            {/* Subscription controls */}
            {(sub?.status === "active" || sub?.status === "frozen") && (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-5">
                {sub.status === "active" && (
                  <>
                    <form
                      action={async () => {
                        "use server";
                        await freezeSubscription(sub.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-bold text-white/85 transition hover:bg-white/[0.12]"
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
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
                        title={t("cancelConfirm")}
                      >
                        {t("cancel")}
                      </button>
                    </form>
                  </>
                )}
                {sub.status === "frozen" && (
                  <form
                    action={async () => {
                      "use server";
                      await resumeSubscription(sub.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20"
                      title={t("resumeConfirm")}
                    >
                      {t("resume")}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* A3: trial — disclosure + one-click cancel (no charge) */}
            {sub?.status === "trialing" && (
              <div className="mt-6 border-t border-white/10 pt-5">
                {trialEndsLabel && (
                  <p className="mb-4 text-sm text-white/70">
                    {isHe
                      ? `תקופת הניסיון מסתיימת ב-${trialEndsLabel}. אז יתבצע החיוב הראשון. אפשר לבטל עד אז בלי חיוב.`
                      : `Your free trial ends on ${trialEndsLabel}. Your first charge happens then. Cancel any time before that — no charge.`}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await cancelSubscription(sub.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
                    >
                      {isHe ? "ביטול הניסיון (בלי חיוב)" : "Cancel trial (no charge)"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>

          {/* Invoices */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <header className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t("invoices")}
                </h2>
                <p className="mt-1 text-xs text-white/55">
                  {isHe ? "היסטוריית חיובים והורדת חשבוניות." : "Charge history and invoice downloads."}
                </p>
              </div>
            </header>

            {charges.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/55">
                {t("invoicesPlaceholder")}
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                {charges.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-8 w-8 place-items-center rounded-lg ${
                          c.status === "succeeded"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : c.status === "failed"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-white/10 text-white/70"
                        }`}
                      >
                        {c.status === "succeeded" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : c.status === "failed" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CircleDot className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white">
                          {formatAmount(Number(c.amount), c.currency)}
                        </span>
                        <span className="text-xs text-white/55">
                          {new Date(c.created_at).toLocaleDateString(locale)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
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
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/85 transition hover:bg-white/[0.12]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t("invoiceDownload")}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {/* ── Account footer (mobile-friendly sign out, in case missed in hero) */}
      <div className="mt-8 flex items-center justify-center">
        <LogoutButton className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white sm:hidden" />
      </div>
    </main>
  );
}
