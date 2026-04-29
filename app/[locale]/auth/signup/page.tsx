import { AuthBackground } from "@/components/auth/AuthBackground";
import { SignupForm } from "@/components/auth/SignupForm";

// Same `next` pass-through as the login page — so a logged-out visitor
// who clicks "Buy" on a game page and chooses "create account" instead
// of "sign in" still returns to the purchase flow after creating one.
export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthBackground>
      <SignupForm next={searchParams.next} />
    </AuthBackground>
  );
}
