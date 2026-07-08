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
      <div className="screen">
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

  return (
    <div className="screen">
      <header className="top" style={{ marginBottom: 10 }}>
        <button className="icon-btn back" aria-label="Back" onClick={() => go({ name: "messages" })}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 6 }}>
            <h3>{otherName}</h3>
            {otherVerified && <Verified />}
          </div>
          <div className="small muted">
            {isSeller ? "Buyer" : "Seller"} · this swap
          </div>
        </div>
      </header>

      {/* Persistent ticket summary so it's clear which ticket this chat is about. */}
      <button
        className="ticket listing-card"
        style={{ marginBottom: 12 }}
        onClick={() => go({ name: "listing", id: l.id })}
      >
        <div className={`poster poster-cat-${l.category.toLowerCase()}`} style={{ width: 48, height: 48, fontSize: 22 }} aria-hidden>
          {l.emoji}
        </div>
        <div className="listing-body">
          <div className="listing-title">{l.title}</div>
          <div className="listing-meta">
            {[l.venue || "Venue TBA", l.when].join(" · ")}
            {l.seats.length > 0 && (
              <>
                {" · "}
                <span className="seat-code">{l.seats.join("–")}</span>
              </>
            )}
          </div>
        </div>
        <div className="listing-price">
          <div className="price" style={{ fontSize: 16 }}>{inr(total)}</div>
          <div className="small muted">agreed</div>
        </div>
      </button>

      <SwapTracker step={trackerStep(swap.step)} />

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.senderId === user?.id ? "me" : "them"}`}>
            {m.body}
          </div>
        ))}

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

          {/* Negotiate the price before confirming. */}
          {swap.step === "agree" && (
            <div style={{ margin: "0 0 10px" }}>
              {swap.offerPrice != null ? (
                swap.offerBy === user?.id ? (
                  <div className="badge badge-plain" style={{ width: "100%", justifyContent: "center", padding: "8px 0" }}>
                    You offered {inr(swap.offerPrice)} · waiting for {first}
                  </div>
                ) : (
                  <button
                    className="btn btn-outline btn-small"
                    style={{ width: "100%" }}
                    onClick={accept}
                  >
                    ✓ Accept {first}'s offer of {inr(swap.offerPrice)}
                  </button>
                )
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="Offer a price"
                    value={offerDraft}
                    onChange={(e) => setOfferDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitOffer()}
                    style={{ flex: 1 }}
                    aria-label="Offer a price"
                  />
                  <button
                    className="btn btn-ghost btn-small"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={submitOffer}
                  >
                    💰 Offer
                  </button>
                </div>
              )}
            </div>
          )}

          {!confirmed ? (
            <button className="btn btn-primary" onClick={() => advance("confirm")}>
              ✓ Confirm swap
            </button>
          ) : (
            <div className="badge badge-trust" style={{ width: "100%", justifyContent: "center", padding: "8px 0" }}>
              ✓ Swap confirmed — waiting on transfer
            </div>
          )}
        </div>

        {/* Buyer's step 2: confirm they received the ticket. */}
        {confirmed && !isSeller && (
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
                onClick={() => advance("receipt")}
              >
                ✓ Yes, got it
              </button>
              <button className="btn btn-ghost btn-small" style={{ flex: 1 }}>
                Not yet
              </button>
            </div>
          </div>
        )}

        {/* Seller's step 2: send the ticket, then mark it transferred. */}
        {confirmed && isSeller && (
          <div className="ticket" style={{ alignSelf: "stretch" }}>
            <div className="small muted" style={{ fontWeight: 700, letterSpacing: ".04em" }}>
              STEP 2 · TRANSFER TICKET
            </div>
            <p className="small" style={{ margin: "4px 0 10px" }}>
              Send the e-ticket to {first} in chat, then mark it transferred.
            </p>
            {swap.sellerMarkedTransferred ? (
              <div className="badge badge-trust" style={{ width: "100%", justifyContent: "center", padding: "8px 0" }}>
                ✓ Marked as transferred
              </div>
            ) : (
              <button
                className="btn btn-primary btn-small"
                style={{ width: "100%" }}
                onClick={() => advance("transfer")}
              >
                ✓ Mark as transferred
              </button>
            )}
          </div>
        )}

        {!confirmed && (
          <div className="row" style={{ gap: 8 }}>
            <button className="chip" onClick={() => send("Still available?")}>
              Still available?
            </button>
            <button className="chip" onClick={() => send("Can you send proof?")}>
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
          onKeyDown={(e) => e.key === "Enter" && send(draft)}
          aria-label="Message"
          style={{ borderRadius: 999, flex: 1 }}
        />
        <button
          className="icon-btn"
          style={{ background: "var(--purple)", color: "#fff", border: "none" }}
          aria-label="Send message"
          onClick={() => send(draft)}
        >
          ➤
        </button>
      </div>

      <BottomNav active="messages" go={go} />
    </div>
  );
}
