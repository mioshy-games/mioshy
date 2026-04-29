"use client";

/**
 * UserDetailClient — interactive half of /dashboard/users/[id].
 *
 * Three columns of admin tooling for a single user:
 *   - Notes: pinned + recent, add/delete.
 *   - Manual send: pick template, override subject/body, send via provider.
 *   - Tasks: assign he/en task with due date; mark done/skipped.
 *
 * All mutations hit /api/admin/* routes that enforce is_admin() server-side.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pin, PinOff, Trash2, Send, ListChecks, Zap } from "lucide-react";

export type AdminNote = {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author_id: string | null;
};

export type AdminTask = {
  id: string;
  title_he: string;
  title_en: string;
  body_he: string;
  body_en: string;
  status: "open" | "done" | "skipped";
  assigned_at: string;
  due_at: string | null;
  done_at: string | null;
  notes: string | null;
};

export type AdminMessage = {
  id: string;
  channel: string;
  subject: string | null;
  to_address: string | null;
  sent_by: string | null;
  status: string;
  created_at: string;
};

export type AdminTemplate = {
  id: string;
  key: string;
  channel: string;
  subject_en: string | null;
  body_en: string;
};

type Props = {
  userId: string;
  email: string;
  initialNotes: AdminNote[];
  initialTasks: AdminTask[];
  initialMessages: AdminMessage[];
  templates: AdminTemplate[];
};

export function UserDetailClient({
  userId,
  email,
  initialNotes,
  initialTasks,
  initialMessages,
  templates,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const [messages, setMessages] = useState(initialMessages);
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <NotesCard userId={userId} notes={notes} setNotes={setNotes} />
      <TasksCard userId={userId} tasks={tasks} setTasks={setTasks} />
      <SendCard
        userId={userId}
        email={email}
        templates={templates}
        onSent={(m) => setMessages((prev) => [m, ...prev])}
      />
      <MessagesCard messages={messages} />
      <AutomationCard
        userId={userId}
        onScheduled={() => {
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}

/* --------------------------------- Notes --------------------------------- */

function NotesCard({
  userId,
  notes,
  setNotes,
}: {
  userId: string;
  notes: AdminNote[];
  setNotes: (updater: (prev: AdminNote[]) => AdminNote[]) => void;
}) {
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onAdd() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, body, is_pinned: pinned }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "failed" }));
        toast.error(error ?? "Failed to add note");
        return;
      }
      const { note } = await res.json();
      setNotes((prev) => [note, ...prev]);
      setBody("");
      setPinned(false);
      toast.success("Note saved");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/admin/notes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function togglePin(n: AdminNote) {
    const res = await fetch("/api/admin/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: n.id, is_pinned: !n.is_pinned }),
    });
    if (!res.ok) {
      toast.error("Failed");
      return;
    }
    setNotes((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_pinned: !n.is_pinned } : x)),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>Private to admins. Pinned notes stay on top.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Short context, call notes, follow-up reminders…"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={pinned} onCheckedChange={setPinned} />
              Pin this note
            </label>
            <Button onClick={onAdd} disabled={submitting || !body.trim()}>
              Add note
            </Button>
          </div>
        </div>
        <Separator />
        <ul className="flex flex-col gap-2">
          {notes.length === 0 ? (
            <li className="text-sm text-muted-foreground">No notes yet.</li>
          ) : null}
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-2 rounded border px-3 py-2 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {n.is_pinned ? <Badge variant="secondary">pinned</Badge> : null}
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => togglePin(n)} aria-label="toggle-pin">
                  {n.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(n.id)} aria-label="delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Tasks --------------------------------- */

