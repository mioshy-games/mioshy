import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listPromotions } from "@/lib/between-us/queries";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PromotionActions } from "@/components/dashboard/between-us/PromotionActions";
import { NewPromotionButton } from "@/components/dashboard/between-us/NewPromotionButton";

export const dynamic = "force-dynamic";

export default async function PromotionsListPage() {
  await requireAdmin();
  const promotions = await listPromotions(false);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/adults"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bundles, percent-off, and coupon codes. Scope each promotion to the
            Adults Only section or across all products. Activate / deactivate
            instantly from this list.
          </p>
        </div>
        <NewPromotionButton />
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  No promotions yet — click &quot;New promotion&quot; to create
                  one.
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name_he}</div>
                    {p.name_en ? (
                      <div className="text-muted-foreground text-xs">
                        {p.name_en}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.code ? (
                      p.code
                    ) : (
                      <span className="text-muted-foreground">auto</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <TypeLabel
                      type={p.type}
                      buy={p.buy_qty}
                      get={p.get_qty}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    <ScopeLabel scope={p.applies_to_scope} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <WindowLabel starts={p.starts_at} ends={p.ends_at} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <PromotionActions
                      promotionId={p.id}
                      isActive={p.is_active}
                    />
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

function TypeLabel({
  type,
  buy,
  get,
}: {
  type: string;
  buy: number;
  get: number;
}) {
  if (type === "buy_x_get_y") {
    return (
      <span>
        Buy <strong>{buy}</strong> Get <strong>{get}</strong>
      </span>
    );
  }
  if (type === "percent_off") {
    return (
      <span>
        <strong>{get}%</strong> off
      </span>
    );
  }
  if (type === "amount_off") {
    return (
      <span>
        <strong>{get}</strong> off
      </span>
    );
  }
  return <span>{type}</span>;
}

function ScopeLabel({ scope }: { scope: string }) {
  const map: Record<string, string> = {
    between_us: "Adults Only",
    wheel: "Wheel",
    snakes: "Snakes",
    all: "All sections",
  };
  return <span>{map[scope] ?? scope}</span>;
}

function WindowLabel({
  starts,
  ends,
}: {
  starts: string | null;
  ends: string | null;
}) {
  if (!starts && !ends) return <span>Always</span>;
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };
  return (
    <span>
      {fmt(starts)} → {fmt(ends)}
    </span>
  );
}
