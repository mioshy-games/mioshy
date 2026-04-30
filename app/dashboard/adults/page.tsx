import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getBetweenUsSettings, getOverviewCounts } from "@/lib/between-us/queries";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Gamepad2,
  Tags,
  FolderTree,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

export default async function BetweenUsOverviewPage() {
  await requireAdmin();
  const [settings, counts] = await Promise.all([
    getBetweenUsSettings(),
    getOverviewCounts(),
  ]);

  const pricingLabel = `₪${Number(settings.single_price_ils).toFixed(0)} / $${Number(
    settings.single_price_usd,
  ).toFixed(0)}`;
  const monthlyLabel = `₪${Number(settings.monthly_price_ils).toFixed(
    0,
  )} / $${Number(settings.monthly_price_usd).toFixed(0)}/mo`;
  const annualLabel = `₪${Number(settings.annual_price_ils).toFixed(
    0,
  )} / $${Number(settings.annual_price_usd).toFixed(0)}/yr`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Adults Only - {settings.section_name_he}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The couples-games content library. Add games, manage pricing, toggle
            promotions. All changes are live immediately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/adults/games/new"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            + New game
          </Link>
          <Link
            href="/dashboard/adults/settings"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Status strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPill
          label="Single purchase"
          active={settings.single_purchase_enabled}
          detail={settings.single_purchase_enabled ? pricingLabel : "Disabled"}
        />
        <StatusPill
          label="Monthly membership"
          active={settings.monthly_enabled}
          detail={settings.monthly_enabled ? monthlyLabel : "Off"}
        />
        <StatusPill
          label="Annual membership"
          active={settings.annual_enabled}
          detail={settings.annual_enabled ? annualLabel : "Off"}
        />
        <StatusPill
          label="Buy X Get X"
          active={settings.buy_x_get_x_enabled}
          detail={
            settings.buy_x_get_x_enabled
              ? settings.buy_x_get_x_tiers
                  .map((t) => `${t.buy}+${t.get}`)
                  .join(" · ")
              : "Off"
          }
        />
      </div>

      {/* Count cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          icon={<Gamepad2 className="size-5" />}
          label="Games"
          value={counts.games}
          hint={`${counts.activeGames} active`}
          href="/dashboard/adults/games"
        />
        <CountCard
          icon={<FolderTree className="size-5" />}
          label="Categories"
          value={counts.categories}
          href="/dashboard/adults/categories"
        />
        <CountCard
          icon={<Tags className="size-5" />}
          label="Tags"
          value={counts.tags}
          href="/dashboard/adults/tags"
        />
        <CountCard
          icon={<Sparkles className="size-5" />}
          label="Promotions"
          value={counts.promotions}
          hint={`${counts.activePromotions} active`}
          href="/dashboard/adults/promotions"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5" /> Quick links
          </CardTitle>
          <CardDescription>
            Everything about this section is editable from the admin -
            no code changes required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/dashboard/adults/games"
                className="text-primary underline-offset-4 hover:underline"
              >
                Manage games
              </Link>
              {" - "}add, edit, publish/unpublish, duplicate, archive
            </li>
            <li>
              <Link
                href="/dashboard/adults/settings"
                className="text-primary underline-offset-4 hover:underline"
              >
                Section settings
              </Link>
              {" - "}pricing, promotions toggle, subscription toggle, section
              name
            </li>
            <li>
              <Link
                href="/dashboard/adults/categories"
                className="text-primary underline-offset-4 hover:underline"
              >
                Categories
              </Link>
              {" & "}
              <Link
                href="/dashboard/adults/tags"
                className="text-primary underline-offset-4 hover:underline"
              >
                Tags
              </Link>
              {" - "}taxonomy for filtering
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div className="border-border bg-card flex items-center justify-between rounded-lg border p-4">
      <div>
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-medium">{detail}</div>
      </div>
      <Badge variant={active ? "default" : "secondary"}>
        {active ? "ON" : "OFF"}
      </Badge>
    </div>
  );
}

function CountCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </Link>
  );
}
