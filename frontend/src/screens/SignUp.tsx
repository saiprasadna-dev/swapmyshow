import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Verified } from "../components";
import { GoogleSignInButton } from "../auth";
import {
  apiConfigured,
  login,
  requestSignupOtp,
  verifySignupOtp,
  requestPasswordReset,
  resetPassword,
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
  const [forgot, setForgot] = useState(false);

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
          forgot ? (
            <ForgotForm onUser={onUser} onBack={() => setForgot(false)} />
          ) : (
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
                <LoginForm onUser={onUser} onForgot={() => setForgot(true)} />
              ) : (
                <SignupForm onUser={onUser} />
              )}
            </>
          )
        ) : (
          <DemoContinue onDone={onDone} />
        )}

        {/* Google sign-in is web-only; the Android app uses email + password. */}
        {!Capacitor.isNativePlatform() && (
          <>
            <hr className="tear" />
            {/* real Google account picker → signs in with the chosen Gmail */}
            <div className="row" style={{ justifyContent: "center" }}>
              <GoogleSignInButton onUser={onUser} />
            </div>
          </>
        )}
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
const passwordOk = (v: string) => v.length >= 8;

/** Log in with email + password — no code step. */
function LoginForm({
  onUser,
  onForgot,
}: {
  onUser: (u: AuthUser) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = emailOk(email) && password.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await login(email.trim().toLowerCase(), password);
      onUser(user);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={busy || !canSubmit}>
        {busy ? "Signing in…" : "Log in"}
      </button>
      <button
        type="button"
        className="linklike"
        style={{ margin: "10px auto 0", display: "block" }}
        onClick={onForgot}
      >
        Forgot password?
      </button>
      {error && <FormError message={error} />}
    </>
  );
}

/** Forgot password: enter email → emailed code → set a new password. On
    success the user is signed in with the new password. */
function ForgotForm({
  onUser,
  onBack,
}: {
  onUser: (u: AuthUser) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "reset") codeRef.current?.focus();
  }, [step]);

  const send = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestPasswordReset(email.trim().toLowerCase());
      setDevCode(debugCode);
      setStep("reset");
      setCode("");
      setPassword("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (code.length < 6 || !passwordOk(password) || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await resetPassword(email.trim().toLowerCase(), code, password);
      onUser(user);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "reset") {
    return (
      <>
        <h3 style={{ margin: "0 0 12px" }}>Reset password</h3>
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="reset-code">Code</label>
          <input
            id="reset-code"
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            style={{ letterSpacing: 6, fontFamily: "var(--mono)" }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
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
          onClick={submit}
          disabled={busy || code.length < 6 || !passwordOk(password)}
        >
          {busy ? "Updating…" : "Update password"}
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

  return (
    <>
      <h3 style={{ margin: "0 0 4px" }}>Forgot password</h3>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        Enter your email and we'll send a reset code.
      </p>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
      </div>
      <button className="btn btn-primary" onClick={send} disabled={busy || !emailOk(email)}>
        {busy ? "Sending…" : "Send reset code"}
      </button>
      <button
        type="button"
        className="linklike"
        style={{ margin: "10px auto 0", display: "block" }}
        onClick={onBack}
      >
        Back to log in
      </button>
      {error && <FormError message={error} />}
    </>
  );
}

/** Sign up: name + email + phone + password → emailed code. Email and phone
    are one-time; after this, sign in with email + password. */
function SignupForm({ onUser }: { onUser: (u: AuthUser) => void }) {
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const formOk =
    name.trim().length >= 2 && emailOk(email) && phoneOk(phone) && passwordOk(password);
  const profile = () => ({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.replace(/[\s()-]/g, ""),
    password,
  });

  const send = async () => {
    if (!formOk || busy) return;
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestSignupOtp(profile());
      setDevCode(debugCode);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await verifySignupOtp(profile(), code);
      onUser(user);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "code") {
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
              setStep("form");
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

        <button className="btn btn-primary" onClick={verify} disabled={busy || code.length < 6}>
          {busy ? "Verifying…" : "Verify & create account"}
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
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="su-phone">Phone</label>
        <input
          id="su-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="su-password">Password</label>
        <input
          id="su-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
      </div>
      <button className="btn btn-primary" onClick={send} disabled={busy || !formOk}>
        {busy ? "Sending…" : "Send code"}
      </button>
      <p className="small muted" style={{ margin: "10px 0 0", textAlign: "center" }}>
        We'll email a code to verify your address. You'll log in with your password after.
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
function authErrorMessage(err: unknown): string {
  const code = err instanceof OtpError ? err.code : "";
  const retry = err instanceof OtpError ? err.retryAfterSeconds : undefined;
  switch (code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "weak_password":
      return "Password must be at least 8 characters.";
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
      return "No account found for that email.";
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
