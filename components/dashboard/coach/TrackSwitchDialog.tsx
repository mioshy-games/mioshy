"use client";

/**
 * TrackSwitchDialog
 * ─────────────────────────────────────────────────────────
 * Coach-side modal: switch a couple from their current program
 * to a different one without losing history.
 *
 * Sends to switchCoupleTrack(); on success refreshes the page so
 * the assignments list reflects the new primary + paused old.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { switchCoupleTrack } from "@/app/dashboard/actions/track-switch";

interface ProgramOption {
  id:      string;
  name_he: string;
}

interface Props {
  open:               boolean;
  onOpenChange:       (open: boolean) => void;
  coupleId:           string;
  fromAssignmentId:   string;
  fromProgramName:    string;
  programOptions:     ProgramOption[];
}

export function TrackSwitchDialog({
  open,
  onOpenChange,
  coupleId,
  fromAssignmentId,
  fromProgramName,
  programOptions,
}: Props) {
  const router = useRouter();
  const [toProgramId, setToProgramId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [noticeMessage, setNoticeMessage] = useState(
    "ראינו בשיחות האחרונות שצריך להתמקד דווקא בנושא אחר. מהשבוע אנחנו עוברים למסלול שמתאים יותר לרגע הזה. כל מה שעבדתם עליו עד עכשיו נשאר חלק מהסיפור שלכם.",
  );
  const [cancelFutureLocked, setCancelFutureLocked] = useState(true);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!toProgramId) {
      toast.error("Pick a destination program");
      return;
    }
    setBusy(true);
    const res = await switchCoupleTrack({
      coupleId,
      fromAssignmentId,
      toProgramId,
      reason:             reason || null,
      noticeMessage:      noticeMessage || null,
      cancelFutureLocked,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(`Switch failed: ${res.error}`);
      return;
    }
    toast.success(
      `Switched. ${res.itemsCancelled} future items cancelled, ${res.itemsPreserved} preserved.`,
    );
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Switch track</DialogTitle>
          <DialogDescription>
            Move this couple from{" "}
            <strong className="text-foreground">{fromProgramName}</strong> to a
            different program. The current track is paused (history kept),
            and a new primary track starts immediately with the first item
            unlocked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="to_program">Destination program</Label>
            <select
              id="to_program"
              value={toProgramId}
              onChange={(e) => setToProgramId(e.target.value)}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select —</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_he}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Internal reason{" "}
              <span className="text-muted-foreground text-xs">(audit only — not shown to user)</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              dir="rtl"
              rows={2}
              maxLength={500}
              placeholder="ראיתי שלוש פעמים בערוץ שהתקשורת היא הבעיה הראשונה, לא האינטימיות"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notice">
              Message to send to both partners{" "}
              <span className="text-muted-foreground text-xs">(optional, posted to general channel)</span>
            </Label>
            <Textarea
              id="notice"
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              dir="rtl"
              rows={4}
              maxLength={2000}
            />
            <p className="text-muted-foreground text-[11px]">
              Edit to fit your voice — defaults are a starting point only.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={cancelFutureLocked}
              onChange={(e) => setCancelFutureLocked(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              Cancel locked future items on the old track
              <span className="text-muted-foreground block text-xs">
                Recommended. Already-unlocked items stay accessible as
                history.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={busy || !toProgramId}>
            {busy ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" /> Switching…
              </>
            ) : (
              "Switch track"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
