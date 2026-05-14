import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * /admin/* — sub-route layout.
 *
 * The root layout at app/layout.tsx already sets <html>/<body>; this
 * layer just adds the Sonner toaster mount and a minimum-height
 * container. Admin pages self-gate via getAdminSession() at the page
 * level (notFound() on miss — see the note in app/admin/content/page.tsx
 * about why 404 vs the dashboard's redirect-to-/).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {children}
      <Toaster richColors position="top-center" />
    </div>
  );
}
