import { useEffect, useRef, useState } from "react";
import { Verified } from "../components";
import { GoogleSignInButton } from "../auth";
import {
  apiConfigured,
  requestOtp,
  verifyOtp,
  requestSignupOtp,
  verifySignupOtp,
  OtpError,
  type AuthUser,
} from "../authClient";

type Mode = "login" | "signup";

export default function SignUp({
  onDone,
  onUser,
}: {
  onDone: () => void;
  onUser: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="screen no-nav" style={{ justifyContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div
          className="avatar avatar-lg"
          style={{
            margin: "0 auto 14px",
            background: "var(--purple)",
            color: "#fff",
            borderRadius: 22,
          }}
        >
          S
        </div>
        <h1>SwapMyShow</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Last-minute tickets. Save money.
        </p>
      </div>

      <div className="ticket" style={{ padding: 18 }}>
        {apiConfigured ? (
          <>
            <div className="tab-row" role="tablist" aria-label="Log in or sign up" style={{ marginBottom: 14 }}>
              {(["login", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  className={`chip ${mode === m ? "on" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                  onClick={() => setMode(m)}
                >
                  {m === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>
            {mode === "login" ? (
              <LoginForm onUser={onUser} />
            ) : (
              <SignupForm onUser={onUser} />
            )}
          </>
        ) : (
          <DemoContinue onDone={onDone} />
        )}

        <hr className="tear" />

        {/* real Google account picker → signs in with the chosen Gmail */}
        <div className="row" style={{ justifyContent: "center" }}>
          <GoogleSignInButton onUser={onUser} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <Verified label="Verified members only" />
      </div>
    </div>
  );
}

/* Fallback shown only when no backend URL is configured: keeps the demo
   walkable without a live API. */
function DemoContinue({ onDone }: { onDone: () => void }) {
  const [contact, setContact] = useState("");
  return (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="contact">Phone or email</label>
        <input
          id="contact"
          inputMode="email"
          placeholder="you@gmail.com"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={onDone}>
        Continue
      </button>
    </>
  );
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const phoneOk = (v: string) => /^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ""));

/** Reusable 6-digit code entry, shared by log-in and sign-up. */
function CodeStep({
  email,
  devCode,
  busy,
  error,
  onChangeEmail,
  onResend,
  onVerify,
}: {
  email: string;
  devCode?: string;
  busy: boolean;
  error: string;
  onChangeEmail: () => void;
  onResend: () => void;
  onVerify: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => codeRef.current?.focus(), []);

  return (
    <>
      <div className="field" style={{ marginBottom: 6 }}>
        <label htmlFor="code">Enter the 6-digit code</label>
        <input
          id="code"
          ref={codeRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          style={{ letterSpacing: 6, fontFamily: "var(--mono)" }}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && onVerify(code)}
        />
      </div>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        Sent to {email}.{" "}
        <button type="button" className="linklike" onClick={onChangeEmail}>
          Change
        </button>
      </p>

      {devCode && (
        <div className="google-hint" style={{ marginBottom: 12 }}>
          <strong>Dev mode</strong>
          <span>
            No mailer configured — your code is <code>{devCode}</code>.
          </span>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={() => onVerify(code)}
        disabled={busy || code.length < 6}
      >
        {busy ? "Verifying…" : "Verify & continue"}
      </button>
      <button
        type="button"
        className="linklike"
        style={{ margin: "10px auto 0", display: "block" }}
        onClick={onResend}
        disabled={busy}
      >
        Resend code
      </button>
      {error && <FormError message={error} />}
    </>
  );
}

/** Log in: email → code. The account must already exist. */
function LoginForm({ onUser }: { onUser: (u: AuthUser) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();

  const send = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestOtp(email.trim().toLowerCase());
      setDevCode(debugCode);
      setStep("code");
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await verifyOtp(email.trim().toLowerCase(), code);
      onUser(user);
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "code") {
    return (
      <CodeStep
        email={email}
        devCode={devCode}
        busy={busy}
        error={error}
        onChangeEmail={() => {
          setStep("email");
          setError("");
        }}
        onResend={send}
        onVerify={verify}
      />
    );
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
      </div>
      <button
        className="btn btn-primary"
        onClick={send}
        disabled={busy || !emailOk(email)}
      >
        {busy ? "Sending…" : "Send code"}
      </button>
      {error && <FormError message={error} />}
    </>
  );
}

/** Sign up: name + email + phone → code. Email and phone are one-time. */
function SignupForm({ onUser }: { onUser: (u: AuthUser) => void }) {
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();

  const formOk = name.trim().length >= 2 && emailOk(email) && phoneOk(phone);
  const profile = () => ({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.replace(/[\s()-]/g, ""),
  });

  const send = async () => {
    if (!formOk || busy) return;
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestSignupOtp(profile());
      setDevCode(debugCode);
      setStep("code");
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await verifySignupOtp(profile(), code);
      onUser(user);
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "code") {
    return (
      <CodeStep
        email={email}
        devCode={devCode}
        busy={busy}
        error={error}
        onChangeEmail={() => {
          setStep("form");
          setError("");
        }}
        onResend={send}
        onVerify={verify}
      />
    );
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          autoComplete="name"
          placeholder="Anita Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="su-email">Email</label>
        <input
          id="su-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="su-phone">Phone</label>
        <input
          id="su-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
      </div>
      <button
        className="btn btn-primary"
        onClick={send}
        disabled={busy || !formOk}
      >
        {busy ? "Sending…" : "Send code"}
      </button>
      <p className="small muted" style={{ margin: "10px 0 0", textAlign: "center" }}>
        We'll email your code. Your phone is stored for the swap, not verified.
      </p>
      {error && <FormError message={error} />}
    </>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p
      className="small"
      role="alert"
      style={{ color: "var(--danger)", margin: "10px 0 0", textAlign: "center" }}
    >
      {message}
    </p>
  );
}

/** Map backend error codes (and transport failures) to friendly copy. */
function otpErrorMessage(err: unknown): string {
  const code = err instanceof OtpError ? err.code : "";
  const retry = err instanceof OtpError ? err.retryAfterSeconds : undefined;
  switch (code) {
    case "invalid_email":
      return "That doesn't look like a valid email.";
    case "invalid_name":
      return "Please enter your name.";
    case "invalid_phone":
      return "Enter a valid phone number (10–15 digits).";
    case "email_taken":
      return "That email is already registered — log in instead.";
    case "phone_taken":
      return "That phone number is already registered — log in instead.";
    case "no_account":
      return "No account found for that email — sign up first.";
    case "otp_cooldown":
      return `Please wait ${retry ?? 60}s before requesting another code.`;
    case "email_send_failed":
      return "We couldn't send the email. Please try again in a moment.";
    case "invalid_code":
      return "That code isn't right. Check it and try again.";
    case "code_expired":
      return "That code has expired. Request a new one.";
    case "too_many_attempts":
      return "Too many tries. Request a new code.";
    case "missing_code":
      return "Enter the 6-digit code.";
    case "auth_unavailable":
      return "Sign-in is temporarily unavailable.";
    case "network":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
