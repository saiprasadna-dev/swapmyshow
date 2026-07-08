import { useCallback, useEffect, useState } from "react";
import { fetchMe, signOut, type AuthUser } from "./authClient";
import { fetchUnreadCount } from "./apiClient";
import { UnreadContext } from "./unread";
import SignUp from "./screens/SignUp";
import AddPhone from "./screens/AddPhone";
import Home from "./screens/Home";
import Search from "./screens/Search";
import ListingDetail from "./screens/Listing";
import PostTicket from "./screens/PostTicket";
import Messages from "./screens/Messages";
import Chat from "./screens/Chat";
import Confirmed from "./screens/Confirmed";
import Profile from "./screens/Profile";
import Rate from "./screens/Rate";

export type Screen =
  | { name: "signup" }
  | { name: "addphone" }
  | { name: "home" }
  | { name: "search" }
  | { name: "post"; editId?: number }
  | { name: "messages" }
  | { name: "profile" }
  | { name: "listing"; id: number }
  | { name: "chat"; swapId: number }
  | { name: "confirmed"; swapId: number }
  | { name: "rate"; swapId: number };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "signup" });
  const [user, setUser] = useState<AuthUser | null>(null);
  const go = (s: Screen) => setScreen(s);

  // After any sign-in, everyone must have a phone on file: send accounts
  // without one (e.g. Google sign-ups) to the one-time add-phone step.
  const afterAuth = (u: AuthUser) => {
    setUser(u);
    go(u.phone ? { name: "home" } : { name: "addphone" });
  };

  // restore an existing session on load (verified against the backend)
  useEffect(() => {
    let active = true;
    fetchMe().then((u) => {
      if (active && u) {
        setUser(u);
        setScreen((s) =>
          s.name === "signup"
            ? u.phone
              ? { name: "home" }
              : { name: "addphone" }
            : s
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = () => {
    signOut();
    setUser(null);
    setUnread(0);
    go({ name: "signup" });
  };

  // Keep the Messages unread badge fresh while signed in: refresh on every
  // screen change (so it clears right after you read a chat) and poll gently.
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(() => {
    fetchUnreadCount()
      .then(setUnread)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    refreshUnread();
    const timer = setInterval(refreshUnread, 15000);
    return () => clearInterval(timer);
  }, [user, screen, refreshUnread]);

  return (
    <UnreadContext.Provider value={unread}>
    <div className="phone">
      {screen.name === "signup" && (
        <SignUp onDone={() => go({ name: "home" })} onUser={afterAuth} />
      )}
      {screen.name === "addphone" && (
        <AddPhone
          onDone={(u) => {
            setUser(u);
            go({ name: "home" });
          }}
          onSignOut={handleSignOut}
        />
      )}
      {screen.name === "home" && <Home go={go} />}
      {screen.name === "search" && <Search go={go} />}
      {screen.name === "post" && <PostTicket go={go} editId={screen.editId} />}
      {screen.name === "messages" && <Messages go={go} />}
      {screen.name === "profile" && (
        <Profile go={go} user={user} onSignOut={handleSignOut} />
      )}
      {screen.name === "listing" && <ListingDetail id={screen.id} go={go} />}
      {screen.name === "chat" && (
        <Chat swapId={screen.swapId} user={user} go={go} />
      )}
      {screen.name === "confirmed" && (
        <Confirmed swapId={screen.swapId} go={go} />
      )}
      {screen.name === "rate" && <Rate swapId={screen.swapId} go={go} />}
    </div>
    </UnreadContext.Provider>
  );
}

export default App;
