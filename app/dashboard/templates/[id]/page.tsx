/**
 * /dashboard/templates/[id]
 *
 * Template editor. Server fetches the record, hands off to client editor
 * that PATCHes /api/admin/templates/[id] on save and has a live preview
 * that renders {{variables}} against a demo vars map.
 */

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { TemplateEditor } from "@/components/dashboard/TemplateEditor";

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const { data: tpl } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!tpl) notFound();

  return (
    <div className="p-6">
      <TemplateEditor template={tpl} />
    </div>
  );
}
