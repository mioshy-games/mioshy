"use client";

/**
 * TestUsersClient — interactive shell for /dashboard/test-users.
 *
 * Two modes:
 *   • "add"  — email input + note field + "Add" button.
 *   • "list" — table of current whitelist with a "Revoke" button per row.
 *
 * Both modes call the same server actions in `app/actions/test-users.ts`
 * and rely on `revalidatePath` to refresh the parent server component
 * after every change.
 *
 * Toasts surface success / error. The toaster is mounted at the
 * dashboard layout level so messages always render.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  setTestUserByEmail,
  setTestUserById,
} from "@/app/actions/test-users";
import type {
  TestUserRow,
  PendingInvitationRow,
} from "@/app/dashboard/test-users/page";

interface Props {
  mode: "add" | "list" | "pending";
  initialList: TestUserRow[];
  pending?: PendingInvitationRow[];
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TestUsersClient({ mode, initialList, pending: pendingList }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  if (mode === "add") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = email.trim();
          if (!trimmed) {
            toast.error("Type an email first");
            return;
          }
          startTransition(async () => {
            const res = await setTestUserByEmail({
              email: trimmed,
              enabled: true,
              note: note.trim() || undefined,
            });
            if (!res.ok) {
              toast.error(`Could not add: ${res.error}`);
              return;
            }
            const successCopy =
              res.mode === "registered"
                ? `Added ${res.displayName ?? trimmed}. Invitation email sent.`
                : `${trimmed} hasn't signed up yet — invitation email sent. They'll be auto-granted on signup.`;
            toast.success(successCopy);
            setEmail("");
            setNote("");
            router.refresh();
          });
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="tu_email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </label>
          <input
            id="tu_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="qa@example.com"
            disabled={pending}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="tu_note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Note (optional)
          </label>
          <input
            id="tu_note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="QA — Itzik 2026-06-01"
            disabled={pending}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-rose-500 px-5 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Add
        </button>
      </form>
    );
  }

  // mode === "pending" — render the pending-invitations table.
  if (mode === "pending") {
    const rows = pendingList ?? [];
    if (rows.length === 0) return null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pe-3 font-semibold">Email</th>
              <th className="py-2 pe-3 font-semibold">Note</th>
              <th className="py-2 pe-3 font-semibold">Invited at</th>
              <th className="py-2 pe-3 font-semibold">By</th>
              <th className="py-2 pe-0 text-end font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-border/40">
                <td className="py-2 pe-3 font-mono text-[13px]" dir="ltr">
                  {row.email}
                </td>
                <td className="py-2 pe-3 text-muted-foreground">
                  {row.note ?? "—"}
                </td>
                <td className="py-2 pe-3 text-muted-foreground">
                  {shortDate(row.invitedAt)}
                </td>
                <td className="py-2 pe-3 text-muted-foreground">
                  {row.invitedByName ?? "—"}
                </td>
                <td className="py-2 pe-0 text-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !confirm(
                          `Cancel pending invitation for ${row.email}?\n\nWhen they sign up later they will NOT be auto-granted.`,
                        )
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        const res = await setTestUserByEmail({
                          email: row.email,
                          enabled: false,
                        });
                        if (!res.ok) {
                          toast.error(`Could not cancel: ${res.error}`);
                          return;
                        }
                        toast.success("Invitation cancelled");
                        router.refresh();
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // mode === "list"
  if (initialList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No users on the whitelist yet. Add one above to start.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pe-3 font-semibold">Email</th>
            <th className="py-2 pe-3 font-semibold">Name</th>
            <th className="py-2 pe-3 font-semibold">Note</th>
            <th className="py-2 pe-3 font-semibold">Marked at</th>
            <th className="py-2 pe-3 font-semibold">By</th>
            <th className="py-2 pe-0 text-end font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {initialList.map((row) => (
            <tr key={row.id} className="border-b border-border/40">
              <td className="py-2 pe-3 font-mono text-[13px]" dir="ltr">
                {row.email ?? row.id.slice(0, 8)}
              </td>
              <td className="py-2 pe-3">{row.fullName ?? "—"}</td>
              <td className="py-2 pe-3 text-muted-foreground">
                {row.note ?? "—"}
              </td>
              <td className="py-2 pe-3 text-muted-foreground">
                {shortDate(row.markedAt)}
              </td>
              <td className="py-2 pe-3 text-muted-foreground">
                {row.markedByName ?? "—"}
              </td>
              <td className="py-2 pe-0 text-end">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `Revoke test-user grant for ${row.email ?? row.fullName ?? row.id}?\n\nFrom now on this user will be charged on the next checkout.`,
                      )
                    ) {
                      return;
                    }
                    startTransition(async () => {
                      const res = await setTestUserById({
                        userId: row.id,
                        enabled: false,
                      });
                      if (!res.ok) {
                        toast.error(`Could not revoke: ${res.error}`);
                        return;
                      }
                      toast.success("Removed from whitelist");
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
