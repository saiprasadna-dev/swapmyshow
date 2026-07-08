/* ---------------------------------------------------------------
   API client for the listing / swap / chat flows. Reuses the session
   token and base URL from authClient. Raw server payloads (Api*) are
   adapted into the UI-facing shapes from data.ts at the boundary, so
   screens work with `Listing` / `SwapView` / `ChatMessage` directly.
---------------------------------------------------------------- */

import { API_URL, getToken, clearSession } from "./authClient";
import {
  type Category,
  type Listing,
  type Seller,
  toCategory,
  toApiCategory,
  emojiFor,
  whenLabel,
  timeBucketFor,
  countdownFor,
} from "./data";

/** True when the backend URL is configured (listings/chat need it). */
export const apiReady = Boolean(API_URL);

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/* ---------- raw server shapes ---------- */

interface ApiSeller {
  id: number;
  name: string;
  rating: number;
  swaps: number;
  verified: boolean;
}

interface ApiListing {
  id: number;
  sellerId: number;
  category: string;
  title: string;
  venue: string | null;
  eventAt: string;
  seats: string[];
  ticketCount: number;
  paid: number;
  price: number;
  city: string | null;
  status: string;
  hasScreenshot: boolean;
  screenshotUrl: string | null;
  seller: ApiSeller;
}

interface ApiSwap {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  agreedPrice: number;
  step: "agree" | "transfer" | "rate" | "done";
  buyerConfirmedReceipt: boolean;
  sellerMarkedTransferred: boolean;
  role: "buyer" | "seller";
  buyerName: string;
  offerPrice: number | null;
  offerBy: number | null;
  listing: ApiListing;
}

interface ApiConversation extends ApiSwap {
  counterpartyName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface ApiMessage {
  id: number;
  senderId: number;
  body: string;
  createdAt: string | null;
}

/* ---------- UI-facing shapes ---------- */

export interface SwapView {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  agreedPrice: number;
  step: "agree" | "transfer" | "rate" | "done";
  buyerConfirmedReceipt: boolean;
  sellerMarkedTransferred: boolean;
  role: "buyer" | "seller";
  buyerName: string;
  offerPrice: number | null;
  offerBy: number | null;
  listing: Listing;
}

export interface ConversationView extends SwapView {
  counterpartyName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  body: string;
  createdAt: string | null;
}

/* ---------- adapters ---------- */

const toSeller = (s: ApiSeller): Seller => ({
  id: s.id,
  name: s.name,
  rating: s.rating,
  swaps: s.swaps,
  verified: s.verified,
});

const toListing = (l: ApiListing): Listing => {
  const category = toCategory(l.category);
  return {
    id: l.id,
    sellerId: l.sellerId,
    title: l.title,
    venue: l.venue ?? "",
    city: l.city ?? "",
    eventAt: l.eventAt,
    when: whenLabel(l.eventAt),
    timeBucket: timeBucketFor(l.eventAt),
    countdown: countdownFor(l.eventAt),
    category,
    seats: l.seats,
    price: l.price,
    paid: l.paid,
    emoji: emojiFor(category),
    screenshotUrl: l.screenshotUrl
      ? l.screenshotUrl.startsWith("http")
        ? l.screenshotUrl
        : `${API_URL}${l.screenshotUrl}`
      : undefined,
    seller: toSeller(l.seller),
    status: l.status === "sold" ? "sold" : "active",
  };
};

const toSwapView = (s: ApiSwap): SwapView => ({
  id: s.id,
  listingId: s.listingId,
  buyerId: s.buyerId,
  sellerId: s.sellerId,
  agreedPrice: s.agreedPrice,
  step: s.step,
  buyerConfirmedReceipt: s.buyerConfirmedReceipt,
  sellerMarkedTransferred: s.sellerMarkedTransferred,
  role: s.role,
  buyerName: s.buyerName,
  offerPrice: s.offerPrice,
  offerBy: s.offerBy,
  listing: toListing(s.listing),
});

const toConversation = (c: ApiConversation): ConversationView => ({
  ...toSwapView(c),
  counterpartyName: c.counterpartyName,
  lastMessage: c.lastMessage,
  lastMessageAt: c.lastMessageAt,
  unreadCount: c.unreadCount,
});

/* ---------- fetch helper ---------- */

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError("api_unavailable", 0);
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("network", 0);
  }

  if (res.status === 401) {
    clearSession();
    throw new ApiError("unauthorized", 401);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError((data.error as string) ?? "request_failed", res.status);
  }
  return data as T;
}

/* ---------- listings ---------- */

export async function fetchListings(category?: Category): Promise<Listing[]> {
  const q = category ? `?category=${toApiCategory(category)}` : "";
  const data = await api<{ listings: ApiListing[] }>(`/listings${q}`);
  return data.listings.map(toListing);
}

export async function fetchListing(id: number): Promise<Listing> {
  const data = await api<{ listing: ApiListing }>(`/listings/${id}`);
  return toListing(data.listing);
}

