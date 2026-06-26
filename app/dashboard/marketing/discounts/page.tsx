/**
 * /dashboard/marketing/discounts — admin management of subscription discount
 * promos (marketing-discounts-spec §7). Admin-only (requireAdmin → redirect),
 * service-role reads. CRUD only — never touches the money path. Metadata only.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PromoDialog, type PromoRow } from "@/components/dashboard/marketing/PromoDialog";
import { PromoRowActions } from "@/components/dashboard/marketing/PromoRowActions";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdmin();
  const locale = getAdminLocale();
  const tt = (k: string) => t(locale, k);
  const rtl = isRtl(locale);
  const admin = createServiceRoleClient();

  if (!admin) {
    return (
      <div className="p-6" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-sm text-muted-foreground">{tt("insights.no_service_role")}</p>
      </div>
    );
  }

  const { data: promosRaw } = await admin
    .from("subscription_promos")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<PromoRow[]>();
  const promos = promosRaw ?? [];

  // Redemptions = subscriptions locked onto each promo.
  const { data: subs } = await admin
    .from("subscriptions")
    .select("promo_id")
    .not("promo_id", "is", null)
    .returns<{ promo_id: string | null }[]>();
  const used = new Map<string, number>();
  for (const s of subs ?? []) {
    if (s.promo_id) used.set(s.promo_id, (used.get(s.promo_id) ?? 0) + 1);
  }

  const valueLabel = (p: PromoRow) =>
    p.discount_type === "percent"
      ? `${p.percent ?? "—"}%`
      : [p.amount_ils != null ? `₪${p.amount_ils}` : null, p.amount_usd != null ? `$${p.amount_usd}` : null]
          .filter(Boolean)
          .join(" / ") || "—";
  const productLabel = (p: PromoRow) => tt(`promos.product.${p.product}`);
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US"); } catch { return iso; }
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tt("promos.title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("promos.desc")}</p>
        </div>
        <PromoDialog promo={null} locale={locale}>
          <Button type="button" className="gap-1.5">
            <Plus className="size-4" />
            {tt("promos.new")}
          </Button>
        </PromoDialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tt("promos.col.name")}</TableHead>
              <TableHead>{tt("promos.col.type")}</TableHead>
              <TableHead>{tt("promos.col.value")}</TableHead>
              <TableHead>{tt("promos.col.product")}</TableHead>
              <TableHead>{tt("promos.col.window")}</TableHead>
              <TableHead>{tt("promos.col.status")}</TableHead>
              <TableHead>{tt("promos.col.redemptions")}</TableHead>
              <TableHead className="text-end">{tt("promos.col.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {tt("promos.empty")}
                </TableCell>
              </TableRow>
            ) : (
              promos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.code ? <div className="font-mono text-xs text-muted-foreground" dir="ltr">{p.code}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tt(p.discount_type === "percent" ? "promos.type.percent" : "promos.type.fixed")}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums" dir="ltr">{valueLabel(p)}</TableCell>
                  <TableCell className="text-sm">{productLabel(p)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">
                    {fmt(p.starts_at)} → {fmt(p.ends_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {tt(p.is_active ? "promos.status.active" : "promos.status.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums" dir="ltr">
                    {used.get(p.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-end">
                    <PromoRowActions promo={p} locale={locale} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
