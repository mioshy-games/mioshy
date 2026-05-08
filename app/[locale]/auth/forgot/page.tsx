import { AuthBackground } from "@/components/auth/AuthBackground";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

/**
 * /auth/forgot — password-reset request page.
 * Per Itzik 2026-05-07. The user enters their email; we send a
 * Supabase reset-password link to it via auth.resetPasswordForEmail.
 *
 * The redirectTo URL points back to /auth (login) — the Supabase email
 * contains a one-time token that authenticates the user, then the
 * frontend can show a "set new password" form. For an MVP we let
 * Supabase's built-in flow handle the rest: clicking the email link
 * signs the user in, and they can change their password from /account.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthBackground>
      <ForgotPasswordForm />
    </AuthBackground>
  );
}
