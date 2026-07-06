export type Category = "Movies" | "Concerts" | "Sports" | "Events" | "Travel";

export interface Seller {
  name: string;
  rating: number;
  swaps: number;
  verified: boolean;
}

export interface Listing {
  id: string;
  title: string;
  venue: string;
  when: string; // human label: "Tonight 9:30 PM"
  timeBucket: "tonight" | "tomorrow" | "weekend";
  countdown?: string; // e.g. "1h 50m" — only for tonight items
  category: Category;
  seats: string[]; // seat codes, e.g. ["G12", "G13"]
  price: number; // asking price per booking
  paid: number; // original price
  emoji: string;
  seller: Seller;
  status?: "active" | "sold";
}

export const rahul: Seller = {
  name: "Rahul S.",
  rating: 4.9,
  swaps: 23,
  verified: true,
};

export const me = {
  name: "Anita K.",
  rating: 4.8,
  swaps: 31,
  verified: true,
};

export const listings: Listing[] = [
  {
    id: "dune",
    title: "Dune: Part Two",
    venue: "PVR Nexus · Screen 4",
    when: "Tonight 9:30 PM",
    timeBucket: "tonight",
    countdown: "1h 50m",
    category: "Movies",
    seats: ["G12", "G13"],
    price: 180,
    paid: 320,
    emoji: "🎬",
    seller: rahul,
  },
  {
    id: "indie",
    title: "Indie Night Live",
    venue: "Phoenix Arena",
    when: "Tomorrow 8:00 PM",
    timeBucket: "tomorrow",
    countdown: "2h",
    category: "Concerts",
    seats: ["GA"],
    price: 900,
    paid: 1100,
    emoji: "🎸",
    seller: { name: "Meera D.", rating: 4.7, swaps: 11, verified: true },
  },
  {
    id: "ipl",
    title: "IPL Match",
    venue: "Chepauk · Stand D",
    when: "Tomorrow 7:30 PM",
    timeBucket: "tomorrow",
    category: "Sports",
    seats: ["D-214"],
    price: 1200,
    paid: 1500,
    emoji: "🏏",
    seller: { name: "Vikram P.", rating: 4.6, swaps: 8, verified: true },
  },
  {
    id: "standup",
    title: "Standup: Late Show",
    venue: "The Comedy House",
    when: "Tonight 10:00 PM",
    timeBucket: "tonight",
    countdown: "2h 20m",
    category: "Events",
    seats: ["A4"],
    price: 350,
    paid: 499,
    emoji: "🎤",
    seller: { name: "Sana R.", rating: 5.0, swaps: 4, verified: false },
  },
  {
    id: "sufi",
    title: "Sufi Night",
    venue: "Ravindra Bharathi",
    when: "Sat 7:00 PM",
    timeBucket: "weekend",
    category: "Concerts",
    seats: ["B10", "B11"],
    price: 600,
    paid: 800,
    emoji: "🎶",
    seller: { name: "Arjun M.", rating: 4.8, swaps: 15, verified: true },
  },
];

// listings shown under Profile → Selling / Bought
export const myListings: Listing[] = [
  {
    id: "my-dune",
    title: "Dune · Tonight",
    venue: "PVR Nexus",
    when: "Tonight 9:30 PM",
    timeBucket: "tonight",
    category: "Movies",
    seats: ["H2", "H3"],
    price: 180,
    paid: 320,
    emoji: "🎬",
    seller: me as unknown as Seller,
    status: "active",
  },
  {
    id: "my-ipl",
    title: "IPL Finals",
    venue: "Chepauk",
    when: "Last Sunday",
    timeBucket: "weekend",
    category: "Sports",
    seats: ["C-101"],
    price: 1200,
    paid: 1500,
    emoji: "🏏",
    seller: me as unknown as Seller,
    status: "sold",
  },
];

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const savePct = (l: Listing) =>
  Math.round(((l.paid - l.price) / l.paid) * 100);
