"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/navigation";
import { Check, KeyRound, Loader2, UserPlus } from "lucide-react";
import { claimInviteAsNewUser, claimInviteAsExistingUser } from "@/app/actions/invite-claim";

type Mode = "signup" | "signin";

export function InviteClaimClient({
  isHe,
  token,
  invitedEmail,
  currentUserEmail,
  currentUserAlreadyInCouple,
  locale,
}: {
  isHe: boolean;
  token: string;
  invitedEmail: string;
  currentUserEmail: string | null;
  currentUserAlreadyInCouple: boolean;
  locale: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If user is already in a couple, show a friendly message.
  if (currentUserEmail && currentUserAlreadyInCouple) {
    return (
      <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
        <p className="font-semibold">
          {isHe
            ? "החשבון שלך כבר משויך לחלל זוגי אחר."
            : "Your account is already part of another couple space."}
        </p>
        <p className="mt-2 text-amber-100/85">
          {isHe
            ? "כדי להצטרף לחלל הזוגי החדש, התנתק/י והיכנס/י עם חשבון אחר, או בקש/י מהשולח/ת לשלוח הזמנה לכתובת אחרת."
            : "To join this invitation, sign out and use a different account, or ask the sender to invite a different email."}
        </p>
        <a
          href={`/${locale}/my`}
          className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-700 shadow hover:bg-amber-50"
        >
          {isHe ? "למיאושי שלי" : "Go to My Mioshy"}
        </a>
      </div>
    );
  }

  // If the current session's email matches the invited email, we show a single
  // "Join now" button - account already exists.
  const sameAccount =
    currentUserEmail?.toLowerCase() === invitedEmail.toLowerCase();

  const handleAccept = () => {
    setError(null);
    start(async () => {
      const res = await claimInviteAsExistingUser({ token });
      if (!res.ok) {
        setError(translateError(res.error, isHe));
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(`/${locale}/my`), 650);
    });
  };

  if (sameAccount) {
    return (
      <div>
        <p className="text-sm text-white/80">
          {isHe
            ? "זיהינו אותך כבר מחובר/ת לחשבון הנכון - לחיצה אחת ונכנסים לחלל הזוגי."
            : "You're already signed in with the right account - one click and you're in."}
        </p>
        <button
          type="button"
          disabled={pending || success}
          onClick={handleAccept}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isHe ? "מצטרפים…" : "Joining…"}
            </>
          ) : success ? (
            <>
              <Check className="h-4 w-4" />
              {isHe ? "מצטרפים לחלל…" : "Joining couple space…"}
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              {isHe ? "הצטרפות לחלל הזוגי" : "Join the couple space"}
            </>
          )}
        </button>
        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // Otherwise - show signup/signin tabs.
  return (
    <SignupOrSigninForm
      isHe={isHe}
      token={token}
      invitedEmail={invitedEmail}
      locale={locale}
    />
  );
}

