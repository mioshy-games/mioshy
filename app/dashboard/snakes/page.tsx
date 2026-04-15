import { requireAdmin } from "@/lib/auth/admin";
import { SnakesAdminClient } from "./SnakesAdminClient";
import type { SnakesConfig } from "./components/types";

export default async function SnakesAdminPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("snakes_ladders_config")
    .select("*")
    .order("created_at", { ascending: false });

  return <SnakesAdminClient configs={(data ?? []) as unknown as SnakesConfig[]} />;
}

