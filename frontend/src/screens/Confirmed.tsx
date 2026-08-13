import { useEffect, useState } from "react";
import { inr } from "../data";
import { fetchSwap, advanceSwap, type SwapView } from "../apiClient";
import type { Screen } from "../App";

const seatLabel = (seats: string[]) =>
  seats.length > 0 ? seats.join("–") : "Seat TBA";

const ticketLabel = (seats: string[]) => {
  const n = Math.max(seats.length, 1);
  return `${n} ticket${n === 1 ? "" : "s"}`;
};

export default function Confirmed({
  swapId,
  go,
}: {
  swapId: number;
  go: (s: Screen) => void;
}) {
  const [swap, setSwap] = useState<SwapView | null>(null);
  const [transferred, setTransferred] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSwap(swapId)
      .then((s) => {
        if (!active) return;
        setSwap(s);
        setTransferred(s.sellerMarkedTransferred || s.step === "done");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [swapId]);

  const markTransferred = async () => {
    setTransferred(true);
    try {
      const updated = await advanceSwap(swapId, "transfer");
      setSwap(updated);
    } catch {
      setTransferred(false);
    }
  };

  if (!swap) {
    return (
      <div className="screen no-nav">
        <p className="small muted" style={{ textAlign: "center", marginTop: 40 }}>
          Loading…
        </p>
      </div>
    );
  }

  const l = swap.listing;
  const seats = seatLabel(l.seats);
  const other =
    swap.role === "seller" ? swap.buyerName || "Buyer" : l.seller.name;

  return (
    <div className="screen no-nav confirmed-screen">
      <header className="top">
        <button
          className="icon-btn back"
          aria-label="Back"
          onClick={() => go({ name: "messages" })}
        >
          ←
        </button>
        <h3>Swap confirmed</h3>
        <span style={{ width: 40 }} />
      </header>

      <div className="confirmed-hero">
        <div className="success-pop" aria-hidden>
          ✓
        </div>
        <div>
          <h1 style={{ fontSize: 22 }}>You&apos;re booked in</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Hand off the e-ticket in chat and you&apos;re set.
          </p>
        </div>
      </div>

      <div className="ticket confirm-card">
        <div className="confirm-card-kicker">Your tickets</div>
        <div className="listing-card" style={{ marginBottom: 10 }}>
          <div
            className={`poster poster-cat-${l.category.toLowerCase()}`}
            aria-hidden
          >
            {l.screenshotUrl ? <img src={l.screenshotUrl} alt="" /> : l.emoji}
          </div>
          <div className="listing-body">
            <div className="listing-title">{l.title}</div>
            <div className="listing-meta">
              {[l.venue || "Venue TBA", l.when].join(" · ")}
            </div>
          </div>
          <div className="listing-price">
            <div className="price" style={{ fontSize: 16 }}>{inr(swap.agreedPrice)}</div>
            <div className="small muted">agreed</div>
          </div>
        </div>
        <dl className="confirm-facts">
          <div>
            <dt>Seats</dt>
            <dd>
              <span className="seat-code">{seats}</span>
              <span className="confirm-tickets">{ticketLabel(l.seats)}</span>
            </dd>
          </div>
          <div>
            <dt>With</dt>
            <dd className="row" style={{ gap: 8 }}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                {other[0]}
              </div>
              {other}
            </dd>
          </div>
        </dl>
      </div>

      <div className="stack confirmed-cta">
        <button
          className="btn btn-primary"
          onClick={markTransferred}
          disabled={transferred}
          style={transferred ? { background: "var(--trust)", boxShadow: "none" } : undefined}
        >
          {transferred ? "✓ Marked as transferred" : "Mark as transferred"}
        </button>
        <button className="btn btn-outline" onClick={() => go({ name: "rate", swapId })}>
          Rate this swap
        </button>
        <button className="btn btn-ghost" onClick={() => go({ name: "chat", swapId })}>
          Back to chat
        </button>
      </div>

      <div className="nudge">
        <span aria-hidden>⚠</span> Only confirm once you have the ticket.
      </div>
    </div>
  );
}
