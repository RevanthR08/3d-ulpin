/*
 * Shared shell (sidebar + topbar) and mock role-based auth for the portal.
 * Each page provides its own content inside <div id="page-content"> and
 * sets data-page/data-title/data-crumbs on <body>; this script wraps that
 * content in the shared chrome and gates the page behind login.
 *
 * Auth is intentionally a demo/prototype mock (localStorage, no server
 * validation) - consistent with everything else in this project that's
 * explicitly simulated rather than claiming real security.
 */

const NAV_ITEMS = [
  { group: "Registry", page: "index", label: "Command Center", href: "/portal/", roles: ["admin", "user"] },
  { group: "Registry", page: "ulpin", label: "ULPIN Registry", href: "/portal/ulpin.html", roles: ["admin", "user"] },
  { group: "Registry", page: "analytics", label: "Analytics", href: "/portal/analytics.html", roles: ["admin", "user"] },
  { group: "Spatial Views", label: "3D Spatial Registry", href: "/viewer3d/", roles: ["admin", "user"], external: true },
  { group: "Spatial Views", label: "2D Site Plan", href: "/viewer/", roles: ["admin", "user"], external: true },
  { group: "Spatial Views", label: "Real-World Map", href: "/viewer-map/", roles: ["admin", "user"], external: true },
  { group: "Administration", page: "ingestion", label: "Data Ingestion", href: "/portal/ingestion.html", roles: ["admin"] },
  { group: "Administration", page: "processing", label: "AI Processing", href: "/portal/processing.html", roles: ["admin"] },
  { group: "Administration", page: "validation", label: "Spatial Validation", href: "/portal/validation.html", roles: ["admin"] },
  { group: "Administration", label: "Footprint Extraction Tool", href: "/extract/", roles: ["admin"], external: true },
];

function getAuth() {
  try {
    const raw = localStorage.getItem("ulpin_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function requireAuth() {
  const auth = getAuth();
  const page = document.body.dataset.page;
  if (!auth && page !== "login") {
    window.location.href = "/portal/login.html";
    return null;
  }
  return auth;
}

function buildShell(auth) {
  const page = document.body.dataset.page || "";
  const title = document.body.dataset.title || "";
  const crumbs = document.body.dataset.crumbs || "";

  const pageContent = document.getElementById("page-content");
  const currentNavItem = NAV_ITEMS.find((i) => i.page === page);
  const allowed = !currentNavItem || currentNavItem.roles.includes(auth.role);
  const contentHtml = allowed
    ? (pageContent ? pageContent.innerHTML : "")
    : `<div class="card" style="max-width:480px">
        <h2 class="section-title" style="margin-top:0">Access Restricted</h2>
        <div class="placeholder-note">"${title}" requires an <b>Admin</b> account. You're signed in as
          <b>${auth.username}</b> (${auth.role}). Sign in as an admin to access this section, or head back
          to the Command Center.</div>
        <div style="margin-top:14px"><a class="btn secondary" href="/portal/">← Back to Command Center</a></div>
      </div>`;

  const visibleItems = NAV_ITEMS.filter((i) => i.roles.includes(auth.role));
  const groups = [...new Set(visibleItems.map((i) => i.group))];

  const navHtml = groups.map((g) => {
    const items = visibleItems.filter((i) => i.group === g);
    return `<div class="nav-group-label">${g}</div>` + items.map((i) => `
      <a class="nav-item ${i.page === page ? "active" : ""} ${i.external ? "external" : ""}" href="${i.href}">
        <span class="dot"></span>${i.label}
      </a>`).join("");
  }).join("");

  document.body.innerHTML = `
    <div id="shell">
      <div id="sidebar">
        <div class="brand">
          <div class="name">3D ULPIN Registry</div>
          <div class="tag">Volumetric Spatial Cadastre</div>
        </div>
        <nav>${navHtml}</nav>
        <div class="foot">
          <div class="who">${auth.username}</div>
          <div class="role">${auth.role} account</div>
          <a class="logout" id="logout-link">Sign out</a>
        </div>
      </div>
      <div id="main">
        <div id="topbar">
          <div>
            <h1>${title}</h1>
            <div class="crumbs">${crumbs}</div>
          </div>
          <div class="meta">
            <span>EPSG:4979</span>
            <span class="status-pill"><span class="dot"></span>AI Engine Operational</span>
          </div>
        </div>
        <div id="content">${contentHtml}</div>
      </div>
    </div>
  `;

  document.getElementById("logout-link").addEventListener("click", () => {
    localStorage.removeItem("ulpin_auth");
    window.location.href = "/portal/login.html";
  });

  window.PORTAL_ACCESS_ALLOWED = allowed;
}

(function init() {
  const auth = requireAuth();
  if (!auth) return; // redirecting to login
  if (document.body.dataset.page === "login") return; // login page builds its own layout
  buildShell(auth);
  window.dispatchEvent(new CustomEvent("shell-ready"));
})();
