/**
 * The VERTICA portal (login + citizen/operator apps) is a separate build,
 * mounted under /portal (see portal-web's vite `base` + router `basename`).
 * Buttons here hand off to the portal's own /login.
 *
 * Defaults to same-origin `/portal`. For split origins or local dev where the
 * portal runs on another port, set VITE_PORTAL_URL, e.g.
 *   VITE_PORTAL_URL=http://localhost:5173/portal
 */
const PORTAL_BASE = String(import.meta.env["VITE_PORTAL_URL"] ?? "/portal").replace(/\/+$/, "");

export type PortalRole = "citizen" | "admin";

export function portalLoginHref(role?: PortalRole): string {
  return `${PORTAL_BASE}/login${role ? `?role=${role}` : ""}`;
}
