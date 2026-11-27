// Team rules: roles, permissions, who gets new work, follow-up timing.
// Pure (no server imports), so it's unit-tested.

export type Role = "owner" | "manager" | "agent";
export const ROLES: Role[] = ["owner", "manager", "agent"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", agent: "Agent" };
const RANK: Record<Role, number> = { agent: 1, manager: 2, owner: 3 };

/**
 * What each role may do.
 * - agent: their clients and the unassigned queue: reply, follow up, notes, visa stages, send options, set prices
 * - manager: everyone's clients, reassigning, refunds and invoices, trips, visa catalogue, reports
 * - owner: everything, including adding and removing employees
 */
export const PERMS = {
  work: "agent",
  seeAll: "manager",
  reassign: "manager",
  money: "manager",
  catalogue: "manager",
  reports: "manager",
  deleteRecords: "manager",
  team: "owner",
} as const satisfies Record<string, Role>;
export type Perm = keyof typeof PERMS;

export const can = (role: Role, perm: Perm) => RANK[role] >= RANK[PERMS[perm]];

/**
 * Who gets a new client: active staff who take new work, fewest open
 * requests first; ties go to whoever was assigned least recently.
 */
export function pickAssignee(staff: { id: string; open: number; lastAssignedAt: number }[]): string | null {
  if (!staff.length) return null;
  return [...staff].sort((a, b) => a.open - b.open || a.lastAssignedAt - b.lastAssignedAt)[0].id;
}

export type Bucket = "overdue" | "today" | "upcoming";

/** Overdue, due today (India time) or later. */
export function followUpBucket(due: Date, now: Date): Bucket {
  const day = (d: Date) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
  if (due.getTime() < now.getTime() && day(due) < day(now)) return "overdue";
  if (day(due) === day(now)) return due.getTime() < now.getTime() ? "overdue" : "today";
  return "upcoming";
}

/** "Tomorrow 10am" style shortcuts for setting a follow-up, as India-time instants. */
export function quickDue(now: Date, pick: "2h" | "tomorrow" | "3d" | "week"): Date {
  if (pick === "2h") return new Date(now.getTime() + 2 * 3600e3);
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  const days = pick === "tomorrow" ? 1 : pick === "3d" ? 3 : 7;
  // 10:00 India time on that day
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 4, 30));
}

/** Clients are keyed by email; the admin address uses a URL-safe form of it. */
export const clientKey = (email: string) => Buffer.from(email.trim().toLowerCase()).toString("base64url");
export const clientEmail = (key: string) => Buffer.from(key, "base64url").toString().trim().toLowerCase();
