export type Kind = "package" | "escorted" | "hotel" | "cruise";

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
  price: number;
  was: number | null;
  rating: number;
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
  highlights: string[];
  days: string[];
}
