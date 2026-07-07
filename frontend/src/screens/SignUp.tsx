import { useState } from "react";
import { Verified } from "../components";
import { GoogleSignInButton } from "../auth";
import type { AuthUser } from "../authClient";

export default function SignUp({
  onDone,
  onGoogle,
}: {
  onDone: () => void;
  onGoogle: (user: AuthUser) => void;
}) {
  const [phone, setPhone] = useState("");
  return (
    <div className="screen no-nav" style={{ justifyContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div
          className="avatar avatar-lg"
          style={{
            margin: "0 auto 14px",
            background: "var(--purple)",
            color: "#fff",
            borderRadius: 22,
          }}
        >
          S
        </div>
        <h1>SwapMyShow</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Last-minute tickets. Save money.
        </p>
      </div>

      <div className="ticket" style={{ padding: 18 }}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="phone">Phone or email</label>
          <input
            id="phone"
            inputMode="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={onDone}>
          Continue
        </button>

        <hr className="tear" />

        {/* real Google account picker → signs in with the chosen Gmail */}
        <div className="row" style={{ justifyContent: "center" }}>
          <GoogleSignInButton onUser={onGoogle} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <Verified label="Verified members only" />
      </div>
    </div>
  );
}
