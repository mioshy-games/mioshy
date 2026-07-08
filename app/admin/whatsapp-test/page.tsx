import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { WhatsAppTestForm } from "@/components/admin/whatsapp/WhatsAppTestForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mioshy — WhatsApp Test Send",
  robots: { index: false, follow: false },
};

/**
 * /admin/whatsapp-test — internal browser form for the WhatsApp test-send
 * endpoint. Same auth contract as /admin/content: getAdminSession() +
 * notFound() on miss, so the route is invisible to non-admins. The real
 * security lives in POST /api/whatsapp/test-send (also admin-gated).
 */
export default async function AdminWhatsAppTestPage() {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }
  return <WhatsAppTestForm />;
}
