import { useState } from "react";
import { listings, myListings } from "./data";
import type { GoogleUser } from "./auth";
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
  | { name: "listing"; id: string }
  | { name: "chat"; id: string }
  | { name: "confirmed"; id: string }
  | { name: "rate"; id: string };

const all = [...listings, ...myListings];
const byId = (id: string) => all.find((l) => l.id === id) ?? listings[0];

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "signup" });
  const [user, setUser] = useState<GoogleUser | null>(null);
  const go = (s: Screen) => setScreen(s);

  return (
    <div className="phone">
      {screen.name === "signup" && (
        <SignUp
          onDone={() => go({ name: "home" })}
          onGoogle={(u) => {
            setUser(u);
            go({ name: "home" });
          }}
        />
      )}
      {screen.name === "home" && <Home go={go} />}
      {screen.name === "search" && <Search go={go} />}
      {screen.name === "post" && <PostTicket go={go} />}
      {screen.name === "profile" && <Profile go={go} user={user} />}
      {screen.name === "listing" && (
        <ListingDetail listing={byId(screen.id)} go={go} />
      )}
      {screen.name === "chat" && <Chat listing={byId(screen.id)} go={go} />}
      {screen.name === "confirmed" && (
        <Confirmed listing={byId(screen.id)} go={go} />
      )}
      {screen.name === "rate" && <Rate listing={byId(screen.id)} go={go} />}
    </div>
  );
}

export default App;
