/**
 * /dashboard/console
 *
 * WhatsApp-style two-pane coaching console (MVP). Left = a persistent
 * conversation feed wrapping the SAME aggregation as /dashboard/journey/replies
 * (general channel + per-item threads, incl. solo users). Right = the active
 * conversation (?couple=<id> | ?user=<id>) reusing the existing reply surfaces
 * (GeneralChannelAdminReply + ClientResponsesInbox) plus couple-scoped
 * content-add. The legacy /replies and /my-clients pages are untouched.
 *
 * Phase 2 (explicitly deferred): full chronological merge of the couple
 * channel, persistent unread (last_read_at + migration), and Supabase realtime.
 * MVP uses server re-render on selection + ConsolePoller (router.refresh).
 */

import { requireAdmin } from "@/lib/auth/admin";
import { buildConsoleFeed } from "@/lib/journey/console-feed";
import {
  loadConsoleActiveCouple,
  loadConsoleActiveSolo,
  type ConsoleActive,
} from "@/lib/journey/console-active";
import { ConsoleLayout } from "@/components/dashboard/console/ConsoleLayout";
import { ConsoleFeed } from "@/components/dashboard/console/ConsoleFeed";
import { ConsoleActivePane } from "@/components/dashboard/console/ConsoleActivePane";
import { ConsoleEmptyState } from "@/components/dashboard/console/ConsoleEmptyState";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: {
    couple?: string;
    user?: string;
  };
}

export default async function ConsolePage({ searchParams }: PageProps) {
  const { user } = await requireAdmin();
  const expertId = user.id;
  const isAdmin = true; // requireAdmin guarantees the admin role.

  const feed = await buildConsoleFeed({ expertId, isAdmin });

  const selectedCouple = searchParams?.couple ?? null;
  const selectedUser = searchParams?.user ?? null;

  let active: ConsoleActive | null = null;
  if (selectedCouple) {
    active = await loadConsoleActiveCouple({
      coupleId: selectedCouple,
      expertId,
      isAdmin,
    });
  } else if (selectedUser) {
    const item = feed.find(
      (f) => f.kind === "solo" && f.userId === selectedUser,
    );
    active = await loadConsoleActiveSolo({
      userId: selectedUser,
      label: item?.label ?? `user ${selectedUser.slice(0, 8)}`,
    });
  }

  const hasSelection = !!(selectedCouple || selectedUser);

  return (
    <ConsoleLayout
      hasSelection={hasSelection}
      feed={
        <ConsoleFeed
          items={feed}
          selectedCouple={selectedCouple}
          selectedUser={selectedUser}
        />
      }
      active={
        active ? (
          <ConsoleActivePane active={active} />
        ) : (
          <ConsoleEmptyState noConversations={feed.length === 0} />
        )
      }
    />
  );
}
