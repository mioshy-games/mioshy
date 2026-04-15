"use client";

import { useMemo, useState } from "react";
import type { Question, SnakesConfig } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function makeId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

const categories = ["love", "dreams", "memories", "physical", "emotional", "fun", "custom"] as const;

export function QuestionEditor({ cfg }: { cfg: SnakesConfig }) {
  const [type, setType] = useState<Question["type"]>("question");
  const [textHe, setTextHe] = useState("");
  const [textEn, setTextEn] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("love");
  const [busy, setBusy] = useState(false);

  const questions = useMemo(() => cfg.questions ?? [], [cfg.questions]);

  async function save(next: Question[]) {
    setBusy(true);
    const res = await updateSnakesConfig(cfg.id, { questions: next as unknown[] });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else toast.success("Saved questions");
  }

  return (
    <div className="space-y-4">
      {questions.length < 5 ? (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
          Warning: question bank is small ({questions.length}). Recommended ≥ 5.
        </div>
      ) : null}

      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              type === "question" ? "bg-foreground text-background" : "bg-background"
            }`}
            onClick={() => setType("question")}
          >
            Question
          </button>
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              type === "challenge" ? "bg-foreground text-background" : "bg-background"
            }`}
            onClick={() => setType("challenge")}
          >
            Challenge
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Category</span>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof categories)[number])}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="text-sm font-semibold">Hebrew (RTL)</div>
            <Textarea dir="rtl" value={textHe} onChange={(e) => setTextHe(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <div className="text-sm font-semibold">English (LTR)</div>
            <Textarea dir="ltr" value={textEn} onChange={(e) => setTextEn(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={busy}
            onClick={async () => {
              if (!textHe.trim() || !textEn.trim()) {
                toast.error("Please fill both HE and EN text");
                return;
              }
              const q: Question = {
                id: makeId(),
                type,
                text_he: textHe.trim(),
                text_en: textEn.trim(),
                category,
              };
              await save([q, ...questions]);
              setTextHe("");
              setTextEn("");
            }}
          >
            Add question
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>HE</TableHead>
              <TableHead>EN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length ? (
              questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-semibold">{q.type}</TableCell>
                  <TableCell className="max-w-[320px] truncate" dir="rtl">
                    {q.text_he}
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate" dir="ltr">
                    {q.text_en}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{q.category}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(questions.filter((x) => x.id !== q.id))}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  No questions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

