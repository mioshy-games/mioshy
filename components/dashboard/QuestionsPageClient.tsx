"use client";

import { useMemo, useState } from "react";
import { QuestionsTable, type QuestionTableRow } from "@/components/dashboard/QuestionsTable";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuestionsPageClient({
  initialQuestions,
}: {
  initialQuestions: QuestionTableRow[];
}) {
  const [type, setType] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");

  const filtered = useMemo(() => {
    return initialQuestions.filter((q) => {
      if (type !== "all" && q.type !== type) return false;
      if (level !== "all" && q.level !== level) return false;
      return true;
    });
  }, [initialQuestions, type, level]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="truth">Truth</SelectItem>
              <SelectItem value="dare">Dare</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Level</Label>
          <Select
            value={level}
            onValueChange={(v) => setLevel(v ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="flirty">Flirty</SelectItem>
              <SelectItem value="deep">Deep</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <QuestionsTable
        gameId={null}
        initialQuestions={filtered}
        mode="global"
      />
    </div>
  );
}
