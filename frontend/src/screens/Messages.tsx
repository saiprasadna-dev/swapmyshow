import { useEffect, useState } from "react";
import { fetchConversations, ApiError, type ConversationView } from "../apiClient";
import { BottomNav } from "../components";
import type { Screen } from "../App";

/** Messages inbox: every chat the signed-in user is part of, whether they are
    buying (they opened the swap) or selling (a buyer messaged their listing).
    Tapping a row opens the same per-ticket chat for both sides. */
export default function Messages({ go }: { go: (s: Screen) => void }) {
  const [convos, setConvos] = useState<ConversationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchConversations()
      .then((c) => active && setConvos(c))
      .catch((e) => active && setError(e instanceof ApiError ? e.code : "load_failed"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="small muted">Your chats</div>
          <h2>Messages 💬</h2>
        </div>
      </header>

      <div className="stack">
        {convos.map((c) => (
          <button
            key={c.id}
            className="ticket listing-card"
            onClick={() => go({ name: "chat", swapId: c.id })}
          >
            <div className="avatar" aria-hidden>
              {(c.counterpartyName || "?")[0].toUpperCase()}
            </div>
            <div className="listing-body">
              <div className="row between" style={{ gap: 8 }}>
                <span className="listing-title">{c.counterpartyName || "Someone"}</span>
                <span className="badge badge-plain">
                  {c.role === "seller" ? "Selling" : "Buying"}
                </span>
              </div>
              <div className="listing-meta">{c.listing.title}</div>
              <div
                className="small"
                style={{
                  marginTop: 4,
                  color: c.lastMessage ? "var(--ink-2)" : "var(--muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.lastMessage ?? "New swap — say hello 👋"}
              </div>
            </div>
          </button>
        ))}

        {!loading && convos.length === 0 && (
          <div className="ticket" style={{ textAlign: "center", padding: 26 }}>
            <strong>{error ? "Couldn't load messages." : "No messages yet."}</strong>
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              When you start a swap — or a buyer messages one of your listings —
              the conversation shows up here.
            </p>
          </div>
        )}
      </div>

      <BottomNav active="messages" go={go} />
    </div>
  );
}
