import { useState } from "react";
import type { Category } from "../data";
import { createListing, ApiError } from "../apiClient";
import { BottomNav } from "../components";
import type { Screen } from "../App";

const cats: Category[] = ["Movies", "Concerts", "Sports", "Travel"];

export default function PostTicket({ go }: { go: (s: Screen) => void }) {
  const [cat, setCat] = useState<Category>("Movies");
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [seats, setSeats] = useState("");
  const [paid, setPaid] = useState("");
  const [ask, setAsk] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [posted, setPosted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = event && ask;

  // Turn the free-text date field into an ISO datetime. Falls back to a
  // near-future time so a quick "Tonight 9:30" still lands as a valid event.
  const toEventAt = (raw: string): string => {
    const parsed = raw ? Date.parse(raw) : NaN;
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return soon.toISOString();
  };

  const post = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const seatList = seats.split(/[,\s–-]+/).map((s) => s.trim()).filter(Boolean);
    try {
      const listing = await createListing({
        category: cat,
        title: event.trim(),
        venue: "",
        eventAt: toEventAt(date),
        seats: seatList,
        ticketCount: Math.max(1, seatList.length),
        paid: Number(paid.replace(/[^\d]/g, "")) || Number(ask.replace(/[^\d]/g, "")),
        ask: Number(ask.replace(/[^\d]/g, "")),
        hasScreenshot: uploaded,
      });
      setPosted(listing.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "post_failed");
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <header className="top">
        <h2>Post a ticket</h2>
      </header>

      <div className="chip-row" aria-label="Category">
        {cats.map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? "on-purple" : ""}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="event">Event</label>
          <input
            id="event"
            placeholder="Dune: Part Two — PVR Nexus"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="date">Date</label>
            <input
              id="date"
              placeholder="Tonight 9:30"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="seats">Seats</label>
            <input
              id="seats"
              placeholder="G12–G13"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </div>
        </div>

        <button
          className="upload"
          onClick={() => setUploaded(true)}
          style={uploaded ? { background: "var(--trust-bg)", color: "var(--trust)", borderColor: "rgba(14,159,110,.4)" } : undefined}
        >
          {uploaded ? "✓ Ticket screenshot added" : "＋ Upload ticket screenshot"}
        </button>

        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="paid">Paid</label>
            <input
              id="paid"
              inputMode="numeric"
              placeholder="₹320"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="ask" style={{ color: "var(--purple)" }}>
              Your ask
            </label>
            <input
              id="ask"
              inputMode="numeric"
              placeholder="₹180"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              style={{ borderColor: "var(--purple-border)", background: "var(--purple-soft)" }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 18 }}>
        {posted !== null ? (
          <div className="ticket" style={{ textAlign: "center", background: "var(--trust-bg)", borderColor: "rgba(14,159,110,.3)" }}>
            <strong style={{ color: "var(--trust)" }}>✓ Listing posted</strong>
            <p className="small muted" style={{ margin: "4px 0 10px" }}>
              Buyers nearby can now chat with you.
            </p>
            <button
              className="btn btn-outline btn-small"
              style={{ margin: "0 auto" }}
              onClick={() => go({ name: "listing", id: posted })}
            >
              View listing
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="small" style={{ color: "var(--danger, #c0392b)", textAlign: "center", marginBottom: 8 }}>
                Couldn't post — check the details and try again.
              </p>
            )}
            <button
              className="btn btn-primary"
              disabled={!ready || busy}
              style={!ready || busy ? { opacity: 0.5 } : undefined}
              onClick={post}
            >
              {busy ? "Posting…" : "Post listing"}
            </button>
          </>
        )}
      </div>

      <BottomNav active="post" go={go} />
    </div>
  );
}
