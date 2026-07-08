import { useEffect, useState } from "react";
import type { Listing } from "../data";
import {
  fetchMyListings,
  fetchSavedListings,
  fetchMySwaps,
  cancelListing,
  type SwapView,
} from "../apiClient";
import { BottomNav, TicketCard, Verified } from "../components";
import type { Screen } from "../App";
import {
  type AuthUser,
  OtpError,
  requestPhoneVerify,
  verifyPhone,
} from "../authClient";

const tabs = ["Selling", "Bought", "Saved"] as const;

export default function Profile({
  go,
  user,
  onSignOut,
  onUser,
}: {
  go: (s: Screen) => void;
  user?: AuthUser | null;
  onSignOut?: () => void;
  onUser?: (u: AuthUser) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Selling");
  const [selling, setSelling] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Listing[]>([]);
  const [bought, setBought] = useState<SwapView[]>([]);

  useEffect(() => {
    let active = true;
    fetchMyListings().then((l) => active && setSelling(l)).catch(() => {});
    fetchSavedListings().then((l) => active && setSaved(l)).catch(() => {});
    fetchMySwaps().then((s) => active && setBought(s)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Remove (soft-cancel) one of my listings after confirmation.
  const removeListing = async (id: number) => {
    if (!window.confirm("Remove this listing? Buyers will no longer see it.")) {
      return;
    }
    const prev = selling;
    setSelling((ls) => ls.filter((l) => l.id !== id)); // optimistic
    try {
      await cancelListing(id);
    } catch {
      setSelling(prev); // restore on failure
    }
  };

  const name = user?.name ?? "You";
  const rating = user?.rating ?? 0;
  const swaps = user?.swaps ?? 0;

  // Highest-trust badge the account has earned.
  const trustBadge = !user ? null : user.idVerified ? (
    <Verified label="ID verified" />
  ) : user.emailVerified ? (
    <Verified label="Email verified" />
  ) : user.phoneVerified ? (
    <Verified label="Phone verified" />
  ) : null;

  // The most recent completed swap the user can rate, if any.
  const recentSwap = bought.find((s) => s.step === "done") ?? bought[0];

  return (
    <div className="screen">
      <div style={{ textAlign: "center", marginTop: 8 }}>
        {user?.picture ? (
          <img
            className="avatar avatar-lg"
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
            style={{ margin: "0 auto 10px", objectFit: "cover" }}
          />
        ) : (
          <div className="avatar avatar-lg" style={{ margin: "0 auto 10px" }}>
            {name[0]}
          </div>
        )}
        <div className="row" style={{ justifyContent: "center", gap: 6 }}>
          <h2>{name}</h2>
          {trustBadge}
        </div>
        {user?.email && (
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""}
          </p>
        )}
        <p className="small muted" style={{ margin: "2px 0 0" }}>
          ★ {rating.toFixed(1)} · {swaps} {swaps === 1 ? "swap" : "swaps"}
        </p>
      </div>

      {user?.phone && !user.phoneVerified && onUser && (
        <PhoneVerify onVerified={onUser} />
      )}

      <div className="tab-row" role="tablist" aria-label="My tickets">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`chip ${tab === t ? "on" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="stack">
        {tab === "Selling" &&
          selling.map((l) => (
            <div key={l.id} style={{ display: "grid", gap: 8 }}>
              <TicketCard
                listing={l}
                onOpen={
                  l.status === "sold" ? undefined : () => go({ name: "listing", id: l.id })
                }
              />
              {l.status !== "sold" && (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-outline btn-small"
                    style={{ flex: 1 }}
                    onClick={() => go({ name: "post", editId: l.id })}
                  >
                    ✎ Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-small"
                    style={{ flex: 1, color: "var(--danger)" }}
                    onClick={() => removeListing(l.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        {tab === "Bought" &&
          bought.map((s) => (
            <TicketCard
              key={s.id}
              listing={s.listing}
              onOpen={() => go({ name: "chat", swapId: s.id })}
            />
          ))}
        {tab === "Saved" &&
          saved.map((l) => (
            <TicketCard
              key={l.id}
              listing={l}
              onOpen={() => go({ name: "listing", id: l.id })}
            />
          ))}
        {((tab === "Selling" && selling.length === 0) ||
          (tab === "Bought" && bought.length === 0) ||
          (tab === "Saved" && saved.length === 0)) && (
          <p className="small muted" style={{ textAlign: "center", padding: 20 }}>
            Nothing here yet.
          </p>
        )}
      </div>

      {recentSwap && (
        <button
          className="ticket row"
          style={{
            marginTop: 12,
            background: "var(--purple-soft)",
            borderColor: "var(--purple-border)",
          }}
          onClick={() => go({ name: "rate", swapId: recentSwap.id })}
        >
          <span aria-hidden>⭐</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Rate your recent swaps
          </span>
          <span style={{ marginLeft: "auto" }} aria-hidden>
            →
          </span>
        </button>
      )}

      {user && onSignOut && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={onSignOut}
        >
          Sign out
        </button>
      )}

      <BottomNav active="profile" go={go} />
    </div>
  );
}

/** Inline phone-verification: request a code, enter it, done. On success the
    updated user (phoneVerified = true) is lifted back up so the trust badge
    refreshes. Shows a dev code when no SMS provider is configured. */
function PhoneVerify({ onVerified }: { onVerified: (u: AuthUser) => void }) {
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const { debugCode } = await requestPhoneVerify();
      setDevCode(debugCode);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(err instanceof OtpError ? phoneVerifyMessage(err.code) : "Failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      onVerified(await verifyPhone(code));
    } catch (err) {
      setError(err instanceof OtpError ? phoneVerifyMessage(err.code) : "Failed. Try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="ticket"
      style={{ marginTop: 12, background: "var(--purple-soft)", borderColor: "var(--purple-border)" }}
    >
      <div className="row between" style={{ gap: 8 }}>
        <strong style={{ fontFamily: "var(--display)", fontSize: 14 }}>
          📱 Verify your phone
        </strong>
        {step === "idle" && (
          <button className="btn btn-primary btn-small" onClick={request} disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        )}
      </div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>
        A verified phone earns the trust badge buyers look for.
      </p>

      {step === "code" && (
        <div style={{ marginTop: 10 }}>
          {devCode && (
            <div className="google-hint" style={{ marginBottom: 10 }}>
              <strong>Dev mode</strong>
              <span>
                No SMS provider — your code is <code>{devCode}</code>.
              </span>
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              style={{ letterSpacing: 6, fontFamily: "var(--mono)", flex: 1 }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button
              className="btn btn-primary btn-small"
              onClick={verify}
              disabled={busy || code.length < 6}
            >
              Verify
            </button>
          </div>
          <button
            type="button"
            className="linklike"
            style={{ marginTop: 8 }}
            onClick={request}
            disabled={busy}
          >
            Resend code
          </button>
        </div>
      )}

      {error && (
        <p className="small" role="alert" style={{ color: "var(--danger)", margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function phoneVerifyMessage(code: string): string {
  switch (code) {
    case "invalid_code":
      return "That code isn't right. Check it and try again.";
    case "code_expired":
      return "That code expired. Request a new one.";
    case "too_many_attempts":
      return "Too many tries. Request a new code.";
    case "otp_cooldown":
      return "Please wait a bit before requesting another code.";
    case "no_phone":
      return "Add a phone number first.";
    case "network":
      return "Network error. Try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
