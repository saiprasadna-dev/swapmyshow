import { useEffect, useRef, useState } from "react";
import { Verified } from "../components";
import { GoogleSignInButton } from "../auth";
import {
  apiConfigured,
  requestOtp,
  verifyOtp,
  OtpError,
  type AuthUser,
} from "../authClient";

export default function SignUp({
  onDone,
  onUser,
}: {
  onDone: () => void;
  onUser: (user: AuthUser) => void;
}) {
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
          <EmailOtpForm onUser={onUser} />
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

/** Two-step passwordless sign-in: enter email → enter the emailed code. */
function EmailOtpForm({ onUser }: { onUser: (u: AuthUser) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const send = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestOtp(email.trim().toLowerCase());
      setDevCode(debugCode);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
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

  if (step === "email") {
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
          onKeyDown={(e) => e.key === "Enter" && verify()}
        />
      </div>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        Sent to {email}.{" "}
        <button
          type="button"
          className="linklike"
          onClick={() => {
            setStep("email");
            setError("");
          }}
        >
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
        onClick={verify}
        disabled={busy || code.length < 6}
      >
        {busy ? "Verifying…" : "Verify & continue"}
      </button>
      <button
        type="button"
        className="linklike"
        style={{ margin: "10px auto 0", display: "block" }}
        onClick={send}
        disabled={busy}
      >
        Resend code
      </button>
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

/** Map backend OTP error codes (and transport failures) to friendly copy. */
function otpErrorMessage(err: unknown): string {
  const code = err instanceof OtpError ? err.code : "";
  const retry = err instanceof OtpError ? err.retryAfterSeconds : undefined;
  switch (code) {
    case "invalid_email":
      return "That doesn't look like a valid email.";
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
