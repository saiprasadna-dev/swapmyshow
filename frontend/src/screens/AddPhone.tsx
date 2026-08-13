import { useState } from "react";
import { setPhone, OtpError, type AuthUser } from "../authClient";

const phoneOk = (v: string) => /^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ""));

/** One-time phone collection shown after a sign-up that didn't include a phone
    (e.g. Google). The number is stored, not verified. */
export default function AddPhone({
  onDone,
  onSignOut,
}: {
  onDone: (user: AuthUser) => void;
  onSignOut?: () => void;
}) {
  const [phone, setPhoneValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!phoneOk(phone) || busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await setPhone(phone.replace(/[\s()-]/g, ""));
      onDone(user);
    } catch (err) {
      setError(phoneErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="screen no-nav auth-screen">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-mark" aria-hidden>
            S
          </div>
          <h1>One last thing</h1>
          <p>Add your phone so buyers and sellers can reach you for the swap.</p>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-panel-card">
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhoneValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !phoneOk(phone)}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
          <p className="small muted" style={{ margin: "10px 0 0", textAlign: "center" }}>
            Stored for the swap, not verified. It can&apos;t be changed later.
          </p>
          {error && (
            <p className="small" role="alert" style={{ color: "var(--danger)", margin: "10px 0 0", textAlign: "center" }}>
              {error}
            </p>
          )}
        </div>
        {onSignOut && (
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function phoneErrorMessage(err: unknown): string {
  const code = err instanceof OtpError ? err.code : "";
  switch (code) {
    case "invalid_phone":
      return "Enter a valid phone number (10–15 digits).";
    case "phone_taken":
      return "That phone number is already registered to another account.";
    case "phone_already_set":
      return "A phone number is already on file for this account.";
    case "network":
      return "Network error. Check your connection and try again.";
    default:
      return "Couldn't save your phone. Please try again.";
  }
}
