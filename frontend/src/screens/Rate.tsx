import { useEffect, useState } from "react";
import { fetchSwap, submitRating, ApiError, type SwapView } from "../apiClient";
import type { Screen } from "../App";

export default function Rate({
  swapId,
  go,
}: {
  swapId: number;
  go: (s: Screen) => void;
}) {
  const [swap, setSwap] = useState<SwapView | null>(null);
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSwap(swapId)
      .then((s) => active && setSwap(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [swapId]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitRating(swapId, stars, note.trim());
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rated") {
        setDone(true); // already rated counts as done
      } else {
        setError(e instanceof ApiError ? e.code : "rate_failed");
        setBusy(false);
      }
    }
  };

  // Fall back to a neutral placeholder until the swap loads.
  const s = swap?.listing.seller ?? { name: "Seller", swaps: 0 };

  return (
    <div className="screen no-nav">
      <header className="top">
        <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "profile" })}>
          ←
        </button>
        <h3>Rate your swap</h3>
        <span style={{ width: 40 }} />
      </header>

      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div className="avatar avatar-lg" style={{ margin: "0 auto 10px" }}>
          {s.name[0]}
        </div>
        <h2>{s.name}</h2>
      </div>

      <div className="stars" style={{ margin: "18px 0" }} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={n <= stars ? "on" : ""}
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="note">A note (optional)</label>
        <textarea
          id="note"
          rows={3}
          placeholder="Quick handoff, seats as listed…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="ticket">
        <div className="small muted" style={{ fontWeight: 700, letterSpacing: ".05em" }}>
          WHY WE'RE SAFER
        </div>
        <ul className="check-list">
          <li>
            <span className="tick">✓</span> ID verified
          </li>
          <li>
            <span className="tick">✓</span> Phone verified
          </li>
          <li>
            <span className="tick">✓</span> {s.swaps} successful swaps
          </li>
        </ul>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 18 }}>
        {done ? (
          <div className="ticket" style={{ textAlign: "center", background: "var(--trust-bg)", borderColor: "rgba(14,159,110,.3)" }}>
            <strong style={{ color: "var(--trust)" }}>✓ Rating submitted</strong>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>
              Ratings build the trust badges shown everywhere.
            </p>
            <button className="btn btn-outline btn-small" style={{ margin: "0 auto" }} onClick={() => go({ name: "home" })}>
              Back to home
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="small" style={{ color: "var(--danger, #c0392b)", textAlign: "center", marginBottom: 8 }}>
                Couldn't submit — try again.
              </p>
            )}
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Submitting…" : "Submit rating"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
