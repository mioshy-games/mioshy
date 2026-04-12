import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function AuthPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-12">
        <AuthForm />
      </main>
    </div>
  );
}
