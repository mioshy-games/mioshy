import { AuthBackground } from "@/components/auth/AuthBackground";
import { LoginForm } from "@/components/auth/LoginForm";

// Reads `next` from the URL so that callers can route the user back to
// where they came from after sign-in. Most common case: the
// /adults/[slug] purchase flow sends logged-out clickers here with
// ?next=/adults/[slug]?continuePurchase=1 - without this read-through,
// the user signs in and lands on the default post-auth route, never
// returning to complete the purchase.
//
// `code` is the partner pair-code prefill — same contract as the
// signup page (see app/[locale]/auth/signup/page.tsx). When set, the
// LoginForm shows a "joining your partner" banner and auto-redeems
// the code immediately after a successful login.
export default function AuthPage({
  searchParams,
}: {
  searchParams: { kicked?: string; next?: string; code?: string };
}) {
  return (
    <AuthBackground>
      <LoginForm
        kicked={searchParams.kicked === "1"}
        next={searchParams.next}
        pairCode={searchParams.code}
      />
    </AuthBackground>
  );
}