function TasksCard({
  userId,
  tasks,
  setTasks,
}: {
  userId: string;
  tasks: AdminTask[];
  setTasks: (updater: (prev: AdminTask[]) => AdminTask[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title_he: "",
    title_en: "",
    body_he: "",
    body_en: "",
    due_at: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function onAssign() {
    if (!form.title_he || !form.title_en || !form.body_he || !form.body_en) {
      toast.error("Fill both languages");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ...form,
          due_at: form.due_at || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "failed" }));
        toast.error(error ?? "Failed");
        return;
      }
      const { task } = await res.json();
      setTasks((prev) => [task, ...prev]);
      setForm({ title_he: "", title_en: "", body_he: "", body_en: "", due_at: "" });
      setOpen(false);
      toast.success("Task assigned");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchTask(id: string, patch: Partial<Pick<AdminTask, "status" | "notes">>) {
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      toast.error("Failed");
      return;
    }
    const { task } = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...task } : t)));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Tasks
          </CardTitle>
          <CardDescription>Assignments surfaced inside the user&apos;s program.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Assign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign task</DialogTitle>
              <DialogDescription>Both Hebrew and English required.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>כותרת (he)</Label>
                <Input
                  value={form.title_he}
                  onChange={(e) => setForm({ ...form, title_he: e.target.value })}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title (en)</Label>
                <Input
                  value={form.title_en}
                  onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>תיאור (he)</Label>
                <Textarea
                  rows={3}
                  value={form.body_he}
                  onChange={(e) => setForm({ ...form, body_he: e.target.value })}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description (en)</Label>
                <Textarea
                  rows={3}
                  value={form.body_en}
                  onChange={(e) => setForm({ ...form, body_en: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Due (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onAssign} disabled={submitting}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <li className="text-sm text-muted-foreground">No tasks assigned.</li>
          ) : null}
          {tasks.map((t) => (
            <li key={t.id} className="rounded border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      t.status === "done" ? "default" : t.status === "skipped" ? "outline" : "secondary"
                    }
                  >
                    {t.status}
                  </Badge>
                  <span className="font-medium">{t.title_en}</span>
                </div>
                <div className="flex gap-1">
                  {t.status !== "done" ? (
                    <Button size="sm" variant="ghost" onClick={() => patchTask(t.id, { status: "done" })}>
                      Done
                    </Button>
                  ) : null}
                  {t.status !== "skipped" ? (
                    <Button size="sm" variant="ghost" onClick={() => patchTask(t.id, { status: "skipped" })}>
                      Skip
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">{t.body_en}</p>
              {t.due_at ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Due: {new Date(t.due_at).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Send --------------------------------- */

function SendCard({
  userId,
  email,
  templates,
  onSent,
}: {
  userId: string;
  email: string;
  templates: AdminTemplate[];
  onSent: (msg: AdminMessage) => void;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toAddress, setToAddress] = useState(email);
  const [submitting, setSubmitting] = useState(false);

  function onPickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setChannel(t.channel as "email" | "sms" | "whatsapp");
    setSubject(t.subject_en ?? "");
    setBody(t.body_en ?? "");
  }

  async function onSend() {
    if (!body) {
      toast.error("Body required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          template_id: templateId || null,
          channel,
          subject: subject || null,
          body,
          to_address: toAddress,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "failed" }));
        toast.error(error ?? "Send failed");
        return;
      }
      const { message } = await res.json();
      onSent(message);
      toast.success("Sent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4" /> Send message
        </CardTitle>
        <CardDescription>Renders variables like {`{{name}}`} from latest analysis.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={onPickTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="— none —" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "sms" | "whatsapp")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
        </div>
        {channel === "email" ? (
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSend} disabled={submitting}>
            Send now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Messages ------------------------------- */

function MessagesCard({ messages }: { messages: AdminMessage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent messages</CardTitle>
        <CardDescription>Last 20 across all channels.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {messages.length === 0 ? (
            <li className="text-muted-foreground">Nothing sent yet.</li>
          ) : null}
          {messages.map((m) => (
            <li key={m.id} className="rounded border px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.channel}</Badge>
                  <Badge variant={m.status === "sent" ? "default" : "destructive"}>{m.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">by {m.sent_by ?? "—"}</span>
              </div>
              <div className="mt-1">
                <div className="text-xs text-muted-foreground">to {m.to_address ?? "—"}</div>
                {m.subject ? <div className="font-medium">{m.subject}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Automation ------------------------------ */

function AutomationCard({
  userId,
  onScheduled,
}: {
  userId: string;
  onScheduled: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function run(force: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, force }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Failed");
        return;
      }
      toast.success(`Scheduled ${payload.scheduled} sends`);
      onScheduled();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4" /> Automation
        </CardTitle>
        <CardDescription>Build the 26-week engagement schedule from the latest analysis.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button onClick={() => run(false)} disabled={submitting}>
          Schedule program
        </Button>
        <Button variant="outline" onClick={() => run(true)} disabled={submitting}>
          Force rebuild
        </Button>
      </CardContent>
    </Card>
  );
}
