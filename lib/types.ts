export type Kind = "package" | "escorted" | "hotel" | "cruise";

export interface DepartureDTO {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** per-adult change vs the trip base price, INR */
  priceDelta: number;
  /** null = not limited */
  seatsLeft: number | null;
}

/** Trip shape used by pages and client components (lists already split). */
export interface TripDTO {
  id: string;
  slug: string;
  title: string;
  dest: string;
  country: string;
  region: string;
  kind: Kind;
  themes: string[];
  nights: number;
  stars: number;
  board: string;
  /** base price per adult in INR (flights from Mumbai when `flight`) */
  price: number;
  was: number | null;
  /** average stars (1–5) from published traveller reviews; null until the first one */
  rating: number | null;
  /** number of published traveller reviews */
  reviews: number;
  beach: number | null;
  flight: boolean;
  freeCancel: boolean;
  tourManager: boolean;
  easyVisa: boolean;
  lastMinute: boolean;
  earlyBird: boolean;
  featured: boolean;
  image: string;
  /** ISO codes of countries visited */
  countryCodes: string[];
  /** team note about visas, shown above the automatic info */
  visaNote: string | null;
  highlights: string[];
  days: string[];
  /** cheapest upcoming departure's delta (0 when no departures) */
  minDelta: number;
  /** date of the cheapest upcoming departure */
  cheapestDate: string | null;
  /** all upcoming open departure dates, sorted */
  depDates: string[];
}

/** Lightweight record for search and the compare tray. */
export interface TripIndexItem {
  id: string;
  slug: string;
  title: string;
  dest: string;
  country: string;
  region: string;
  themes: string[];
  kind: Kind;
  nights: number;
  image: string;
  price: number;
  minDelta: number;
  flight: boolean;
}
