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
  phone?: string | null;
  picture: string | null;
  idVerified?: boolean;
  emailVerified?: boolean;
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

/** Email OTP only needs the backend URL (no Google client id). */
export const apiConfigured = Boolean(API_URL);

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

/* ---------------------------------------------------------------
   Passwordless email OTP: request a code, then verify it. Both calls
   double as sign-up and sign-in — the backend creates the account on a
   first-time email and logs in a returning one.
---------------------------------------------------------------- */

/** Thrown by the OTP calls. `code` is the backend's machine-readable
    reason (e.g. "invalid_code", "otp_cooldown") for the UI to map. */
export class OtpError extends Error {
  code: string;
  status: number;
  retryAfterSeconds?: number;
  constructor(code: string, status: number, retryAfterSeconds?: number) {
    super(code);
    this.name = "OtpError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Email + password sign-in (no OTP). Stores the session and returns the user
    on success. A wrong email/password surfaces as `invalid_credentials`. */
export async function login(email: string, password: string): Promise<AuthUser> {
  if (!API_URL) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok || !data.token || !data.user) {
    throw new OtpError(data.error ?? "invalid_credentials", res.status);
  }
  saveToken(data.token);
  return data.user;
}

/* ---------------------------------------------------------------
   Forgot password: email a reset code, then set a new password with it.
   The request call always succeeds for a well-formed email (it never
   reveals whether the account exists); a dev backend returns debugCode.
---------------------------------------------------------------- */

export async function requestPasswordReset(
  email: string
): Promise<{ debugCode?: string }> {
  if (!API_URL) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    debugCode?: string;
    error?: string;
    retryAfterSeconds?: number;
  };
  if (!res.ok) {
    throw new OtpError(
      data.error ?? "request_failed",
      res.status,
      data.retryAfterSeconds
    );
  }
  return { debugCode: data.debugCode };
}

/** Verify the reset code and set a new password; signs the user in on success. */
export async function resetPassword(
  email: string,
  code: string,
  password: string
): Promise<AuthUser> {
  if (!API_URL) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok || !data.token || !data.user) {
    throw new OtpError(data.error ?? "reset_failed", res.status);
  }
  saveToken(data.token);
  return data.user;
}

/* ---------------------------------------------------------------
   Registration (one-time). Sign-up collects name + email + phone +
   password and sends a code to the email only (the phone is stored, not
   verified). After sign-up, all sign-ins use email + password (`login`).
   The backend rejects an already-registered email or phone.
---------------------------------------------------------------- */

export interface SignupInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/** Ask the backend to email a sign-up code, after checking the email and
    phone aren't already registered. Returns a dev debugCode when no mailer. */
export async function requestSignupOtp(
  input: SignupInput
): Promise<{ debugCode?: string }> {
  if (!API_URL) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, mode: "signup" }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    debugCode?: string;
    error?: string;
    retryAfterSeconds?: number;
  };
  if (!res.ok) {
    throw new OtpError(
      data.error ?? "request_failed",
      res.status,
      data.retryAfterSeconds
    );
  }
  return { debugCode: data.debugCode };
}

/** Verify a sign-up code and create the account (name + email + phone). */
export async function verifySignupOtp(
  input: SignupInput,
  code: string
): Promise<AuthUser> {
  if (!API_URL) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, code, mode: "signup" }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok || !data.token || !data.user) {
    throw new OtpError(data.error ?? "verify_failed", res.status);
  }
  saveToken(data.token);
  return data.user;
}

/** Attach a phone number to the signed-in account (one-time). Used after a
    Google sign-up, which has no phone. */
export async function setPhone(phone: string): Promise<AuthUser> {
  const token = getToken();
  if (!API_URL || !token) throw new OtpError("auth_unavailable", 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone }),
    });
  } catch {
    throw new OtpError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok || !data.user) {
    throw new OtpError(data.error ?? "phone_failed", res.status);
  }
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
