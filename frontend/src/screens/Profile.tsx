import { useState } from "react";
import { me, myListings, listings } from "../data";
import { BottomNav, TicketCard, Verified } from "../components";
import type { Screen } from "../App";
import type { AuthUser } from "../authClient";

const tabs = ["Selling", "Bought", "Saved"] as const;

export default function Profile({
  go,
  user,
  onSignOut,
}: {
  go: (s: Screen) => void;
  user?: AuthUser | null;
  onSignOut?: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Selling");

  const name = user?.name ?? me.name;

  const items =
    tab === "Selling"
      ? myListings
      : tab === "Bought"
      ? [listings[0]]
      : [listings[4]];

  return (
    <div className="screen">
      <div style={{ textAlign: "center", marginTop: 8 }}>
        {user?.picture ? (
          <img
            className="avatar avatar-lg"
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
            style={{ margin: "0 auto 10px", objectFit: "cover" }}
          />
        ) : (
          <div className="avatar avatar-lg" style={{ margin: "0 auto 10px" }}>
            {name[0]}
          </div>
        )}
        <div className="row" style={{ justifyContent: "center", gap: 6 }}>
          <h2>{name}</h2>
          <Verified />
        </div>
        {user?.email ? (
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            {user.email}
          </p>
        ) : (
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            ★★★★★ {me.rating.toFixed(1)} · {me.swaps} swaps
          </p>
        )}
      </div>

      <div className="tab-row" role="tablist" aria-label="My tickets">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`chip ${tab === t ? "on" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="stack">
        {items.map((l) => (
          <TicketCard
            key={l.id}
            listing={l}
            onOpen={
              l.status === "sold" ? undefined : () => go({ name: "listing", id: l.id })
            }
          />
        ))}
      </div>

      <button
        className="ticket row"
        style={{
          marginTop: 12,
          background: "var(--purple-soft)",
          borderColor: "var(--purple-border)",
        }}
        onClick={() => go({ name: "rate", id: "dune" })}
      >
        <span aria-hidden>⭐</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Rate your recent swaps
        </span>
        <span style={{ marginLeft: "auto" }} aria-hidden>
          →
        </span>
      </button>

      {user && onSignOut && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={onSignOut}
        >
          Sign out
        </button>
      )}

      <BottomNav active="profile" go={go} />
    </div>
  );
}
