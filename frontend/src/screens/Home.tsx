import { useEffect, useState } from "react";
import { type Category, type Listing } from "../data";
import { fetchListings, ApiError } from "../apiClient";
import { BottomNav, TicketCard } from "../components";
import type { Screen } from "../App";

const cats: ("All" | Category)[] = ["All", "Movies", "Concerts", "Sports", "Events"];
const timeTabs = [
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "Weekend" },
] as const;

export default function Home({ go }: { go: (s: Screen) => void }) {
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [when, setWhen] = useState<(typeof timeTabs)[number]["id"]>("tonight");
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

  const feed = all.filter(
    (l) => l.timeBucket === when && (cat === "All" || l.category === cat)
  );
  const soon = all.filter((l) => l.timeBucket === "tonight").length;

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="small muted">Tonight in</div>
          <h2>
            Going soon <span aria-hidden>🔥</span>
          </h2>
        </div>
        <button className="icon-btn" aria-label="Search" onClick={() => go({ name: "search" })}>
          ⌕
        </button>
      </header>

      <div className="chip-row" role="tablist" aria-label="When">
        {timeTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={when === t.id}
            className={`chip ${when === t.id ? "on" : ""}`}
            onClick={() => setWhen(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {when === "tonight" && soon > 0 && (
        <button
          className="banner-urgent"
          style={{ margin: "12px 0 0" }}
          onClick={() => setCat("All")}
        >
          <span aria-hidden>⚡</span> {soon} swaps going in the next 2 hrs — grab a
          last-min deal
        </button>
      )}

      <div className="chip-row" style={{ marginTop: 12 }} aria-label="Category">
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

      <div className="stack" style={{ marginTop: 16 }}>
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
                : `No ${cat.toLowerCase()} swaps ${when} yet.`}
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
