import { AuthBackground } from "@/components/auth/AuthBackground";
import { LoginForm } from "@/components/auth/LoginForm";

export default function AuthPage({
  searchParams,
}: {
  searchParams: { kicked?: string };
}) {
  return (
    <AuthBackground>
      <LoginForm kicked={searchParams.kicked === "1"} />
    </AuthBackground>
  );
}
