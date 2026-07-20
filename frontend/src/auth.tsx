import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  GOOGLE_CLIENT_ID,
  authConfigured,
  exchangeCredential,
  type AuthUser,
} from "./authClient";

/* ---------------------------------------------------------------
   Google Sign-In button (Google Identity Services). The browser only
   obtains a Google ID token; verification and session issuance happen
   on the backend (see authClient.ts).
---------------------------------------------------------------- */

const GIS_SRC = "https://accounts.google.com/gsi/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

let gisPromise: Promise<void> | null = null;
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

/** Renders Google's official "Sign in with Google" button. On success the
    chosen account's ID token is verified by the backend and the resulting
    signed-in user is handed to `onUser`. */
export function GoogleSignInButton({
  onUser,
}: {
  onUser: (u: AuthUser) => void;
}) {
  // Google Identity Services doesn't work inside the Capacitor WebView (the
  // Android app) — hide the button there; email + password is the app's
  // sign-in. A native Google-auth plugin is a documented follow-up.
  const isNative = Capacitor.isNativePlatform();
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "unconfigured" | "verifying" | "error"
  >(authConfigured ? "loading" : "unconfigured");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!authConfigured || isNative) return;
    let cancelled = false;

    const handleCredential = async (resp: { credential?: string }) => {
      if (!resp.credential) return;
      setStatus("verifying");
      try {
        const user = await exchangeCredential(resp.credential);
        if (!cancelled) onUser(user);
      } catch {
        if (!cancelled) {
          setMessage("We couldn't verify that sign-in. Please try again.");
          setStatus("error");
        }
      }
    };

    loadGis()
      .then(() => {
        if (cancelled || !holder.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
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
      .catch(() => {
        if (!cancelled) {
          setMessage("Couldn't load Google sign-in. Check your connection.");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onUser, isNative]);

  if (isNative) return null;

  if (status === "unconfigured") {
    return (
      <div className="google-hint">
        <strong>Google sign-in isn't configured yet.</strong>
        <span>
          Set <code>VITE_GOOGLE_CLIENT_ID</code> and <code>VITE_API_URL</code> to
          enable the verified Google account picker.
        </span>
      </div>
    );
  }

  return (
    <div className="google-btn-wrap">
      <div
        ref={holder}
        style={{ display: status === "verifying" ? "none" : undefined }}
      />
      {status === "loading" && <span className="small muted">Loading Google…</span>}
      {status === "verifying" && (
        <span className="small muted">Signing you in…</span>
      )}
      {status === "error" && (
        <span className="small" style={{ color: "var(--danger)" }}>
          {message}
        </span>
      )}
    </div>
  );
}
