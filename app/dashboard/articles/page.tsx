import { requireAdmin } from "@/lib/auth/admin";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { ArticleActions } from "@/components/dashboard/ArticleActions";
import Image from "next/image";

export default async function ArticlesAdminPage() {
  const { supabase } = await requireAdmin();

  const { data: articles } = await supabase
    .from("articles")
    .select(
      "id, slug, title_en, title_he, cover_image_url, is_published, published_at, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and publish public content.
          </p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          New Article
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All articles</CardTitle>
          <CardDescription>Drafts and published posts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cover</TableHead>
                <TableHead>Title (EN)</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles?.length ? (
                articles.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.cover_image_url ? (
                        <Image
                          src={a.cover_image_url}
                          alt=""
                          width={64}
                          height={40}
                          className="h-10 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex h-10 w-16 items-center justify-center rounded-md text-[10px]">
                          none
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.title_en || a.title_he || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {a.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.is_published ? "default" : "secondary"}>
                        {a.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ArticleActions
                        articleId={a.id}
                        isPublished={a.is_published}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No articles yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

