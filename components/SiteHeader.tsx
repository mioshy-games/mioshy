"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Mioshy
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <Link
            href="/products"
            className="text-sm font-medium text-white/90 hover:text-white"
          >
            {t("products")}
          </Link>
          <Link
            href="/dashboard"
            className="hidden text-sm font-medium text-white/90 hover:text-white sm:inline"
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/auth"
            className="text-sm font-medium text-white/90 hover:text-white"
          >
            {t("auth")}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
