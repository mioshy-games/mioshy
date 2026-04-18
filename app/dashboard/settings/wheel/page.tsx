import { requireAdmin } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WheelSettingsClient } from "./wheel-settings-client";
import { getWheelDefaults } from "./actions";

export default async function WheelSettingsPage() {
  await requireAdmin();
  const defaults = await getWheelDefaults();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wheel &amp; Layout</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Global defaults applied to all games. Individual games can override these in their own settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global defaults</CardTitle>
          <CardDescription>
            Page layout, wheel size, label position, and shadow effects for every game.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WheelSettingsClient initialDefaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}

