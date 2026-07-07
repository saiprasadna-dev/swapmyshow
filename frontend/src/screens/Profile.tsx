import { useEffect, useState } from "react";
import type { Listing } from "../data";
import {
  fetchMyListings,
  fetchSavedListings,
  fetchMySwaps,
  type SwapView,
} from "../apiClient";
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
  const [selling, setSelling] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Listing[]>([]);
  const [bought, setBought] = useState<SwapView[]>([]);

  useEffect(() => {
    let active = true;
    fetchMyListings().then((l) => active && setSelling(l)).catch(() => {});
    fetchSavedListings().then((l) => active && setSaved(l)).catch(() => {});
    fetchMySwaps().then((s) => active && setBought(s)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const name = user?.name ?? "You";
  const rating = user?.rating ?? 0;
  const swaps = user?.swaps ?? 0;

  // Highest-trust badge the account has earned.
  const trustBadge = !user ? null : user.idVerified ? (
    <Verified label="ID verified" />
  ) : user.emailVerified ? (
    <Verified label="Email verified" />
  ) : user.phoneVerified ? (
    <Verified label="Phone verified" />
  ) : null;

  // The most recent completed swap the user can rate, if any.
  const recentSwap = bought.find((s) => s.step === "done") ?? bought[0];

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
          {trustBadge}
        </div>
        {user?.email && (
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            {user.email}
          </p>
        )}
        <p className="small muted" style={{ margin: "2px 0 0" }}>
          ★ {rating.toFixed(1)} · {swaps} {swaps === 1 ? "swap" : "swaps"}
        </p>
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
        {tab === "Selling" &&
          selling.map((l) => (
            <TicketCard
              key={l.id}
              listing={l}
              onOpen={
                l.status === "sold" ? undefined : () => go({ name: "listing", id: l.id })
              }
            />
          ))}
        {tab === "Bought" &&
          bought.map((s) => (
            <TicketCard
              key={s.id}
              listing={s.listing}
              onOpen={() => go({ name: "chat", swapId: s.id })}
            />
          ))}
        {tab === "Saved" &&
          saved.map((l) => (
            <TicketCard
              key={l.id}
              listing={l}
              onOpen={() => go({ name: "listing", id: l.id })}
            />
          ))}
        {((tab === "Selling" && selling.length === 0) ||
          (tab === "Bought" && bought.length === 0) ||
          (tab === "Saved" && saved.length === 0)) && (
          <p className="small muted" style={{ textAlign: "center", padding: 20 }}>
            Nothing here yet.
          </p>
        )}
      </div>

      {recentSwap && (
        <button
          className="ticket row"
          style={{
            marginTop: 12,
            background: "var(--purple-soft)",
            borderColor: "var(--purple-border)",
          }}
          onClick={() => go({ name: "rate", swapId: recentSwap.id })}
        >
          <span aria-hidden>⭐</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Rate your recent swaps
          </span>
          <span style={{ marginLeft: "auto" }} aria-hidden>
            →
          </span>
        </button>
      )}

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
