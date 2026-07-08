/* Domain types + presentation helpers. Listings now come from the backend
   (see apiClient.ts); this module holds the UI-facing `Listing` shape and the
   helpers that derive display labels (when / countdown / emoji / bucket) from a
   raw event timestamp. No hard-coded listings live here anymore — the seed
   migration provides first-run content. */

export type Category = "Movies" | "Concerts" | "Sports" | "Events" | "Travel";

export interface Seller {
  id: number;
  name: string;
  rating: number;
  swaps: number;
  verified: boolean;
}

export interface Listing {
  id: number;
  sellerId: number;
  title: string;
  venue: string;
  city?: string;
  eventAt: string; // ISO datetime from the backend
  when: string; // derived human label: "Tonight 9:30 PM"
  timeBucket: "tonight" | "tomorrow" | "weekend";
  countdown?: string; // derived, only for tonight items: "1h 50m"
  category: Category;
  seats: string[]; // seat codes, e.g. ["G12", "G13"]
  price: number; // asking price
  paid: number; // original price
  emoji: string; // derived from category
  seller: Seller;
  status?: "active" | "sold";
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const savePct = (l: Listing) =>
  Math.round(((l.paid - l.price) / l.paid) * 100);

/** Backend stores categories lowercase; the UI shows them title-cased. */
export const toCategory = (raw: string): Category => {
  const c = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return (["Movies", "Concerts", "Sports", "Events", "Travel"] as const).includes(
    c as Category
  )
    ? (c as Category)
    : "Events";
};

/** Wire the UI category back to the backend's lowercase enum. */
export const toApiCategory = (c: Category): string => c.toLowerCase();

const EMOJI: Record<Category, string> = {
  Movies: "🎬",
  Concerts: "🎸",
  Sports: "🏏",
  Events: "🎤",
  Travel: "✈️",
};
export const emojiFor = (c: Category): string => EMOJI[c] ?? "🎟️";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Bucket an event into the Home/Search time tabs relative to now. */
export const timeBucketFor = (eventAt: string): Listing["timeBucket"] => {
  const now = new Date();
  const when = new Date(eventAt);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(when, now)) return "tonight";
  if (isSameDay(when, tomorrow)) return "tomorrow";
  return "weekend";
};

/** Human label like "Tonight 9:30 PM" / "Tomorrow 8:00 PM" / "Sat 7:00 PM". */
export const whenLabel = (eventAt: string): string => {
  const when = new Date(eventAt);
  const time = when.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  const bucket = timeBucketFor(eventAt);
  if (bucket === "tonight") return `Tonight ${time}`;
  if (bucket === "tomorrow") return `Tomorrow ${time}`;
  const day = when.toLocaleDateString("en-IN", { weekday: "short" });
  return `${day} ${time}`;
};

/** "1h 50m" until the event — only meaningful for tonight's near-term items. */
export const countdownFor = (eventAt: string): string | undefined => {
  const diffMs = new Date(eventAt).getTime() - Date.now();
  if (diffMs <= 0 || diffMs > 6 * 60 * 60 * 1000) return undefined;
  const mins = Math.round(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
