import { useEffect, useState } from "react";
import type { Category } from "../data";
import {
  createListing,
  updateListing,
  fetchListing,
  uploadImage,
  ApiError,
} from "../apiClient";
import { BottomNav } from "../components";
import type { Screen } from "../App";

const cats: Category[] = ["Movies", "Concerts", "Sports", "Events", "Travel"];

/** ISO datetime → the value a <input type="datetime-local"> expects
    ("YYYY-MM-DDTHH:mm" in local time). Empty string if unparseable. */
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

export default function PostTicket({
  go,
  editId,
}: {
  go: (s: Screen) => void;
  editId?: number;
}) {
  const editing = typeof editId === "number";
  const [cat, setCat] = useState<Category>("Movies");
  const [event, setEvent] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [when, setWhen] = useState(""); // datetime-local string
  const [seats, setSeats] = useState("");
  const [paid, setPaid] = useState("");
  const [ask, setAsk] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posted, setPosted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState<string | null>(null);

  // Edit mode: load the existing listing and prefill the form.
  useEffect(() => {
    if (!editing) return;
    let active = true;
    fetchListing(editId)
      .then((l) => {
        if (!active) return;
        setCat(l.category);
        setEvent(l.title);
        setVenue(l.venue ?? "");
        setCity(l.city ?? "");
        setWhen(toLocalInput(l.eventAt));
        setSeats(l.seats.join(", "));
        setPaid(String(l.paid));
        setAsk(String(l.price));
        setScreenshotUrl(l.screenshotUrl ?? "");
      })
      .catch(() => active && setError("load_failed"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [editing, editId]);

  const whenValid = when !== "" && !Number.isNaN(new Date(when).getTime());
  const ready = event.trim() !== "" && ask !== "" && whenValid;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setScreenshotUrl(await uploadImage(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "upload_failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const seatList = seats.split(/[,\s–-]+/).map((s) => s.trim()).filter(Boolean);
    const payload = {
      category: cat,
      title: event.trim(),
      venue: venue.trim(),
      city: city.trim() || undefined,
      eventAt: new Date(when).toISOString(),
      seats: seatList,
      ticketCount: Math.max(1, seatList.length),
      paid: Number(paid.replace(/[^\d]/g, "")) || Number(ask.replace(/[^\d]/g, "")),
      ask: Number(ask.replace(/[^\d]/g, "")),
      hasScreenshot: Boolean(screenshotUrl),
      screenshotUrl: screenshotUrl || undefined,
    };
    try {
      const listing = editing
        ? await updateListing(editId, payload)
        : await createListing(payload);
      setPosted(listing.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "post_failed");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="screen">
        <header className="top">
          <h2>Edit listing</h2>
        </header>
        <p className="small muted" style={{ textAlign: "center", marginTop: 40 }}>
          Loading…
        </p>
        <BottomNav active="post" go={go} />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="top">
        <h2>{editing ? "Edit listing" : "Post a ticket"}</h2>
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
            placeholder="Dune: Part Two"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="venue">Venue</label>
          <input
            id="venue"
            placeholder="PVR Nexus, Koramangala"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="city">City</label>
            <input
              id="city"
              placeholder="Bengaluru"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="seats">Seats</label>
            <input
              id="seats"
              placeholder="G12, G13"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="when">Date &amp; time</label>
          <input
            id="when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>

        <label
          className="upload"
          style={{
            display: "block",
            textAlign: "center",
            cursor: "pointer",
            ...(screenshotUrl
              ? { background: "var(--trust-bg)", color: "var(--trust)", borderColor: "var(--brand-border)" }
              : {}),
          }}
        >
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
          {uploading
            ? "Uploading…"
            : screenshotUrl
              ? "✓ Ticket screenshot added — tap to replace"
              : "＋ Upload ticket screenshot"}
        </label>
        {screenshotUrl && (
          <div style={{ marginTop: 10 }}>
            <img
              src={screenshotUrl}
              alt="Ticket screenshot"
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}
            />
          </div>
        )}

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
          <div className="ticket" style={{ textAlign: "center", background: "var(--trust-bg)", borderColor: "var(--brand-border)" }}>
            <strong style={{ color: "var(--trust)" }}>
              {editing ? "✓ Listing updated" : "✓ Listing posted"}
            </strong>
            <p className="small muted" style={{ margin: "4px 0 10px" }}>
              {editing
                ? "Your changes are live."
                : "Buyers nearby can now chat with you."}
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
                {error === "not_editable"
                  ? "This listing can no longer be edited."
                  : "Couldn't save — check the details and try again."}
              </p>
            )}
            <button
              className="btn btn-primary"
              disabled={!ready || busy}
              style={!ready || busy ? { opacity: 0.5 } : undefined}
              onClick={submit}
            >
              {busy
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Post listing"}
            </button>
          </>
        )}
      </div>

      <BottomNav active="post" go={go} />
    </div>
  );
}
