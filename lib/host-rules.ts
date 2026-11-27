// Which host serves what: the staff workspace lives on its own subdomain.
// Pure, so it's unit-tested; proxy.ts applies it.

export const WORKSPACE_HOST = "workspace.ribriztravel.com";
const SITE = "https://www.ribriztravel.com";

export type HostDecision = { redirect: string } | { pass: true; noindex: boolean };

/**
 * - On the workspace host: "/" opens the staff app; staff pages, APIs and
 *   assets load; anything else (the public site) goes to www.
 * - On the main site: /admin moves to the workspace once it's switched on
 *   (workspaceUrl set), so staff bookmarks keep working.
 */
export function routeHost(host: string, path: string, search: string, workspaceUrl?: string): HostDecision {
  const h = host.toLowerCase().split(":")[0];
  if (h === WORKSPACE_HOST || h.startsWith("workspace.")) {
    if (path === "/" || path === "") return { redirect: "/admin" };
    const staffOrAsset = path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/") || path.startsWith("/_next/") || /\.[a-z0-9]{2,5}$/i.test(path);
    return staffOrAsset ? { pass: true, noindex: true } : { redirect: `${SITE}${path}${search}` };
  }
  if (workspaceUrl && (h === "www.ribriztravel.com" || h === "ribriztravel.com") && (path === "/admin" || path.startsWith("/admin/"))) {
    return { redirect: `${workspaceUrl.replace(/\/$/, "")}${path}${search}` };
  }
  return { pass: true, noindex: false };
}

/** Links to the staff app in emails: the workspace once it's live, else the main site. */
export const workspaceLink = (path = "/admin") =>
  `${(process.env.WORKSPACE_URL || process.env.NEXT_PUBLIC_SITE_URL || SITE).replace(/\/$/, "")}${path}`;
