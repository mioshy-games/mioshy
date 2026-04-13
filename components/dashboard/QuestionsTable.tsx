"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FormProvider,
  useForm,
} from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteQuestion,
  upsertQuestion,
} from "@/app/dashboard/actions/questions";
import { questionFormSchema, type QuestionFormValues } from "@/lib/validations";
import type { QuestionRow } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LocalizedFieldRow } from "@/components/dashboard/LocalizedFieldRow";

const emptyQuestion: QuestionFormValues = {
  type: "truth",
  level: "light",
  text_he: "",
  text_en: "",
  is_active: true,
};

export type QuestionTableRow = QuestionRow & {
  game_name?: string;
};

type QuestionsTableProps = {
  /** Fixed game (embedded in GameForm). When null, use row.game_id. */
  gameId: string | null;
  initialQuestions: QuestionTableRow[];
  mode?: "embedded" | "global";
};

export function QuestionsTable({
  gameId,
  initialQuestions,
  mode = "embedded",
}: QuestionsTableProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<QuestionTableRow | null>(null);
  const [deleting, setDeleting] = useState<QuestionTableRow | null>(null);
  const [busy, setBusy] = useState(false);

  const methods = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: emptyQuestion,
  });

  const { handleSubmit, reset, control } = methods;

  function resolveTargetGameId(forRow?: QuestionTableRow | null) {
    return gameId ?? forRow?.game_id ?? null;
  }

  function openCreate() {
    setEditingId(null);
    setEditingRow(null);
    reset(emptyQuestion);
    setOpen(true);
  }

  function openEdit(q: QuestionTableRow) {
    setEditingId(q.id);
    setEditingRow(q);
    reset({
      type: q.type,
      level: q.level,
      text_he: q.text_he,
      text_en: q.text_en,
      is_active: q.is_active,
    });
    setOpen(true);
  }

  async function onSubmit(values: QuestionFormValues) {
    const gid = resolveTargetGameId(editingRow);
    if (!gid) {
      toast.error("Missing game for this question.");
      return;
    }
    setBusy(true);
    const res = await upsertQuestion(gid, editingId, values);
    setBusy(false);
    if (!res.ok) {
      if (typeof res.error === "string") toast.error(res.error);
      else toast.error("Validation failed");
      return;
    }
    toast.success(editingId ? "Question updated" : "Question added");
    setOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const gid = resolveTargetGameId(deleting);
    if (!gid) return;
    setBusy(true);
    const res = await deleteQuestion(deleting.id, gid);
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Question deleted");
    router.refresh();
  }

  if (!gameId && mode === "embedded") {
    return (
      <p className="text-muted-foreground text-sm">
        Questions are saved per game. Create the game, then return here to add
        questions.
      </p>
    );
  }

  const colCount = mode === "global" ? 7 : 6;

  return (
    <div className="space-y-4">
      {mode === "embedded" && gameId ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Add question
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {mode === "global" ? <TableHead>Game</TableHead> : null}
              <TableHead>Type</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Hebrew</TableHead>
              <TableHead>English</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialQuestions.length ? (
              initialQuestions.map((q) => (
                <TableRow key={q.id}>
                  {mode === "global" ? (
                    <TableCell className="max-w-[160px] truncate text-sm">
                      {q.game_name ?? "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Badge variant="secondary">{q.type}</Badge>
                  </TableCell>
                  <TableCell>{q.level}</TableCell>
                  <TableCell
                    className="max-w-[180px] truncate text-sm"
                    dir="rtl"
                  >
                    {q.text_he}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">
                    {q.text_en}
                  </TableCell>
                  <TableCell>
                    <Badge variant={q.is_active ? "default" : "outline"}>
                      {q.is_active ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(q)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(q)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-muted-foreground h-24 text-center"
                >
                  No questions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit question" : "New question"}
            </DialogTitle>
          </DialogHeader>
          <FormProvider {...methods}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="truth">Truth</SelectItem>
                          <SelectItem value="dare">Dare</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Controller
                    control={control}
                    name="level"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="flirty">Flirty</SelectItem>
                          <SelectItem value="deep">Deep</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <LocalizedFieldRow control={control} fieldBase="text" multiline />
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <span className="text-muted-foreground text-sm">Active</span>
                  </div>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editingId ? (
                    "Save"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
