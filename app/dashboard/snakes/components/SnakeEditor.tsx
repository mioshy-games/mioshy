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

function validateSnake(s: SnakeOrLadder, boardSize: number) {
  if (s.from < 1 || s.from > boardSize) return "from must be within board";
  if (s.to < 1 || s.to > boardSize) return "to must be within board";
  if (s.to >= s.from) return "snake must go down (to < from)";
  return null;
}

export function SnakeEditor({ cfg }: { cfg: SnakesConfig }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [emoji, setEmoji] = useState("🐍");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const ladderFroms = useMemo(() => new Set(cfg.ladders.map((l) => l.from)), [cfg.ladders]);
  const snakes = cfg.snakes ?? [];

  async function save(next: SnakeOrLadder[]) {
    setBusy(true);
    const res = await updateSnakesConfig(cfg.id, { snakes: next as unknown[] });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else toast.success("Saved snakes");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🐍" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={busy}
            onClick={async () => {
              const s: SnakeOrLadder = {
                from: toInt(from),
                to: toInt(to),
                emoji: (emoji || "🐍").slice(0, 8),
                label: label.trim(),
              };
              const err = validateSnake(s, cfg.board_size);
              if (err) {
                toast.error(err);
                return;
              }
              if (snakes.some((x) => x.from === s.from)) {
                toast.error("Duplicate 'from' cell");
                return;
              }
              if (ladderFroms.has(s.from)) {
                toast.error("Overlaps with a ladder");
                return;
              }
              await save([...snakes, s].sort((a, b) => b.from - a.from));
              setFrom("");
              setTo("");
              setLabel("");
            }}
          >
            Add snake
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
            {snakes.length ? (
              snakes.map((s) => (
                <TableRow key={`${s.from}-${s.to}`}>
                  <TableCell className="font-mono">{s.from}</TableCell>
                  <TableCell className="font-mono">{s.to}</TableCell>
                  <TableCell>{s.emoji}</TableCell>
                  <TableCell className="text-muted-foreground">{s.label || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(snakes.filter((x) => x.from !== s.from))}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  No snakes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

