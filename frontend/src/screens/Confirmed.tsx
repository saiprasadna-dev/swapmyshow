import { useEffect, useState } from "react";
import { inr } from "../data";
import { fetchSwap, advanceSwap, type SwapView } from "../apiClient";
import type { Screen } from "../App";

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
      <div className="screen no-nav" style={{ justifyContent: "center" }}>
        <p className="small muted" style={{ textAlign: "center" }}>Loading…</p>
      </div>
    );
  }

  const l = swap.listing;

  return (
    <div className="screen no-nav" style={{ justifyContent: "center", gap: 16, textAlign: "center" }}>
      <div className="success-pop" aria-hidden>
        ✓
      </div>
      <div>
        <h1 style={{ fontSize: 24 }}>Swap confirmed!</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Now hand off the ticket in chat &amp; you're set.
        </p>
      </div>

      <div className="ticket" style={{ textAlign: "left" }}>
        <div className="row between">
          <span>
            {l.title} · <span className="seat-code">{l.seats.join("–")}</span>
          </span>
          <span className="price">{inr(swap.agreedPrice)}</span>
        </div>
        <hr className="tear" />
        <div className="row" style={{ gap: 8 }}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>
            {l.seller.name[0]}
          </div>
          <span className="small muted">with {l.seller.name}</span>
        </div>
      </div>

      <div className="stack">
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
      </div>

      <div className="nudge" style={{ justifyContent: "center" }}>
        <span aria-hidden>⚠</span> Only confirm once you have the ticket.
      </div>
    </div>
  );
}
