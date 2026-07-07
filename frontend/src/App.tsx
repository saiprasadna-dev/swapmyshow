import { useEffect, useState } from "react";
import { fetchMe, signOut, type AuthUser } from "./authClient";
import SignUp from "./screens/SignUp";
import Home from "./screens/Home";
import Search from "./screens/Search";
import ListingDetail from "./screens/Listing";
import PostTicket from "./screens/PostTicket";
import Chat from "./screens/Chat";
import Confirmed from "./screens/Confirmed";
import Profile from "./screens/Profile";
import Rate from "./screens/Rate";

export type Screen =
  | { name: "signup" }
  | { name: "home" }
  | { name: "search" }
  | { name: "post" }
  | { name: "profile" }
  | { name: "listing"; id: number }
  | { name: "chat"; swapId: number }
  | { name: "confirmed"; swapId: number }
  | { name: "rate"; swapId: number };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "signup" });
  const [user, setUser] = useState<AuthUser | null>(null);
  const go = (s: Screen) => setScreen(s);

  // restore an existing session on load (verified against the backend)
  useEffect(() => {
    let active = true;
    fetchMe().then((u) => {
      if (active && u) {
        setUser(u);
        setScreen((s) => (s.name === "signup" ? { name: "home" } : s));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = () => {
    signOut();
    setUser(null);
    go({ name: "signup" });
  };

  return (
    <div className="phone">
      {screen.name === "signup" && (
        <SignUp
          onDone={() => go({ name: "home" })}
          onUser={(u) => {
            setUser(u);
            go({ name: "home" });
          }}
        />
      )}
      {screen.name === "home" && <Home go={go} />}
      {screen.name === "search" && <Search go={go} />}
      {screen.name === "post" && <PostTicket go={go} />}
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
  );
}

export default App;
