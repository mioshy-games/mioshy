"use client";

/**
 * TrackSwitchTrigger
 * ─────────────────────────────────────────────────────────
 * Tiny client wrapper: a "Switch track" button that opens the
 * TrackSwitchDialog. Designed to be mounted next to every active
 * program assignment on the coach's couple-detail page.
 */

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackSwitchDialog } from "./TrackSwitchDialog";

interface ProgramOption {
  id:      string;
  name_he: string;
}

interface Props {
  coupleId:         string;
  fromAssignmentId: string;
  fromProgramName:  string;
  programOptions:   ProgramOption[];
}

export function TrackSwitchTrigger(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <ArrowRightLeft className="size-3.5" />
        Switch track
      </Button>
      <TrackSwitchDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}