function SignupOrSigninForm({
  isHe,
  token,
  invitedEmail,
  locale,
}: {
  isHe: boolean;
  token: string;
  invitedEmail: string;
  locale: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      if (mode === "signup") {
        if (fullName.trim().length < 2) {
          setError(isHe ? "נא למלא שם מלא" : "Full name is required");
          return;
        }
        if (mobile.trim().length < 7) {
          setError(isHe ? "נא למלא מספר נייד" : "Mobile is required");
          return;
        }
        if (password.length < 6) {
          setError(
            isHe ? "סיסמה של 6 תווים לפחות" : "Password must be 6+ characters",
          );
          return;
        }
        const res = await claimInviteAsNewUser({
          token,
          email: invitedEmail,
          fullName,
          mobile,
          password,
        });
        if (!res.ok) {
          setError(translateError(res.error, isHe));
          return;
        }
      } else {
        if (password.length < 6) {
          setError(isHe ? "נא להזין סיסמה" : "Please enter your password");
          return;
        }
        const res = await claimInviteAsExistingUser({
          token,
          email: invitedEmail,
          password,
        });
        if (!res.ok) {
          setError(translateError(res.error, isHe));
          return;
        }
      }
      setSuccess(true);
      setTimeout(() => router.push(`/${locale}/my`), 700);
    });
  }

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full bg-white/10 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-full px-3 py-1.5 font-semibold transition ${
            mode === "signup"
              ? "bg-white text-fuchsia-700 shadow"
              : "text-white/75 hover:text-white"
          }`}
        >
          {isHe ? "חשבון חדש" : "New account"}
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-full px-3 py-1.5 font-semibold transition ${
            mode === "signin"
              ? "bg-white text-fuchsia-700 shadow"
              : "text-white/75 hover:text-white"
          }`}
        >
          {isHe ? "כבר יש לי חשבון" : "I have an account"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-white/70">
            {isHe ? "אימייל" : "Email"}
          </label>
          <input
            type="email"
            value={invitedEmail}
            readOnly
            dir="ltr"
            className="mt-1 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/75"
          />
        </div>

        {mode === "signup" ? (
          <>
            <div>
              <label className="text-xs font-medium text-white/70">
                {isHe ? "שם מלא" : "Full name"}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={pending}
                autoComplete="name"
                className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none"
                placeholder={isHe ? "השם שלך" : "Your full name"}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/70">
                {isHe ? "טלפון נייד" : "Mobile"}
              </label>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={pending}
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none"
                placeholder="+972 50 000 0000"
              />
            </div>
          </>
        ) : null}

        <div>
          <label className="text-xs font-medium text-white/70">
            {isHe ? "סיסמה" : "Password"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            dir="ltr"
            className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none"
            placeholder={isHe ? "לפחות 6 תווים" : "At least 6 characters"}
          />
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
            <Check className="h-3.5 w-3.5" />
            {isHe ? "מעולה! מעבירים אותך למיאושי שלי…" : "You're in - opening My Mioshy…"}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isHe ? "רגע…" : "One moment…"}
            </span>
          ) : mode === "signup" ? (
            <span className="inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {isHe ? "יצירת חשבון והצטרפות" : "Create account & join"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {isHe ? "כניסה והצטרפות" : "Sign in & join"}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

function translateError(code: string, isHe: boolean): string {
  const map: Record<string, { he: string; en: string }> = {
    invitation_not_found: {
      he: "ההזמנה לא נמצאה",
      en: "Invitation not found",
    },
    invitation_expired: {
      he: "ההזמנה פגה",
      en: "Invitation expired",
    },
    invitation_not_pending: {
      he: "ההזמנה כבר נוצלה או בוטלה",
      en: "Invitation already used or revoked",
    },
    already_in_couple: {
      he: "את/ה כבר משויך/ת לחלל זוגי אחר",
      en: "You're already in another couple",
    },
    email_already_registered: {
      he: "כתובת המייל הזו כבר רשומה - יש להיכנס עם סיסמה קיימת",
      en: "This email is already registered - sign in with your password",
    },
    invalid_credentials: {
      he: "פרטי ההתחברות שגויים",
      en: "Incorrect email or password",
    },
    login_required: {
      he: "יש להיכנס קודם לחשבון",
      en: "Please sign in first",
    },
    invitation_email_mismatch: {
      he: "ההזמנה הזו נשלחה לכתובת אחרת",
      en: "This invitation was sent to a different email",
    },
    signin_after_signup_failed: {
      he: "החשבון נוצר, אך הכניסה נכשלה - נא להיכנס ידנית",
      en: "Account created but sign-in failed - please sign in manually",
    },
    signup_failed: {
      he: "נכשלה יצירת החשבון. נסה/י שוב.",
      en: "Account creation failed. Please try again.",
    },
    invalid_email: {
      he: "כתובת מייל לא תקינה",
      en: "Invalid email address",
    },
    invalid_full_name: {
      he: "יש להזין שם מלא",
      en: "Please enter your full name",
    },
    invalid_mobile: {
      he: "מספר נייד לא תקין",
      en: "Invalid mobile number",
    },
    weak_password: {
      he: "סיסמה חייבת להכיל לפחות 6 תווים",
      en: "Password must be at least 6 characters",
    },
  };
  const entry = map[code];
  if (!entry) return code;
  return isHe ? entry.he : entry.en;
}
