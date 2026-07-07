import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------
   Google Sign-In via Google Identity Services (GIS).
   The client id comes from an env var so no secret is hard-coded:
     frontend/.env.local  ->  VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   Create one at https://console.cloud.google.com/apis/credentials
   (OAuth client, type "Web application") and add your site's origin
   (e.g. https://swapmyshow.pages.dev and http://localhost:5173) to
   the "Authorized JavaScript origins" list.
---------------------------------------------------------------- */

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
  sub: string; // stable Google account id
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

const GIS_SRC = "https://accounts.google.com/gsi/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

/** Decode the payload of a Google ID token (JWT) — no verification,
    just to read the signed-in user's profile client-side. */
function decodeIdToken(token: string): GoogleUser | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const p = JSON.parse(json);
    if (!p.email) return null;
    return { name: p.name ?? p.email, email: p.email, picture: p.picture, sub: p.sub };
  } catch {
    return null;
  }
}

let gisPromise: Promise<void> | null = null;
/** Load the GIS script once. */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis load")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis load"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Renders Google's official "Sign in with Google" button. On success
    it hands the signed-in user (with their real Gmail) back to `onUser`. */
export function GoogleSignInButton({
  onUser,
}: {
  onUser: (u: GoogleUser) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unconfigured" | "error">(
    GOOGLE_CLIENT_ID ? "loading" : "unconfigured"
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !holder.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: { credential?: string }) => {
            const user = resp.credential ? decodeIdToken(resp.credential) : null;
            if (user) onUser(user);
          },
        });
        holder.current.replaceChildren();
        window.google.accounts.id.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
          width: 300,
        });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
    };
  }, [onUser]);

  if (status === "unconfigured") {
    return (
      <div className="google-hint">
        <strong>Google sign-in isn't configured yet.</strong>
        <span>
          Add your OAuth client id as <code>VITE_GOOGLE_CLIENT_ID</code> to enable
          the Google account picker.
        </span>
      </div>
    );
  }

  return (
    <div className="google-btn-wrap">
      <div ref={holder} />
      {status === "loading" && <span className="small muted">Loading Google…</span>}
      {status === "error" && (
        <span className="small" style={{ color: "var(--danger)" }}>
          Couldn't load Google sign-in. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
