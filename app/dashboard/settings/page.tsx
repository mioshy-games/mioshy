import { requireAdmin } from "@/lib/auth/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardSettingsPage() {
  const { user } = await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Account and environment hints for admins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription pricing</CardTitle>
          <CardDescription>
            Edit games/journey prices per cadence. Live on save — no deploy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/settings/pricing"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open Pricing
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7-day free trial</CardTitle>
          <CardDescription>
            Choose which subscriptions offer a 7-day free trial (games / journey
            with or without coaching). Live on save — no deploy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/settings/trial"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open Trial Settings
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game wheel</CardTitle>
          <CardDescription>
            Set global default wheel size and label position for all games.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/settings/wheel"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open Wheel Settings
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>
            Admin session is enforced by middleware and layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">User ID:</span>{" "}
            <span className="font-mono text-xs">{user.id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {user.email ?? "-"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supabase</CardTitle>
          <CardDescription>
            Configure project keys in <code className="text-xs">.env.local</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Use <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for
            client and server helpers.
          </p>
          <p>
            Grant admin by setting{" "}
            <code className="text-xs">profiles.role = &apos;admin&apos;</code>{" "}
            for your user in Supabase Studio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
