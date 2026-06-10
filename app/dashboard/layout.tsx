import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { requireExpert } from "@/lib/auth/expert";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { getPendingExpertMessages } from "@/lib/journey/pending-messages";

export default async function DashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Layout allows either an 'admin' or 'expert' role through. Admin-only
  // pages self-gate with requireAdmin() so experts can't reach content
  // management screens. The sidebar uses isAdmin to hide admin sections
  // from experts.
  const session = await requireExpert();

  // Phase 11A — admin locale (he/en) cookie-driven. Applies dir + lang
  // to the dashboard root. User-facing site keeps its own next-intl
  // locale untouched.
  const locale = getAdminLocale();
  const dir    = isRtl(locale) ? "rtl" : "ltr";

  // 2026-06-01 — sidebar badges. The pending-messages count drives the
  // "My Clients" red pill so an on-duty coach sees pending volume from
  // any admin page. Failure-tolerant: pending.count falls back to 0.
  const pending = await getPendingExpertMessages({ limit: 1 });

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div
        dir={dir}
        lang={locale}
        className="bg-background text-foreground flex min-h-[100dvh] flex-col md:flex-row"
      >
        <Sidebar
          isAdmin={session.isAdmin}
          locale={locale}
          badges={{ pending_messages: pending.count }}
        />
        <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
          {/* pb on mobile clears the fixed BottomNav (md:hidden). Desktop
              keeps its original padding — no visual change above md. */}
          <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        </div>
      </div>
      <BottomNav
        locale={locale}
        badges={{ pending_messages: pending.count }}
      />
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
