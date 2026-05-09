"use client";

/**
 * ViewAsButton
 * ─────────────────────────────────────────────────────────
 * Coach-side button that launches read-only impersonation of a
 * user. Sets the view-as cookie via server action, then navigates
 * to /[locale]/my/journey so the coach sees what the user sees.
 *
 * Important: the coach's own session is not touched. Pages that
 * support view-as substitute the impersonated user_id only on
 * read paths; writes still go through auth.uid() (the coach).
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startViewAs } from "@/app/actions/coach-view-as";

interface Props {
  userId:    string;
  coupleId:  string;
  /** Optional locale to redirect to after activating. Defaults to 'he'. */
  locale?:   string;
  /** Display label — usually the partner's name. */
  label:     string;
}

export function ViewAsButton({ userId, coupleId, locale = "he", label }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await startViewAs({ userId, coupleId });
      if (!res.ok) {
        toast.error(`View-as failed: ${res.error}`);
        return;
      }
      // Navigate to the impersonated user's space.
      router.push(`/${locale}/my/journey`);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="gap-1.5"
      title="View as this user (read-only)"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Eye className="size-3.5" />
      )}
      View as {label}
    </Button>
  );
}
