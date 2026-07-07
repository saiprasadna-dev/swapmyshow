/* ---------------------------------------------------------------
   Auth client: talks to the SwapMyShow backend, which verifies the
   Google ID token and issues a session token. Nothing about the user
   is trusted from the browser — the backend is the source of truth.

   Env (see frontend/.env.example):
     VITE_GOOGLE_CLIENT_ID = xxxx.apps.googleusercontent.com
     VITE_API_URL          = https://swapmyshow-backend.<you>.workers.dev
---------------------------------------------------------------- */

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  picture: string | null;
  idVerified?: boolean;
  phoneVerified?: boolean;
  rating?: number;
  swaps?: number;
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;
export const API_URL = (
  import.meta.env.VITE_API_URL as string | undefined
)?.replace(/\/$/, "");

/** Google sign-in is only available when both the client id (for the
    popup) and the API url (for verification) are configured. */
export const authConfigured = Boolean(GOOGLE_CLIENT_ID && API_URL);

const TOKEN_KEY = "sms_session";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
const saveToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearSession = () => localStorage.removeItem(TOKEN_KEY);

/** Exchange a Google ID token for a verified session via the backend. */
export async function exchangeCredential(credential: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    throw new Error(`auth failed (${res.status})`);
  }
  const data = (await res.json()) as { token: string; user: AuthUser };
  saveToken(data.token);
  return data.user;
}

/** Restore a signed-in user from a stored session token, if still valid. */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token || !API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearSession();
      return null;
    }
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

/** Sign out locally and stop Google auto-select. */
export function signOut() {
  clearSession();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  } catch {
    /* ignore */
  }
}
