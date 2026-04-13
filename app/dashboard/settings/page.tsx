import { requireAdmin } from "@/lib/auth/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
            {user.email ?? "—"}
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
