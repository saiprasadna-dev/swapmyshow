import { useState } from "react";
import type { Listing } from "../data";
import { inr, savePct } from "../data";
import { SellerCard, Verified } from "../components";
import type { Screen } from "../App";

export default function ListingDetail({
  listing,
  go,
}: {
  listing: Listing;
  go: (s: Screen) => void;
}) {
  const [saved, setSaved] = useState(false);
  const l = listing;

  return (
    <div className="screen no-nav">
      <header className="top">
        <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "home" })}>
          ←
        </button>
        <h3>Listing</h3>
        <span style={{ width: 40 }} />
      </header>

      {/* trust first (direction 1c) */}
      <SellerCard listing={l} />

      <div className="ticket" style={{ marginTop: 12, padding: 0, overflow: "hidden", ["--notch-y" as never]: "62%" }}>
        <div className="poster poster-lg" aria-hidden>
          {l.emoji}
        </div>
        <div style={{ padding: 14 }}>
          <h2>{l.title}</h2>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>
            {l.venue} · {l.when}
          </p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="badge badge-plain">
              Seats <span className="seat-code">{l.seats.join("–")}</span>
            </span>
            <span className="badge badge-plain">
              {l.seats.length} ticket{l.seats.length > 1 ? "s" : ""}
            </span>
            {l.seller.verified && <Verified label="Verified seller" />}
          </div>
          <hr className="tear" />
          <div className="row between">
            <div>
              <span className="was">{inr(l.paid)}</span>{" "}
              <span className="price" style={{ fontSize: 24 }}>
                {inr(l.price)}
              </span>
            </div>
            <span className="badge badge-trust">save {savePct(l)}%</span>
          </div>
        </div>
      </div>

      <div
        className="ticket small"
        style={{ marginTop: 12, background: "var(--purple-soft)", borderColor: "var(--purple-border)" }}
      >
        <strong style={{ fontFamily: "var(--display)" }}>How the swap works</strong>
        <p style={{ margin: "4px 0 0", color: "var(--ink-2)" }}>
          Chat → confirm → {l.seller.name.split(" ")[0]} transfers the e-ticket
          to you directly. The platform connects you both — you settle the
          transfer in chat.
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16 }} className="stack">
        <button
          className="btn btn-primary"
          onClick={() => go({ name: "chat", id: l.id })}
        >
          💬 Chat to confirm
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setSaved(!saved)}
          aria-pressed={saved}
        >
          {saved ? "♥ Saved" : "♡ Save"}
        </button>
        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
          Seller confirms &amp; hands off the ticket directly.
        </p>
      </div>
    </div>
  );
}
