"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Flame, Heart, Sparkles, Users } from "lucide-react";

export function SiteFooter() {
  const t = useTranslations("marketingHome");

  return (
    <footer className="bg-[var(--mio-surface-b)] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] p-8 backdrop-blur-md">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-heading text-2xl font-bold tracking-tight text-white">
                Mioshy
              </p>
              <p className="mt-2 text-white/70">{t("footer.tagline")}</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3">
                <p className="text-sm font-bold text-white/90">
                  {t("footer.linksTitle")}
                </p>
                <div className="space-y-2 text-sm">
                  {[
                    { href: "/products", key: "games" },
                    { href: "/articles", key: "articles" },
                    { href: "/account", key: "account" },
                    { href: "/pricing", key: "pricing" },
                  ].map((l) => (
                    <Link
                      key={l.key}
                      href={l.href}
                      className="block text-white/70 underline-offset-4 hover:text-[var(--mio-purple)] hover:underline"
                    >
                      {t(`footer.links.${l.key}` as never)}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-white/90">
                  {t("footer.socialTitle")}
                </p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/20 bg-purple-950/30">
                    <Flame className="h-4 w-4 text-[var(--mio-rose)]" />
                  </span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/20 bg-purple-950/30">
                    <Heart className="h-4 w-4 text-[var(--mio-purple)]" />
                  </span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/20 bg-purple-950/30">
                    <Users className="h-4 w-4 text-white/60" />
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-white/90">
                  {t("footer.noteTitle")}
                </p>
                <p className="text-sm leading-relaxed text-white/70">
                  {t("footer.note")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-purple-500/15 pt-6 text-sm text-white/50 sm:flex-row sm:items-center">
            <p>{t("footer.copyright")}</p>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--mio-purple)]" />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t("footer.brandLine")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

