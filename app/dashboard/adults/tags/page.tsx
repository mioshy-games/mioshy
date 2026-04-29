import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listTags } from "@/lib/between-us/queries";
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
import { TagActions } from "@/components/dashboard/between-us/TagActions";
import { NewTaxonomyButton } from "@/components/dashboard/between-us/NewTaxonomyButton";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TagsListPage() {
  await requireAdmin();
  const tags = await listTags(false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/adults"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Lightweight labels for cross-filtering games (e.g. &quot;date night&quot;, &quot;anniversary&quot;,
            &quot;long distance&quot;).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/adults/categories"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Categories
          </Link>
          <NewTaxonomyButton kind="tag" />
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center"
                >
                  No tags yet — click &quot;New tag&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <ColorDot hex={t.color_hex} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.name_he}</div>
                    <div className="text-muted-foreground text-xs">
                      {t.name_en}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {t.slug}
                  </TableCell>
                  <TableCell>
                    <TagChip colorHex={t.color_hex} label={t.name_he} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TagActions tagId={t.id} />
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

function ColorDot({ hex }: { hex: string | null }) {
  return (
    <div
      className="border-border size-4 rounded-full border"
      style={{ background: hex ?? "transparent" }}
    />
  );
}

function TagChip({ colorHex, label }: { colorHex: string | null; label: string }) {
  const bg = colorHex || "#e5e7eb";
  const fg = readableFg(bg);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: bg, color: fg }}
      dir="rtl"
    >
      {label}
    </span>
  );
}

function readableFg(hex: string): string {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111111" : "#ffffff";
}
