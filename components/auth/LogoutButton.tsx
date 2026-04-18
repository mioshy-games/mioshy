"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth-actions";

export function LogoutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      window.location.assign("/");
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={className}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
