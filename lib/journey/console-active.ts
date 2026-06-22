import "server-only";

import {
  getExpertClientDetail,
  listAssignableSources,
  type SourceOption,
} from "@/lib/experts/queries";
import {
  getGeneralChannelThreadForAdmin,
  type JourneyMessage,
} from "@/lib/journey-content/messages";
import {
  listClinicianResponsesForUsers,
  type ClinicianResponseRow,
} from "@/lib/journey-content/clinician-responses";
import { adminListCategoriesWithItemCounts } from "@/lib/journey-content/queries";

/**
 * Right-pane "active conversation" loader for the coach chat console.
 *
 * Loads exactly the data the REUSED reply components need:
 *   • GeneralChannelAdminReply  ← partners[] (per-user general channel thread)
 *   • ClientResponsesInbox      ← rows[] (per-item responses) + partner labels
 *   • AdHocItemCreator / AssignContentForm ← sources + categories (couples only)
 *
 * Two entry points — couples and solo users — returning the same shape so the
 * pane renders identically. Content-adding is couple-scoped in this product
 * (journey_assignments.couple_id), so solo conversations expose channels only.
 */

interface ChannelPartner {
  userId: string;
  label: string;
  messages: JourneyMessage[];
}

interface CategoryOption {
  id: string;
  name_he: string | null;
  name_en: string | null;
}

export interface ConsoleActive {
  kind: "couple" | "solo";
  coupleId: string | null;
  userId: string | null;
  title: string;
  pairCode: string | null;
  /** General-channel threads, one per partner (one entry for solo). */
  partners: ChannelPartner[];
  /** Per-item client responses (the inbox the coach replies/triages in). */
  responseRows: ClinicianResponseRow[];
  partnerLabels: Map<string, string>;
  /** Couples only — null for solo (content can't be assigned without a couple). */
  sources: SourceOption[] | null;
  categories: CategoryOption[] | null;
  hasPartnerB: boolean;
  partnerALabel: string;
  partnerBLabel: string;
}

function memberLabel(
  email: string | null,
  index: number,
): string {
  if (email?.includes("@")) return email.split("@")[0];
  return index === 0 ? "פרטנר א" : "פרטנר ב";
}

export async function loadConsoleActiveCouple(args: {
  coupleId: string;
  expertId: string;
  isAdmin: boolean;
}): Promise<ConsoleActive | null> {
  const detail = await getExpertClientDetail({
    expertId: args.expertId,
    isAdmin: args.isAdmin,
    coupleId: args.coupleId,
  });
  if (!detail) return null;

  const partnerUserIds = detail.members.map((m) => m.userId);
  const partnerLabels = new Map<string, string>();
  detail.members.forEach((m, i) =>
    partnerLabels.set(m.userId, memberLabel(m.email, i)),
  );

  const [partners, responseRows, sources, categoriesRaw] = await Promise.all([
    Promise.all(
      partnerUserIds.map(async (uid) => ({
        userId: uid,
        label: partnerLabels.get(uid) ?? uid.slice(0, 6),
        messages: await getGeneralChannelThreadForAdmin(uid).catch(() => []),
      })),
    ),
    listClinicianResponsesForUsers({
      userIds: partnerUserIds,
      limit: 50,
      isHe: true,
    }).catch(() => []),
    listAssignableSources().catch(() => []),
    adminListCategoriesWithItemCounts().catch(() => []),
  ]);

  const categories: CategoryOption[] = categoriesRaw.map((c) => ({
    id: c.id,
    name_he: c.name_he ?? null,
    name_en: c.name_en ?? null,
  }));

  const title =
    detail.displayName?.trim() ||
    detail.members
      .map((m) => m.email?.split("@")[0])
      .filter(Boolean)
      .join(" & ") ||
    `Couple ${args.coupleId.slice(0, 8)}`;

  return {
    kind: "couple",
    coupleId: args.coupleId,
    userId: null,
    title,
    pairCode: detail.pairCode,
    partners,
    responseRows,
    partnerLabels,
    sources,
    categories,
    hasPartnerB: partnerUserIds.length > 1,
    partnerALabel: partnerLabels.get(partnerUserIds[0]) ?? "פרטנר א",
    partnerBLabel: partnerUserIds[1]
      ? partnerLabels.get(partnerUserIds[1]) ?? "פרטנר ב"
      : "פרטנר ב",
  };
}

export async function loadConsoleActiveSolo(args: {
  userId: string;
  /** Label resolved by the feed (avoids a second pending-messages scan). */
  label: string;
}): Promise<ConsoleActive> {
  const [thread, responseRows] = await Promise.all([
    getGeneralChannelThreadForAdmin(args.userId).catch(() => []),
    listClinicianResponsesForUsers({
      userIds: [args.userId],
      limit: 50,
      isHe: true,
    }).catch(() => []),
  ]);

  const partnerLabels = new Map<string, string>([[args.userId, args.label]]);

  return {
    kind: "solo",
    coupleId: null,
    userId: args.userId,
    title: args.label,
    pairCode: null,
    partners: [{ userId: args.userId, label: args.label, messages: thread }],
    responseRows,
    partnerLabels,
    sources: null,
    categories: null,
    hasPartnerB: false,
    partnerALabel: args.label,
    partnerBLabel: "",
  };
}
