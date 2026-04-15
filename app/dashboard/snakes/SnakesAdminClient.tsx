"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SnakesConfig } from "./components/types";
import { ConfigManager } from "./components/ConfigManager";
import { SnakeEditor } from "./components/SnakeEditor";
import { LadderEditor } from "./components/LadderEditor";
import { QuestionEditor } from "./components/QuestionEditor";
import { CoinEditor } from "./components/CoinEditor";
import { PenaltyEditor } from "./components/PenaltyEditor";
import { BoardPreview } from "./components/BoardPreview";

export function SnakesAdminClient({ configs }: { configs: SnakesConfig[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    configs.find((c) => c.is_active)?.id ?? configs[0]?.id ?? null,
  );

  const selected = useMemo(
    () => configs.find((c) => c.id === selectedId) ?? null,
    [configs, selectedId],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Snakes & Ladders</h1>
        <p className="text-muted-foreground text-sm">
          Full config editor (active config is used for new rooms).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-2xl border p-4">
          <ConfigManager
            configs={configs}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div className="rounded-2xl border p-4">
          {selected ? (
            <Tabs defaultValue="preview">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="snakes">Snakes</TabsTrigger>
                <TabsTrigger value="ladders">Ladders</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="coin">Coin</TabsTrigger>
                <TabsTrigger value="penalty">Penalties</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <BoardPreview cfg={selected} />
              </TabsContent>
              <TabsContent value="snakes" className="mt-4">
                <SnakeEditor cfg={selected} />
              </TabsContent>
              <TabsContent value="ladders" className="mt-4">
                <LadderEditor cfg={selected} />
              </TabsContent>
              <TabsContent value="questions" className="mt-4">
                <QuestionEditor cfg={selected} />
              </TabsContent>
              <TabsContent value="coin" className="mt-4">
                <CoinEditor cfg={selected} />
              </TabsContent>
              <TabsContent value="penalty" className="mt-4">
                <PenaltyEditor cfg={selected} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-muted-foreground text-sm">Select a config…</div>
          )}
        </div>
      </div>
    </div>
  );
}

