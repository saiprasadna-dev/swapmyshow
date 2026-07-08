import { useEffect, useState } from "react";
import { type Category, type Listing, inr } from "../data";
import { fetchListings, ApiError } from "../apiClient";
import { BottomNav, TicketCard } from "../components";
import type { Screen } from "../App";

const cats: ("All" | Category)[] = ["All", "Movies", "Concerts", "Sports", "Events"];

export default function Home({ go }: { go: (s: Screen) => void }) {
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [all, setAll] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchListings()
      .then((ls) => active && setAll(ls))
      .catch((e) =>
        active && setError(e instanceof ApiError ? e.code : "load_failed")
      );
    return () => {
      active = false;
    };
  }, []);

  // Discovery: a "going soon" highlight strip, then the full browse-all feed
  // (filtered only by category). Time filtering lives on Search.
  const soon = all.filter((l) => l.timeBucket === "tonight");
  const feed = all.filter((l) => cat === "All" || l.category === cat);

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="small muted">Swaps near you</div>
          <h2>
            Going soon <span aria-hidden>🔥</span>
          </h2>
        </div>
        <button className="icon-btn" aria-label="Search" onClick={() => go({ name: "search" })}>
          ⌕
        </button>
      </header>

      {soon.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 2 }}>
            ⚡ Tonight&apos;s deals
          </div>
          <div className="h-scroll">
            {soon.map((l) => (
              <button
                key={l.id}
                className="hcard"
                onClick={() => go({ name: "listing", id: l.id })}
              >
                <div className={`hcard-poster poster-cat-${l.category.toLowerCase()}`} aria-hidden>
                  {l.screenshotUrl ? <img src={l.screenshotUrl} alt="" /> : l.emoji}
                </div>
                <div className="hcard-title">{l.title}</div>
                <div className="hcard-meta">{l.venue || "Venue TBA"}</div>
                <div className="row between" style={{ marginTop: 6 }}>
                  <span className="price" style={{ fontSize: 15 }}>{inr(l.price)}</span>
                  {l.countdown && <span className="badge badge-urgent">⏳ {l.countdown}</span>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Browse all</div>
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

      <div className="stack" style={{ marginTop: 14 }}>
        {feed.map((l) => (
          <TicketCard
            key={l.id}
            listing={l}
            onOpen={() => go({ name: "listing", id: l.id })}
          />
        ))}
        {feed.length === 0 && (
          <div className="ticket" style={{ textAlign: "center", padding: 26 }}>
            <strong>
              {error
                ? "Couldn't load listings."
                : cat === "All"
                  ? "No swaps yet."
                  : `No ${cat.toLowerCase()} swaps yet.`}
            </strong>
            <p className="small muted" style={{ margin: "6px 0 12px" }}>
              Have a ticket you can't use? List it in under a minute.
            </p>
            <button
              className="btn btn-outline btn-small"
              style={{ margin: "0 auto" }}
              onClick={() => go({ name: "post" })}
            >
              List your ticket
            </button>
          </div>
        )}
      </div>

      <BottomNav active="home" go={go} />
    </div>
  );
}
