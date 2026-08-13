import { useCallback, useEffect, useRef, useState } from "react";
import { inr } from "../data";
import {
  fetchSwap,
  fetchMessages,
  sendMessage,
  advanceSwap,
  markSwapRead,
  makeOffer,
  acceptOffer,
  type SwapView,
  type ChatMessage,
} from "../apiClient";
import type { AuthUser } from "../authClient";
import { SwapTracker, Verified, BottomNav } from "../components";
import type { Screen } from "../App";

// DB step → 3-step tracker position.
const trackerStep = (step: SwapView["step"]): 1 | 2 | 3 =>
  step === "agree" ? 1 : step === "transfer" ? 2 : 3;

const seatLabel = (seats: string[]) =>
  seats.length > 0 ? seats.join("–") : "Seat TBA";

const ticketLabel = (seats: string[]) => {
  const n = Math.max(seats.length, 1);
  return `${n} ticket${n === 1 ? "" : "s"}`;
};

const msgTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

export default function Chat({
  swapId,
  user,
  go,
}: {
  swapId: number;
  user: AuthUser | null;
  go: (s: Screen) => void;
}) {
  const [swap, setSwap] = useState<SwapView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [offerDraft, setOfferDraft] = useState("");
  const lastId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge in only messages we haven't seen, keeping chronological order.
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastId.current = next.reduce((max, m) => Math.max(max, m.id), lastId.current);
      return next;
    });
  }, []);

  // Load the swap once, then poll for new messages.
  useEffect(() => {
    let active = true;
    fetchSwap(swapId).then((s) => active && setSwap(s)).catch(() => {});
    fetchMessages(swapId).then((m) => active && merge(m)).catch(() => {});

    const timer = setInterval(() => {
      fetchMessages(swapId, lastId.current)
        .then((m) => active && merge(m))
        .catch(() => {});
    }, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [swapId, merge]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, swap]);

  // Viewing the chat marks it read (clears its unread badge). Runs on open and
  // whenever new messages arrive while it's on screen.
  useEffect(() => {
    markSwapRead(swapId).catch(() => {});
  }, [swapId, messages.length]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setDraft("");
    try {
      const msg = await sendMessage(swapId, body);
      merge([msg]);
    } catch {
      /* keep the draft cleared; poll will reconcile */
    }
  };

  const advance = async (action: "confirm" | "transfer" | "receipt") => {
    try {
      const updated = await advanceSwap(swapId, action);
      setSwap(updated);
      if (action === "receipt") go({ name: "confirmed", swapId });
    } catch {
      /* ignore; UI stays on current step */
    }
  };

  const submitOffer = async () => {
    const price = Number(offerDraft.replace(/[^\d]/g, ""));
    if (!price) return;
    try {
      const updated = await makeOffer(swapId, price);
      setSwap(updated);
      setOfferDraft("");
    } catch {
      /* ignore */
    }
  };

  const accept = async () => {
    try {
      setSwap(await acceptOffer(swapId));
    } catch {
      /* ignore */
    }
  };

  if (!swap) {
    return (
      <div className="screen chat-screen">
        <p className="small muted" style={{ textAlign: "center", marginTop: 40 }}>
          Loading chat…
        </p>
        <BottomNav active="messages" go={go} />
      </div>
    );
  }

  const l = swap.listing;
  // Show the *counterparty*: the buyer sees the seller, the seller sees the buyer.
  const isSeller = swap.role === "seller";
  const otherName = isSeller
    ? swap.buyerName || "Buyer"
    : swap.listing.seller.name;
  const otherVerified = isSeller ? false : swap.listing.seller.verified;
  const first = otherName.split(" ")[0];
  const total = swap.agreedPrice;
  const confirmed = swap.step !== "agree";
  const seats = seatLabel(l.seats);
  const tickets = ticketLabel(l.seats);

  return (
    <div className="screen chat-screen">
      <div className="chat-head">
        <header className="top chat-top">
          <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "messages" })}>
            ←
          </button>
          <div className="chat-who">
            <div className="row" style={{ gap: 6 }}>
              <h3>{otherName}</h3>
              {otherVerified && <Verified />}
            </div>
            <div className="small muted">
              {isSeller ? "Buyer" : "Seller"} · this swap
            </div>
          </div>
        </header>

        {/* Persistent ticket strip — tap opens the listing. */}
        <button
          className="ticket listing-card chat-ticket"
          onClick={() => go({ name: "listing", id: l.id })}
        >
          <div
            className={`poster poster-cat-${l.category.toLowerCase()}`}
            aria-hidden
          >
            {l.screenshotUrl ? <img src={l.screenshotUrl} alt="" /> : l.emoji}
          </div>
          <div className="listing-body">
            <div className="listing-title">{l.title}</div>
            <div className="listing-meta">
              {[l.venue || "Venue TBA", l.when, seats].join(" · ")}
            </div>
          </div>
          <div className="listing-price">
            <div className="price" style={{ fontSize: 16 }}>{inr(total)}</div>
            <div className="small muted">agreed</div>
          </div>
        </button>

        <SwapTracker step={trackerStep(swap.step)} />
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="small muted chat-empty">
            Say hello and confirm the booking details below.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.senderId === user?.id ? "me" : "them"}`}>
            <span className="bubble-text">{m.body}</span>
            {m.createdAt && (
              <time className="bubble-time" dateTime={m.createdAt}>
                {msgTime(m.createdAt)}
              </time>
            )}
          </div>
        ))}

        {/* Booking summary + confirm / offer */}
        <div className="ticket confirm-card">
          <div className="confirm-card-kicker">Booking summary</div>
          <dl className="confirm-facts">
            <div>
              <dt>Event</dt>
              <dd>{l.title}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>
                {l.venue || "Venue TBA"}
                {l.city ? ` · ${l.city}` : ""}
              </dd>
            </div>
            <div>
              <dt>Date & time</dt>
              <dd>{l.when}</dd>
            </div>
            <div>
              <dt>Seats</dt>
              <dd>
                <span className="seat-code">{seats}</span>
                <span className="confirm-tickets">{tickets}</span>
              </dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd className="price">{inr(total)}</dd>
            </div>
          </dl>

          {swap.step === "agree" && (
            <div className="confirm-offer">
              {swap.offerPrice != null ? (
                swap.offerBy === user?.id ? (
                  <div className="badge badge-plain confirm-offer-status">
                    You offered {inr(swap.offerPrice)} · waiting for {first}
                  </div>
                ) : (
                  <button className="btn btn-outline" onClick={accept}>
                    ✓ Accept {first}&apos;s offer of {inr(swap.offerPrice)}
                  </button>
                )
              ) : (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="offer-price">Your offer</label>
                  <input
                    id="offer-price"
                    className="input"
                    inputMode="numeric"
                    placeholder="Offer a price"
                    value={offerDraft}
                    onChange={(e) => setOfferDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitOffer()}
                    aria-label="Offer a price"
                  />
                </div>
              )}
            </div>
          )}

          {!confirmed ? (
            <div className="confirm-actions">
              {swap.offerPrice == null && (
                <button className="btn btn-ghost" onClick={submitOffer} disabled={!offerDraft.trim()}>
                  Send offer
                </button>
              )}
              <button className="btn btn-primary" onClick={() => advance("confirm")}>
                ✓ Confirm swap
              </button>
            </div>
          ) : (
            <div className="badge badge-trust confirm-offer-status">
              ✓ Swap confirmed — waiting on transfer
            </div>
          )}
        </div>

        {/* Buyer's step 2: confirm they received the ticket. */}
        {confirmed && !isSeller && (
          <div className="ticket confirm-card">
            <div className="confirm-card-kicker">Step 2 · Confirm receipt</div>
            <p className="small" style={{ margin: "0 0 12px" }}>
              Got the e-ticket from {first}?
            </p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" type="button">
                Not yet
              </button>
              <button className="btn btn-primary" onClick={() => advance("receipt")}>
                ✓ Yes, got it
              </button>
            </div>
          </div>
        )}

        {/* Seller's step 2: send the ticket, then mark it transferred. */}
        {confirmed && isSeller && (
          <div className="ticket confirm-card">
            <div className="confirm-card-kicker">Step 2 · Transfer ticket</div>
            <p className="small" style={{ margin: "0 0 12px" }}>
              Send the e-ticket to {first} in chat, then mark it transferred.
            </p>
            {swap.sellerMarkedTransferred ? (
              <div className="badge badge-trust confirm-offer-status">
                ✓ Marked as transferred
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => advance("transfer")}>
                ✓ Mark as transferred
              </button>
            )}
          </div>
        )}
      </div>

      <div className="chat-dock">
        {!confirmed && (
          <div className="chip-row chat-quick">
            <button className="chip" onClick={() => send("Still available?")}>
              Still available?
            </button>
            <button className="chip" onClick={() => send("Can you send proof?")}>
              Send proof
            </button>
          </div>
        )}

        <div className="nudge">
          <span aria-hidden>⚠</span> Only confirm once you have the ticket.
        </div>

        <div className="composer">
          <input
            className="input"
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(draft)}
            aria-label="Message"
          />
          <button
            className="icon-btn composer-send"
            aria-label="Send message"
            onClick={() => send(draft)}
          >
            ➤
          </button>
        </div>
      </div>

      <BottomNav active="messages" go={go} />
    </div>
  );
}
