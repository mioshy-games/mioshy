import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { requireExpert } from "@/lib/auth/expert";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/ui/sonner";

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

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className="bg-background text-foreground flex min-h-[100dvh]">
        <Sidebar isAdmin={session.isAdmin} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
