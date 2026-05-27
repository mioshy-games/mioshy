import { AuthBackground } from "@/components/auth/AuthBackground";
import { SignupForm } from "@/components/auth/SignupForm";

// Same `next` pass-through as the login page - so a logged-out visitor
// who clicks "Buy" on a game page and chooses "create account" instead
// of "sign in" still returns to the purchase flow after creating one.
//
// `code` is the partner pair-code prefill — when a user clicks a share
// link sent by their already-subscribed partner the URL looks like:
//
//   /he/auth/signup?code=ABC123
//
// The SignupForm shows a small banner ("you're joining your partner's
// account") and, on successful signup, auto-redeems the code via
// joinCoupleByPairCode before routing to /my. The full-profile gate
// passes because the signup form collects name, email, phone and
// password — every field requireCompleteProfile() needs.
export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string; code?: string };
}) {
  return (
    <AuthBackground>
      <SignupForm next={searchParams.next} pairCode={searchParams.code} />
    </AuthBackground>
  );
}
