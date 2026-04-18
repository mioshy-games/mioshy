import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelSubscription } from "./actions";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth`);
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_end, stripe_subscription_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = sub?.status === "active" ? sub.plan : null;
  const renewal =
    sub?.status === "active" && sub.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString(locale)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LogoutButton className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition" />
      </div>

      <div className="mt-8 rounded-2xl border p-5">
        <div className="text-sm font-semibold">{t("email")}</div>
        <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
      </div>

      <div className="mt-4 rounded-2xl border p-5">
        <div className="text-sm font-semibold">{t("plan")}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {plan ? t(`plans.${plan}` as never) : t("noPlan")}
        </div>
        <div className="mt-3 text-sm font-semibold">{t("renewal")}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {renewal ?? t("noRenewal")}
        </div>

        {sub?.status === "active" ? (
          <form
            action={async () => {
              "use server";
              await cancelSubscription(sub.id);
            }}
          >
            <button
              type="submit"
              className="mt-5 min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              {t("cancel")}
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border p-5">
        <div className="text-sm font-semibold">{t("invoices")}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t("invoicesPlaceholder")}</p>
      </div>
    </main>
  );
}

