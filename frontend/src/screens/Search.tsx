import { useEffect, useMemo, useState } from "react";
import { type Category, type Listing } from "../data";
import { fetchListings } from "../apiClient";
import { BottomNav, TicketCard } from "../components";
import type { Screen } from "../App";

const cats: Category[] = ["Movies", "Concerts", "Sports", "Events", "Travel"];
const whens = ["Tonight", "This week", "Any"] as const;

export default function Search({ go }: { go: (s: Screen) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [when, setWhen] = useState<(typeof whens)[number]>("Tonight");
  const [maxPrice, setMaxPrice] = useState(1500);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [all, setAll] = useState<Listing[]>([]);

  useEffect(() => {
    let active = true;
    fetchListings()
      .then((ls) => active && setAll(ls))
      .catch(() => active && setAll([]));
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(
    () =>
      all.filter((l) => {
        if (q && !l.title.toLowerCase().includes(q.toLowerCase())) return false;
        if (cat && l.category !== cat) return false;
        if (when === "Tonight" && l.timeBucket !== "tonight") return false;
        if (when === "This week" && l.timeBucket === "weekend") return false;
        if (l.price > maxPrice) return false;
        if (verifiedOnly && !l.seller.verified) return false;
        return true;
      }),
    [all, q, cat, when, maxPrice, verifiedOnly]
  );

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="small muted">Find a ticket</div>
          <h2>Search</h2>
        </div>
      </header>

      <div className="search-bar">
        <span aria-hidden>⌕</span>
        <input
          placeholder="Search events, venues…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShowResults(true);
          }}
          aria-label="Search events and venues"
        />
      </div>

      <div className="search-filters">
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Category
          </div>
          <div className="chip-row">
            {cats.map((c) => (
              <button
                key={c}
                className={`chip ${cat === c ? "on" : ""}`}
                onClick={() => setCat(cat === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            When
          </div>
          <div className="chip-row">
            {whens.map((w) => (
              <button
                key={w}
                className={`chip ${when === w ? "on-purple" : ""}`}
                onClick={() => setWhen(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="small muted">Max price</span>
            <span className="price">₹{maxPrice}</span>
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            aria-label="Maximum price"
          />
        </div>

        <button
          className="ticket row between"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          aria-pressed={verifiedOnly}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            ✓ Verified sellers only
          </span>
          <span className={`toggle ${verifiedOnly ? "on" : ""}`} />
        </button>
      </div>

      {showResults && (
        <>
          <div className="section-label">
            {results.length} result{results.length === 1 ? "" : "s"}
          </div>
          <div className="listing-grid">
            {results.map((l) => (
              <TicketCard
                key={l.id}
                listing={l}
                onOpen={() => go({ name: "listing", id: l.id })}
              />
            ))}
          </div>
          {results.length === 0 && (
            <p className="small muted" style={{ textAlign: "center" }}>
              Nothing matches these filters — raise the max price or switch
              &quot;When&quot; to Any.
            </p>
          )}
        </>
      )}

      {!showResults && (
        <div style={{ marginTop: "auto", paddingTop: 18 }}>
          <button className="btn btn-primary" onClick={() => setShowResults(true)}>
            Show {results.length} results
          </button>
        </div>
      )}

      <BottomNav active="search" go={go} />
    </div>
  );
}