export interface NewListing {
  category: Category;
  title: string;
  venue: string;
  eventAt: string;
  seats: string[];
  ticketCount: number;
  paid: number;
  ask: number;
  city?: string;
  hasScreenshot: boolean;
  screenshotUrl?: string;
}

/** Upload an image (raw file body) and return an absolute URL to it. */
export async function uploadImage(file: File): Promise<string> {
  if (!API_URL) throw new ApiError("api_unavailable", 0);
  const token = getToken();
  const headers = new Headers();
  headers.set("Content-Type", file.type);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/uploads`, { method: "POST", headers, body: file });
  } catch {
    throw new ApiError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new ApiError(data.error ?? "upload_failed", res.status);
  }
  return data.url.startsWith("http") ? data.url : `${API_URL}${data.url}`;
}

export async function createListing(input: NewListing): Promise<Listing> {
  const data = await api<{ listing: ApiListing }>(`/listings`, {
    method: "POST",
    body: JSON.stringify({ ...input, category: toApiCategory(input.category) }),
  });
  return toListing(data.listing);
}

/** Edit an active listing the caller owns. */
export async function updateListing(
  id: number,
  input: NewListing
): Promise<Listing> {
  const data = await api<{ listing: ApiListing }>(`/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, category: toApiCategory(input.category) }),
  });
  return toListing(data.listing);
}

/** Cancel (soft-delete) a listing the caller owns. */
export async function cancelListing(id: number): Promise<void> {
  await api(`/listings/${id}`, { method: "DELETE" });
}

export async function fetchMyListings(): Promise<Listing[]> {
  const data = await api<{ listings: ApiListing[] }>(`/me/listings`);
  return data.listings.map(toListing);
}

export async function fetchSavedListings(): Promise<Listing[]> {
  const data = await api<{ listings: ApiListing[] }>(`/me/saved`);
  return data.listings.map(toListing);
}

export async function toggleSaved(listingId: number): Promise<boolean> {
  const data = await api<{ saved: boolean }>(`/listings/${listingId}/save`, {
    method: "POST",
  });
  return data.saved;
}

/* ---------- swaps + chat ---------- */

export async function startSwap(listingId: number): Promise<SwapView> {
  const data = await api<{ swap: ApiSwap }>(`/listings/${listingId}/swap`, {
    method: "POST",
  });
  return toSwapView(data.swap);
}

export async function fetchSwap(swapId: number): Promise<SwapView> {
  const data = await api<{ swap: ApiSwap }>(`/swaps/${swapId}`);
  return toSwapView(data.swap);
}

export async function fetchMySwaps(): Promise<SwapView[]> {
  const data = await api<{ swaps: ApiSwap[] }>(`/me/swaps`);
  return data.swaps.map(toSwapView);
}

/** Every conversation the caller is in — as buyer or seller — for the
    Messages inbox, newest activity first. */
export async function fetchConversations(): Promise<ConversationView[]> {
  const data = await api<{ conversations: ApiConversation[] }>(
    `/me/conversations`
  );
  return data.conversations.map(toConversation);
}

/** Total unread messages across the caller's chats (for the nav badge). */
export async function fetchUnreadCount(): Promise<number> {
  const data = await api<{ count: number }>(`/me/unread`);
  return data.count ?? 0;
}

/** Mark a swap's chat as read for the caller (clears its unread). */
export async function markSwapRead(swapId: number): Promise<void> {
  await api(`/swaps/${swapId}/read`, { method: "POST" });
}

export async function fetchMessages(
  swapId: number,
  sinceId = 0
): Promise<ChatMessage[]> {
  const q = sinceId > 0 ? `?sinceId=${sinceId}` : "";
  const data = await api<{ messages: ApiMessage[] }>(
    `/swaps/${swapId}/messages${q}`
  );
  return data.messages;
}

export async function sendMessage(
  swapId: number,
  body: string
): Promise<ChatMessage> {
  const data = await api<{ message: ApiMessage }>(`/swaps/${swapId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return data.message;
}

type SwapAction = "confirm" | "transfer" | "receipt";
export async function advanceSwap(
  swapId: number,
  action: SwapAction
): Promise<SwapView> {
  const data = await api<{ swap: ApiSwap }>(`/swaps/${swapId}/${action}`, {
    method: "POST",
  });
  return toSwapView(data.swap);
}

/** Propose a price in chat. */
export async function makeOffer(
  swapId: number,
  price: number
): Promise<SwapView> {
  const data = await api<{ swap: ApiSwap }>(`/swaps/${swapId}/offer`, {
    method: "POST",
    body: JSON.stringify({ price }),
  });
  return toSwapView(data.swap);
}

/** Accept the counterparty's pending offer as the agreed price. */
export async function acceptOffer(swapId: number): Promise<SwapView> {
  const data = await api<{ swap: ApiSwap }>(`/swaps/${swapId}/offer/accept`, {
    method: "POST",
  });
  return toSwapView(data.swap);
}

export async function submitRating(
  swapId: number,
  stars: number,
  note: string
): Promise<void> {
  await api(`/swaps/${swapId}/rate`, {
    method: "POST",
    body: JSON.stringify({ stars, note }),
  });
}
