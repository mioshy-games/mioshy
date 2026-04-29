import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { PromotionForm } from "@/components/dashboard/between-us/PromotionForm";
import { ArrowLeft } from "lucide-react";
import type { PromotionFormValues } from "@/lib/between-us/validations";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: promotion } = await supabase
    .from("promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) return notFound();

  const defaultValues: PromotionFormValues = {
    code: promotion.code ?? null,
    name_he: promotion.name_he ?? "",
    name_en: promotion.name_en ?? "",
    description_he: promotion.description_he ?? "",
    description_en: promotion.description_en ?? "",
    type: promotion.type,
    buy_qty: promotion.buy_qty ?? 1,
    get_qty: promotion.get_qty ?? 1,
    max_tiers: promotion.max_tiers ?? 2,
    is_active: promotion.is_active,
    starts_at: promotion.starts_at ?? null,
    ends_at: promotion.ends_at ?? null,
    applies_to_scope: promotion.applies_to_scope,
    stacking_allowed: promotion.stacking_allowed,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/adults/promotions"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to promotions
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {promotion.name_he || promotion.name_en || "Untitled promotion"}
        </h1>
        {promotion.code ? (
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            code: {promotion.code}
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">
            Automatic (no coupon code)
          </p>
        )}
      </div>

      <PromotionForm
        promotionId={promotion.id}
        defaultValues={defaultValues}
      />
    </div>
  );
}
