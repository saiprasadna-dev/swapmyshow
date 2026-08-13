import { useEffect, useState } from "react";
import { inr } from "../data";
import { fetchSwap, submitRating, ApiError, type SwapView } from "../apiClient";
import type { Screen } from "../App";

const seatLabel = (seats: string[]) =>
  seats.length > 0 ? seats.join("–") : "Seat TBA";

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
  const l = swap?.listing;
  const other =
    swap?.role === "seller" ? swap.buyerName || "Buyer" : s.name;

  return (
    <div className="screen no-nav rate-screen">
      <header className="top">
        <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "profile" })}>
          ←
        </button>
        <h3>Rate your swap</h3>
        <span style={{ width: 40 }} />
      </header>

      {swap && l && (
        <div className="ticket listing-card chat-ticket" style={{ marginBottom: 12 }}>
          <div
            className={`poster poster-cat-${l.category.toLowerCase()}`}
            aria-hidden
          >
            {l.screenshotUrl ? <img src={l.screenshotUrl} alt="" /> : l.emoji}
          </div>
          <div className="listing-body">
            <div className="listing-title">{l.title}</div>
            <div className="listing-meta">
              {[l.venue || "Venue TBA", l.when, seatLabel(l.seats)].join(" · ")}
            </div>
          </div>
          <div className="listing-price">
            <div className="price" style={{ fontSize: 16 }}>{inr(swap.agreedPrice)}</div>
            <div className="small muted">agreed</div>
          </div>
        </div>
      )}

      <div className="ticket rate-card">
        <div className="row" style={{ gap: 12 }}>
          <div className="avatar">{other[0]}</div>
          <div>
            <h2 style={{ fontSize: 18 }}>{other}</h2>
            <div className="small muted">How did this swap go?</div>
          </div>
        </div>

        <div className="stars" style={{ margin: "14px 0 4px" }} role="radiogroup" aria-label="Rating">
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

      <div className="ticket confirm-card">
        <div className="confirm-card-kicker">Why we&apos;re safer</div>
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

      <div className="rate-cta">
        {done ? (
          <div className="ticket" style={{ textAlign: "center", background: "var(--trust-bg)", borderColor: "var(--brand-border)" }}>
            <strong style={{ color: "var(--trust)" }}>✓ Rating submitted</strong>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>
              Ratings build the trust badges shown everywhere.
            </p>
            <button className="btn btn-primary" onClick={() => go({ name: "home" })}>
              Back to home
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="small" style={{ color: "var(--danger, #c0392b)", textAlign: "center", marginBottom: 8 }}>
                Couldn&apos;t submit — try again.
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
