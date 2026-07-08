import type { Listing } from "./data";
import { inr, savePct } from "./data";
import type { Screen } from "./App";

/* ---------- badges ---------- */

export const Verified = ({ label = "Verified" }: { label?: string }) => (
  <span className="badge badge-trust">✓ {label}</span>
);

export const Countdown = ({ value }: { value: string }) => (
  <span className="badge badge-urgent">⏳ {value}</span>
);

/* ---------- ticket listing card (signature element) ---------- */

export function TicketCard({
  listing,
  onOpen,
  trailing,
}: {
  listing: Listing;
  onOpen?: () => void;
  trailing?: React.ReactNode;
}) {
  const l = listing;
  return (
    <button className="ticket listing-card" onClick={onOpen}>
      <div className={`poster poster-cat-${l.category.toLowerCase()}`} aria-hidden>
        {l.emoji}
      </div>
      <div className="listing-body">
        <div className="listing-title">{l.title}</div>
        <div className="listing-meta">
          {(l.venue || "Venue TBA")} · {l.when}
          {l.seats.length > 0 && (
            <>
              {" · "}
              <span className="seat-code">{l.seats.join("–")}</span>
            </>
          )}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          {l.status === "sold" ? (
            <span className="badge badge-sold">Sold</span>
          ) : (
            <>
              {l.countdown && <Countdown value={l.countdown} />}
              {l.seller.verified && <Verified />}
            </>
          )}
        </div>
      </div>
      <div className="listing-price">
        <div className="was">{inr(l.paid)}</div>
        <div className="price" style={{ fontSize: 17 }}>
          {inr(l.price)}
        </div>
        <div className="small" style={{ color: "var(--trust)", fontWeight: 600 }}>
          save {savePct(l)}%
        </div>
      </div>
      {trailing}
    </button>
  );
}

/* ---------- seller trust card (direction 1c) ---------- */

export function SellerCard({ listing }: { listing: Listing }) {
  const s = listing.seller;
  return (
    <div
      className="ticket row"
      style={{
        background: "var(--trust-bg)",
        borderColor: "rgba(14,159,110,.3)",
      }}
    >
      <div className="avatar">{s.name[0]}</div>
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 6 }}>
          <strong style={{ fontFamily: "var(--display)" }}>{s.name}</strong>
          {s.verified && <Verified />}
        </div>
        <div className="small muted">
          ★ {s.rating.toFixed(1)} · {s.swaps} swaps · ID + phone verified ·
          fast replies
        </div>
      </div>
    </div>
  );
}

/* ---------- 3-step swap tracker (direction 1d) ---------- */

export function SwapTracker({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Agree", "Transfer", "Rate"] as const;
  return (
    <div className="tracker" aria-label={`Swap progress: step ${step} of 3`}>
      {steps.flatMap((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "now" : "";
        const nodes = [];
        if (i > 0) {
          nodes.push(
            <div
              key={`bar-${label}`}
              className={`bar ${n <= step ? "done" : ""}`}
            />
          );
        }
        nodes.push(
          <div key={label} className={`step ${state}`}>
            <div className="dot">{n < step ? "✓" : n}</div>
            <span>{label}</span>
          </div>
        );
        return nodes;
      })}
    </div>
  );
}

/* ---------- bottom navigation ---------- */

export function BottomNav({
  active,
  go,
}: {
  active: "home" | "search" | "post" | "messages" | "profile";
  go: (s: Screen) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <button className={active === "home" ? "on" : ""} onClick={() => go({ name: "home" })}>
        <span className="nav-icon">⌂</span>
        <span>Home</span>
      </button>
      <button
        className={active === "search" ? "on" : ""}
        onClick={() => go({ name: "search" })}
      >
        <span className="nav-icon">⌕</span>
        <span>Search</span>
      </button>
      <button className="nav-post" onClick={() => go({ name: "post" })}>
        <span className="nav-icon">＋</span>
        <span>Sell</span>
      </button>
      <button
        className={active === "messages" ? "on" : ""}
        onClick={() => go({ name: "messages" })}
      >
        <span className="nav-icon">✉</span>
        <span>Messages</span>
      </button>
      <button
        className={active === "profile" ? "on" : ""}
        onClick={() => go({ name: "profile" })}
      >
        <span className="nav-icon">◉</span>
        <span>My tickets</span>
      </button>
    </nav>
  );
}
