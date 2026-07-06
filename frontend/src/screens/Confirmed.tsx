import { useState } from "react";
import type { Listing } from "../data";
import { inr } from "../data";
import type { Screen } from "../App";

export default function Confirmed({
  listing,
  go,
}: {
  listing: Listing;
  go: (s: Screen) => void;
}) {
  const [transferred, setTransferred] = useState(false);
  const l = listing;

  return (
    <div className="screen no-nav" style={{ justifyContent: "center", gap: 16, textAlign: "center" }}>
      <div className="success-pop" aria-hidden>
        ✓
      </div>
      <div>
        <h1 style={{ fontSize: 24 }}>Swap confirmed!</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Now head off the ticket in chat &amp; you're set.
        </p>
      </div>

      <div className="ticket" style={{ textAlign: "left" }}>
        <div className="row between">
          <span>
            {l.title} · <span className="seat-code">{l.seats.join("–")}</span>
          </span>
          <span className="price">{inr(l.price)}</span>
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
          onClick={() => setTransferred(true)}
          disabled={transferred}
          style={transferred ? { background: "var(--trust)", boxShadow: "none" } : undefined}
        >
          {transferred ? "✓ Marked as transferred" : "Mark as transferred"}
        </button>
        <button className="btn btn-outline" onClick={() => go({ name: "rate", id: l.id })}>
          Rate this swap
        </button>
      </div>

      <div className="nudge" style={{ justifyContent: "center" }}>
        <span aria-hidden>⚠</span> Only confirm once you have the ticket.
      </div>
    </div>
  );
}
