// Shapes of the interactive blocks Riya can put on screen. Shared by the server
// (which validates and fills them with real data) and the chat (which draws them).

export interface AskOption { label: string; emoji?: string }
export interface AskQuestion {
  id: string;
  label: string;
  /** single: tap one; multi: tap several; text: type */
  type: "single" | "multi" | "text";
  options?: AskOption[];
  placeholder?: string;
}
export interface TripPick {
  slug: string; title: string; image: string; dest: string; country: string; nights: number;
  /** per adult, INR, before GST */
  price: number; date: string | null; seats: number | null; visa?: string;
  badge?: string; why?: string; rating?: number; flight?: boolean;
}
export interface UiAction { label: string; icon?: string; say?: string; href?: string }

export type UiBlock =
  | { kind: "ask"; id: string; intro?: string; questions: AskQuestion[]; submit: string }
  | { kind: "trips"; id: string; title?: string; items: TripPick[] }
  | { kind: "actions"; id: string; items: UiAction[] };

/** One step of Riya's work, shown live while she works. */
export interface Step { id: string; label: string; state: "run" | "done" | "error"; detail?: string }

/** How a block reads in the text history sent back to the model on later turns. */
export function blockAsText(b: UiBlock): string {
  if (b.kind === "ask") return `[I asked with tappable options: ${b.questions.map((q) => `${q.label}${q.options?.length ? ` (${q.options.map((o) => o.label).join(" / ")})` : ""}`).join("; ")}]`;
  if (b.kind === "trips") return `[I showed trip cards: ${b.items.map((t) => `${t.slug}${t.date ? ` ${t.date}` : ""}${t.badge ? ` "${t.badge}"` : ""}`).join(", ")}]`;
  return `[Next-step buttons: ${b.items.map((a) => a.label).join(" | ")}]`;
}
