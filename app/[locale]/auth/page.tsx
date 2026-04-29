import { AuthBackground } from "@/components/auth/AuthBackground";
import { LoginForm } from "@/components/auth/LoginForm";

// Reads `next` from the URL so that callers can route the user back to
// where they came from after sign-in. Most common case: the
// /adults/[slug] purchase flow sends logged-out clickers here with
// ?next=/adults/[slug]?continuePurchase=1 — without this read-through,
// the user signs in and lands on the default post-auth route, never
// returning to complete the purchase.
export default function AuthPage({
  searchParams,
}: {
  searchParams: { kicked?: string; next?: string };
}) {
  return (
    <AuthBackground>
      <LoginForm
        kicked={searchParams.kicked === "1"}
        next={searchParams.next}
      />
    </AuthBackground>
  );
}
