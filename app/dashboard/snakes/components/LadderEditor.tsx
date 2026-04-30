"use client";

import { useMemo, useState } from "react";
import type { SnakesConfig, SnakeOrLadder } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { updateSnakesConfig } from "@/app/dashboard/actions/snakes";

function toInt(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

function validateLadder(l: SnakeOrLadder, boardSize: number) {
  if (l.from < 1 || l.from > boardSize) return "from must be within board";
  if (l.to < 1 || l.to > boardSize) return "to must be within board";
  if (l.to <= l.from) return "ladder must go up (to > from)";
  return null;
}

export function LadderEditor({ cfg }: { cfg: SnakesConfig }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [emoji, setEmoji] = useState("🌈");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const snakeFroms = useMemo(() => new Set(cfg.snakes.map((s) => s.from)), [cfg.snakes]);
  const ladders = cfg.ladders ?? [];

  async function save(next: SnakeOrLadder[]) {
    setBusy(true);
    const res = await updateSnakesConfig(cfg.id, { ladders: next as unknown[] });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else toast.success("Saved ladders");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🌈" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={busy}
            onClick={async () => {
              const l: SnakeOrLadder = {
                from: toInt(from),
                to: toInt(to),
                emoji: (emoji || "🌈").slice(0, 8),
                label: label.trim(),
              };
              const err = validateLadder(l, cfg.board_size);
              if (err) {
                toast.error(err);
                return;
              }
              if (ladders.some((x) => x.from === l.from)) {
                toast.error("Duplicate 'from' cell");
                return;
              }
              if (snakeFroms.has(l.from)) {
                toast.error("Overlaps with a snake");
                return;
              }
              await save([...ladders, l].sort((a, b) => b.from - a.from));
              setFrom("");
              setTo("");
              setLabel("");
            }}
          >
            Add ladder
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Emoji</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ladders.length ? (
              ladders.map((l) => (
                <TableRow key={`${l.from}-${l.to}`}>
                  <TableCell className="font-mono">{l.from}</TableCell>
                  <TableCell className="font-mono">{l.to}</TableCell>
                  <TableCell>{l.emoji}</TableCell>
                  <TableCell className="text-muted-foreground">{l.label || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(ladders.filter((x) => x.from !== l.from))}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  No ladders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

