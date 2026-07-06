import { useState } from "react";
import type { Listing } from "../data";
import { inr } from "../data";
import { SwapTracker, Verified } from "../components";
import type { Screen } from "../App";

export default function Chat({
  listing,
  go,
}: {
  listing: Listing;
  go: (s: Screen) => void;
}) {
  // tracker: step 1 = agree on price/seats, step 2 = transfer + confirm receipt
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<string[]>([]);

  const l = listing;
  const first = l.seller.name.split(" ")[0];
  const total = l.price;

  const send = () => {
    if (!draft.trim()) return;
    setExtra((xs) => [...xs, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="screen no-nav">
      <header className="top" style={{ marginBottom: 10 }}>
        <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "listing", id: l.id })}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 6 }}>
            <h3>{l.seller.name}</h3>
            <Verified />
          </div>
          <div className="small muted">
            {l.title} · {l.when}
          </div>
        </div>
      </header>

      <SwapTracker step={confirmed ? 2 : 1} />

      <div className="chat-scroll">
        <div className="bubble me">Hey! Are the seats still available?</div>
        <div className="bubble them">
          Yes! <span className="seat-code">{l.seats.join("–")}</span>. Can send
          now <span aria-hidden>🙂</span>
        </div>
        <div className="bubble me">
          Perfect. {inr(total)} for {l.seats.length > 1 ? "both" : "it"}?
        </div>

        {/* confirm details card */}
        <div className="ticket" style={{ alignSelf: "stretch" }}>
          <div className="small muted" style={{ fontWeight: 700, letterSpacing: ".04em" }}>
            CONFIRM DETAILS
          </div>
          <div className="row between" style={{ margin: "6px 0" }}>
            <span>
              {l.seats.length} seat{l.seats.length > 1 ? "s" : ""}{" "}
              <span className="seat-code">{l.seats.join("–")}</span>
            </span>
            <span className="price">{inr(total)}</span>
          </div>
          {!confirmed ? (
            <button className="btn btn-primary" onClick={() => setConfirmed(true)}>
              ✓ Confirm swap
            </button>
          ) : (
            <div className="badge badge-trust" style={{ width: "100%", justifyContent: "center", padding: "8px 0" }}>
              ✓ Swap confirmed — waiting on transfer
            </div>
          )}
        </div>

        {confirmed && (
          <>
            <div className="bubble them">
              Sent the tickets to your number <span aria-hidden>🎉</span>
            </div>
            <div className="ticket" style={{ alignSelf: "stretch" }}>
              <div className="small muted" style={{ fontWeight: 700, letterSpacing: ".04em" }}>
                STEP 2 · CONFIRM RECEIPT
              </div>
              <p className="small" style={{ margin: "4px 0 10px" }}>
                Got the e-ticket from {first}?
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary btn-small"
                  style={{ flex: 1 }}
                  onClick={() => go({ name: "confirmed", id: l.id })}
                >
                  ✓ Yes, got it
                </button>
                <button className="btn btn-ghost btn-small" style={{ flex: 1 }}>
                  Not yet
                </button>
              </div>
            </div>
          </>
        )}

        {extra.map((m, i) => (
          <div key={i} className="bubble me">
            {m}
          </div>
        ))}

        {!confirmed && (
          <div className="row" style={{ gap: 8 }}>
            <button className="chip" onClick={() => setExtra((xs) => [...xs, "Still available?"])}>
              Still available?
            </button>
            <button className="chip" onClick={() => setExtra((xs) => [...xs, "Can you send proof?"])}>
              Send proof
            </button>
          </div>
        )}
      </div>

      <div className="nudge" style={{ marginBottom: 10 }}>
        <span aria-hidden>⚠</span> Only confirm once you have the ticket.
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          aria-label="Message"
          style={{ borderRadius: 999, flex: 1 }}
        />
        <button
          className="icon-btn"
          style={{ background: "var(--purple)", color: "#fff", border: "none" }}
          aria-label="Send message"
          onClick={send}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
