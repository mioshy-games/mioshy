/**
 * /dashboard/templates
 *
 * Server-rendered list of message templates. Editor is a separate client
 * page at /dashboard/templates/[id]. Creation happens inline here via a
 * small client form.
 */

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TemplateCreateForm } from "@/components/dashboard/TemplateCreateForm";

export default async function TemplatesPage() {
  const { supabase } = await requireAdmin();
  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, key, channel, subject_he, subject_en, trigger_axis, is_active, updated_at")
    .order("key");

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Message templates</CardTitle>
          <CardDescription>
            Body text rendered at send time with {`{{variables}}`} like {`{{first_name}}`}, {`{{friendship_score}}`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All templates ({templates?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Subject (en)</TableHead>
                <TableHead>Trigger axis</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(templates ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/dashboard/templates/${t.id}`} className="underline underline-offset-4">
                      {t.key}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.channel}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">{t.subject_en ?? "-"}</TableCell>
                  <TableCell>{t.trigger_axis ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "outline"}>
                      {t.is_active ? "active" : "paused"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {!templates?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No templates yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
