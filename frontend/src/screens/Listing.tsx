import { useEffect, useState } from "react";
import type { Listing } from "../data";
import { inr, savePct } from "../data";
import { fetchListing, startSwap, toggleSaved } from "../apiClient";
import { SellerCard, Verified } from "../components";
import type { Screen } from "../App";

export default function ListingDetail({
  id,
  go,
}: {
  id: number;
  go: (s: Screen) => void;
}) {
  const [l, setL] = useState<Listing | null>(null);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchListing(id)
      .then((listing) => active && setL(listing))
      .catch(() => active && setL(null));
    return () => {
      active = false;
    };
  }, [id]);

  const openChat = async () => {
    if (!l || starting) return;
    setStarting(true);
    try {
      const swap = await startSwap(l.id);
      go({ name: "chat", swapId: swap.id });
    } catch {
      setStarting(false);
    }
  };

  const save = async () => {
    if (!l) return;
    const next = !saved;
    setSaved(next);
    try {
      const result = await toggleSaved(l.id);
      setSaved(result);
    } catch {
      setSaved(!next); // revert on failure
    }
  };

  if (!l) {
    return (
      <div className="screen no-nav">
        <header className="top">
          <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "home" })}>
            ←
          </button>
          <h3>Listing</h3>
          <span style={{ width: 40 }} />
        </header>
        <p className="small muted" style={{ textAlign: "center", marginTop: 40 }}>
          Loading…
        </p>
      </div>
    );
  }

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
        <div className={`poster poster-lg poster-cat-${l.category.toLowerCase()}`} aria-hidden>
          {l.emoji}
        </div>
        <div style={{ padding: 14 }}>
          <h2>{l.title}</h2>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>
            {[l.venue, l.city, l.when].filter(Boolean).join(" · ") || l.when}
          </p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {l.seats.length > 0 && (
              <span className="badge badge-plain">
                Seats <span className="seat-code">{l.seats.join("–")}</span>
              </span>
            )}
            <span className="badge badge-plain">
              {Math.max(l.seats.length, 1)} ticket
              {Math.max(l.seats.length, 1) > 1 ? "s" : ""}
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
        <button className="btn btn-primary" onClick={openChat} disabled={starting}>
          💬 {starting ? "Opening chat…" : "Chat to confirm"}
        </button>
        <button
          className="btn btn-outline"
          onClick={save}
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
