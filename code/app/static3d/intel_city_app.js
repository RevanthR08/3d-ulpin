import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

let scene, camera, renderer, controls, cityRoot, sun;
let cityCenter = new THREE.Vector3();
let cityRadius = 800;
let homeCam = new THREE.Vector3();
let homeTarget = new THREE.Vector3();
let flyTarget = null;
let registry = { meta: {}, buildings: [], mesh_to_building: {} };
let pickableMeshes = [];
let selectedMeshes = [];
let hoverMeshes = [];
let selectedData = null;
let buildingRuntime = new Map();
let meshOrigEmissive = new WeakMap();
let footprintGroup = null;
let activeOutlineId = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tip = document.getElementById("tooltip");
const panelEl = document.getElementById("panel");

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function setProgress(pct, label) {
  const fill = document.getElementById("bar-fill");
  const text = document.getElementById("load-text");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (text && label) text.textContent = label;
  document.getElementById("badge").innerHTML = `<b>Loading</b> · ${Math.round(pct)}%`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function statusClass(st) {
  if (st === "registered") return "ok";
  if (st === "mortgage") return "warn";
  return "bad";
}

/** Blender Z-up AABB → Three Y-up Box3 (x→x, z→y, y→-z). */
function blenderAabbToThree(aabb) {
  const [xmin, ymin, zmin] = aabb.min;
  const [xmax, ymax, zmax] = aabb.max;
  const min = new THREE.Vector3(
    Math.min(xmin, xmax),
    Math.min(zmin, zmax),
    Math.min(-ymin, -ymax)
  );
  const max = new THREE.Vector3(
    Math.max(xmin, xmax),
    Math.max(zmin, zmax),
    Math.max(-ymin, -ymax)
  );
  const box = new THREE.Box3(min, max);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}

/** Blender XY footprint → Three Line on ground plane. */
function makeFootprintOutline(poly, groundY) {
  if (!poly?.length) return null;
  const pts = poly.map(([x, y]) => new THREE.Vector3(x, groundY, -y));
  pts.push(pts[0].clone());
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: 0x0ea5a8,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  });
  const line = new THREE.Line(geom, mat);
  line.renderOrder = 10;
  line.visible = false;
  line.frustumCulled = false;
  return line;
}

function rememberEmissive(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (meshOrigEmissive.has(mesh)) return;
  meshOrigEmissive.set(mesh, mats.map((m) => ({
    m,
    color: m?.emissive ? m.emissive.clone() : null,
    intensity: m?.emissiveIntensity ?? 0,
  })));
}

function setMeshGlow(meshes, on, colorHex = 0x1f7a8c) {
  for (const mesh of meshes) {
    rememberEmissive(mesh);
    const saved = meshOrigEmissive.get(mesh) || [];
    for (const s of saved) {
      if (!s.m?.emissive) continue;
      if (on) {
        s.m.emissive.setHex(colorHex);
        s.m.emissiveIntensity = 0.38;
      } else if (s.color) {
        s.m.emissive.copy(s.color);
        s.m.emissiveIntensity = s.intensity;
      } else {
        s.m.emissive.setHex(0x000000);
        s.m.emissiveIntensity = 0;
      }
      s.m.needsUpdate = true;
    }
  }
}

function showOutline(buildingId) {
  if (activeOutlineId === buildingId) return;
  hideOutline();
  const rt = buildingRuntime.get(buildingId);
  if (!rt?.outline) return;
  rt.outline.visible = true;
  activeOutlineId = buildingId;
}

function hideOutline() {
  if (!activeOutlineId) return;
  const rt = buildingRuntime.get(activeOutlineId);
  if (rt?.outline) rt.outline.visible = false;
  activeOutlineId = null;
}

/**
 * Tag GLB meshes from Blender-exported mesh_to_building map.
 * No runtime clustering — AABB + floors come from JSON.
 */
function applyBuildingRegistry(root) {
  pickableMeshes = [];
  buildingRuntime.clear();
  if (footprintGroup) {
    scene.remove(footprintGroup);
    footprintGroup.traverse((o) => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
  }
  footprintGroup = new THREE.Group();
  footprintGroup.name = "building_footprints";
  scene.add(footprintGroup);

  const map = registry.mesh_to_building || {};
  const byId = new Map((registry.buildings || []).map((b) => [b.id, b]));
  const meshesByBuilding = new Map();

  // Exact name + normalized fallback (GLB sometimes strips spaces)
  const meshIndex = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshIndex.set(o.name, o);
    const norm = o.name.replace(/\s+/g, " ").trim();
    if (!meshIndex.has(norm)) meshIndex.set(norm, o);
  });

  for (const [meshName, bid] of Object.entries(map)) {
    let mesh = meshIndex.get(meshName);
    if (!mesh) {
      // fuzzy: endsWith / includes last token
      for (const [n, m] of meshIndex) {
        if (n === meshName || n.endsWith(meshName) || meshName.endsWith(n)) {
          mesh = m;
          break;
        }
      }
    }
    if (!mesh) continue;
    mesh.userData.buildingId = bid;
    mesh.userData.isBuildingPick = true;
    pickableMeshes.push(mesh);
    if (!meshesByBuilding.has(bid)) meshesByBuilding.set(bid, []);
    meshesByBuilding.get(bid).push(mesh);
  }

  for (const b of registry.buildings || []) {
    const aabb = blenderAabbToThree(b.aabb_blender);
    const meshes = meshesByBuilding.get(b.id) || [];
    // If no mesh matched by name, still keep runtime AABB for panel/fly (rare)
    const groundY = aabb.box.min.y + 0.5;
    const outline = makeFootprintOutline(b.footprint_polygon, groundY);
    if (outline) {
      outline.userData.buildingId = b.id;
      footprintGroup.add(outline);
    }
    buildingRuntime.set(b.id, {
      box: aabb.box,
      size: aabb.size,
      center: aabb.center,
      building: b,
      meshes,
      outline,
    });
  }

  return {
    buildings: (registry.buildings || []).length,
    tagged: pickableMeshes.length,
  };
}

function setup() {
  const wrap = document.getElementById("wrap");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec4e8);

  camera = new THREE.PerspectiveCamera(42, wrap.clientWidth / wrap.clientHeight, 1, 20000);
  camera.position.set(1200, 900, 1600);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.zoomSpeed = 1.15;
  controls.panSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minPolarAngle = 0.05;

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x8a9a6a, 0.55));

  sun = new THREE.DirectionalLight(0xfff1d6, 1.65);
  sun.position.set(1400, 2200, 900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 1.0;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
  fill.position.set(-900, 600, -700);
  scene.add(fill);

  window.addEventListener("resize", () => {
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  });
  document.getElementById("btn-reset").addEventListener("click", resetView);
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => zoomBy(1.35));
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => zoomBy(1 / 1.35));
  document.getElementById("btn-top")?.addEventListener("click", topView);
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") resetView();
    if (e.key === "Escape") closePanel();
    if (e.key === "+" || e.key === "=") zoomBy(1 / 1.25);
    if (e.key === "-" || e.key === "_") zoomBy(1.25);
  });

  renderer.domElement.addEventListener("mousemove", onHover);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("touchstart", onTouchPick, { passive: true });
}

function computeCoreBounds(root) {
  const pts = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z);
    if (footprint > 5500 && size.y < 200) return;
    if (size.x * size.z > 25_000_000) return;
    pts.push(center.x, center.y, center.z);
    if (footprint < 2500) {
      pts.push(box.min.x, box.min.y, box.min.z);
      pts.push(box.max.x, box.max.y, box.max.z);
    }
  });
  if (!pts.length) return new THREE.Box3().setFromObject(root);
  const xs = [], ys = [], zs = [];
  for (let i = 0; i < pts.length; i += 3) {
    xs.push(pts[i]); ys.push(pts[i + 1]); zs.push(pts[i + 2]);
  }
  const pct = (arr, p) => {
    const a = [...arr].sort((u, v) => u - v);
    const i = Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))));
    return a[i];
  };
  const box = new THREE.Box3(
    new THREE.Vector3(pct(xs, 0.05), pct(ys, 0.02), pct(zs, 0.05)),
    new THREE.Vector3(pct(xs, 0.95), pct(ys, 0.98), pct(zs, 0.95))
  );
  box.expandByScalar(120);
  return box;
}

function frameCity(box) {
  cityCenter = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  cityRadius = 0.5 * Math.max(size.x, size.z, size.y * 0.85);

  controls.target.copy(cityCenter);
  controls.minDistance = Math.max(20, cityRadius * 0.04);
  controls.maxDistance = cityRadius * 6.5;

  const dist = cityRadius * 1.85;
  homeTarget.copy(cityCenter);
  homeCam.set(
    cityCenter.x + dist * 0.55,
    cityCenter.y + Math.max(size.y * 0.85, dist * 0.42),
    cityCenter.z + dist * 0.72
  );
  camera.position.copy(homeCam);
  camera.near = Math.max(0.5, cityRadius * 0.001);
  camera.far = cityRadius * 20;
  camera.updateProjectionMatrix();

  if (sun) {
    const s = cityRadius * 1.2;
    sun.target.position.copy(cityCenter);
    sun.target.updateMatrixWorld();
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = cityRadius * 5;
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(
      cityCenter.x + cityRadius * 0.7,
      cityCenter.y + cityRadius * 1.4,
      cityCenter.z + cityRadius * 0.45
    );
  }
  controls.update();
}

function resetView() {
  flyTarget = null;
  camera.position.copy(homeCam);
  controls.target.copy(homeTarget);
  controls.update();
}

/** factor > 1 zooms out; < 1 zooms in. */
function zoomBy(factor) {
  flyTarget = null;
  const offset = camera.position.clone().sub(controls.target);
  const dist = offset.length();
  const next = THREE.MathUtils.clamp(
    dist * factor,
    controls.minDistance,
    controls.maxDistance
  );
  offset.setLength(next);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function topView() {
  flyTarget = null;
  const dist = Math.min(controls.maxDistance * 0.85, cityRadius * 4.2);
  controls.target.copy(cityCenter);
  camera.position.set(cityCenter.x, cityCenter.y + dist, cityCenter.z + dist * 0.08);
  controls.update();
}

function clampToCity() {
  const t = controls.target;
  const maxOff = cityRadius * 1.35;
  t.x = THREE.MathUtils.clamp(t.x, cityCenter.x - maxOff, cityCenter.x + maxOff);
  t.z = THREE.MathUtils.clamp(t.z, cityCenter.z - maxOff, cityCenter.z + maxOff);
  t.y = THREE.MathUtils.clamp(t.y, cityCenter.y - cityRadius * 0.25, cityCenter.y + cityRadius * 0.85);
  const minY = cityCenter.y + cityRadius * 0.02;
  if (camera.position.y < minY) camera.position.y = minY;
}

function prepareMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const big = Math.max(size.x, size.y, size.z) > 40;
    o.castShadow = big;
    o.receiveShadow = true;
    o.frustumCulled = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = 4;
        m.map.needsUpdate = true;
      }
      m.needsUpdate = true;
    }
  });
}

function resolvePick(evt) {
  const rect = renderer.domElement.getBoundingClientRect();
  const cx = evt.clientX ?? evt.touches?.[0]?.clientX;
  const cy = evt.clientY ?? evt.touches?.[0]?.clientY;
  if (cx == null) return null;
  pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickableMeshes, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const mesh = hit.object;
  const bid = mesh.userData.buildingId;
  const rt = buildingRuntime.get(bid);
  if (!rt) return null;
  const b = rt.building;
  if (b.kind === "stadium" || !b.floors?.length) {
    return { kind: "stadium", building: b, meshes: rt.meshes, point: hit.point, buildingId: bid };
  }
  const y0 = rt.box.min.y;
  const ySpan = Math.max(rt.size.y, 8);
  let t = (hit.point.y - y0) / ySpan;
  t = clamp(t, 0, 0.999);
  const idx = Math.min(b.floors.length - 1, Math.floor(t * b.floors.length));
  const floor = b.floors[idx];
  return {
    kind: "floor",
    building: b,
    floor,
    meshes: rt.meshes,
    point: hit.point,
    buildingId: bid,
    floorLabel: floor.floor_label,
    owner: floor.owner,
    ulpin: floor.ulpin,
  };
}

function clearHover() {
  if (hoverMeshes.length && hoverMeshes !== selectedMeshes) {
    const stillSelected = selectedMeshes.length && hoverMeshes[0] === selectedMeshes[0];
    if (!stillSelected) setMeshGlow(hoverMeshes, false);
  }
  hoverMeshes = [];
  if (!selectedMeshes.length) hideOutline();
  else if (selectedData?.buildingId) showOutline(selectedData.buildingId);
}

function onHover(evt) {
  const pick = resolvePick(evt);
  if (!pick) {
    tip.style.display = "none";
    clearHover();
    return;
  }
  if (hoverMeshes[0] !== pick.meshes[0]) {
    clearHover();
    hoverMeshes = pick.meshes;
    const isSel = selectedMeshes.length && selectedMeshes[0] === pick.meshes[0];
    if (!isSel) setMeshGlow(hoverMeshes, true, 0x2a9bb0);
    showOutline(pick.buildingId);
  }
  if (pick.kind === "stadium") {
    tip.innerHTML = `<div><b>${esc(pick.building.name)}</b> · Landmark</div>
      <div class="t-owner">No vertical floor parcels</div>
      <div class="t-ulpin">${esc(pick.building.ulpin)}</div>`;
  } else {
    tip.innerHTML = `<div><b>${esc(pick.building.name)}</b> · F${esc(pick.floorLabel)}</div>
      <div class="t-owner">${esc(pick.owner || "—")}</div>
      <div class="t-ulpin">${esc(pick.ulpin)}</div>`;
  }
  tip.style.display = "block";
  tip.style.left = `${(evt.clientX ?? 0) + 14}px`;
  tip.style.top = `${(evt.clientY ?? 0) + 14}px`;
}

function onClick(evt) {
  const pick = resolvePick(evt);
  if (!pick) return;
  selectPick(pick);
}

function onTouchPick(evt) {
  const pick = resolvePick(evt);
  if (!pick) return;
  selectPick(pick);
}

function selectPick(pick) {
  if (selectedMeshes.length) setMeshGlow(selectedMeshes, false);
  selectedMeshes = pick.meshes;
  selectedData = pick;
  setMeshGlow(selectedMeshes, true, 0x0ea5a8);
  showOutline(pick.buildingId);
  flyToPick(pick);
  showPanel(pick);
}

function flyToPick(pick) {
  const rt = buildingRuntime.get(pick.buildingId);
  if (!rt) return;
  const radius = 0.55 * Math.max(rt.size.x, rt.size.z, 80);
  const look = pick.point ? pick.point.clone() : rt.center.clone();
  if (pick.floor) {
    const y0 = rt.box.min.y;
    const ySpan = Math.max(rt.size.y, 8);
    const idx = pick.floor.floor_index ?? 0;
    const n = pick.building.floors.length;
    look.y = y0 + ((idx + 0.5) / Math.max(n, 1)) * ySpan;
  }
  const dir = new THREE.Vector3(1.35, 0.75, 1.15).normalize();
  flyTarget = {
    pos: look.clone().add(dir.multiplyScalar(Math.max(70, radius * 1.45))),
    look,
  };
}

function selectFloorOnBuilding(buildingId, floorLabel) {
  const rt = buildingRuntime.get(buildingId);
  if (!rt) return;
  const floor = rt.building.floors.find((f) => f.floor_label === floorLabel);
  if (!floor) return;
  const y0 = rt.box.min.y;
  const ySpan = Math.max(rt.size.y, 8);
  const idx = floor.floor_index ?? 0;
  const n = rt.building.floors.length;
  const point = rt.center.clone();
  point.y = y0 + ((idx + 0.5) / Math.max(n, 1)) * ySpan;
  selectPick({
    kind: "floor",
    building: rt.building,
    floor,
    meshes: rt.meshes,
    point,
    buildingId,
    floorLabel: floor.floor_label,
    owner: floor.owner,
    ulpin: floor.ulpin,
  });
}

function closePanel() {
  panelEl.classList.remove("open");
  panelEl.innerHTML = "";
  if (selectedMeshes.length) setMeshGlow(selectedMeshes, false);
  selectedMeshes = [];
  selectedData = null;
  hideOutline();
}

function showPanel(data) {
  panelEl.classList.add("open");
  if (data.kind === "stadium") {
    const b = data.building;
    panelEl.innerHTML = `
      <a class="close" id="panel-close">Close</a>
      <h2>${esc(b.name)}</h2>
      <div class="breadcrumb"><b>City</b> → Landmark → Stadium</div>
      <div class="ulpin" title="Click to copy">${esc(b.ulpin)}</div>
      <div class="banner">Arena / tribune landmark — <b>no vertical floor parcels</b> under DoLR 3D ULPIN mapping. Surface parcel only.</div>
      <h3>Classification</h3>
      <div class="row"><span>Kind</span><br/><b>Stadium</b></div>
      <div class="row"><span>Legal note</span><br/>Public assembly land · floor stack N/A</div>
    `;
    wirePanel(data);
    return;
  }

  const f = data.floor;
  const b = data.building;
  const prev = (f.previous_owners || []).map((p) =>
    `<li><b>${esc(p.name)}</b><br/><span>${esc(p.from)} → ${esc(p.to)}</span></li>`
  ).join("");
  const chips = (b.floors || []).map((fl) =>
    `<button type="button" class="chip ${fl.floor_label === f.floor_label ? "active" : ""}" data-floor="${esc(fl.floor_label)}">F${esc(fl.floor_label)}</button>`
  ).join("");
  const utils = (f.utilities || []).map((u) => `<i>${esc(u)}</i>`).join("");
  const banner = b.kind === "construction"
    ? `<div class="banner">WIP structure — vertical parcel <b>pre-assigned</b> for cadastral continuity.</div>`
    : "";

  panelEl.innerHTML = `
    <a class="close" id="panel-close">Close</a>
    <h2>${esc(b.name)} · Floor ${esc(f.floor_label)}</h2>
    <div class="breadcrumb"><b>City</b> → ${esc(b.name)} → Floor ${esc(f.floor_label)}</div>
    <div class="ulpin" id="ulpin-copy" title="Click to copy">${esc(f.ulpin)}</div>
    ${banner}
    <div class="owner">${esc(f.owner)}</div>
    <div class="owner-id">${esc(f.owner_id || "")}</div>
    <div class="grid">
      <div class="stat"><div class="v">${esc(f.carpet_sq_m)} m²</div><div class="k">Carpet</div></div>
      <div class="stat"><div class="v">${esc(f.built_up_sq_m)} m²</div><div class="k">Built-up</div></div>
      <div class="stat"><div class="v">${esc(f.area_sq_m)} m²</div><div class="k">Parcel area</div></div>
      <div class="stat"><div class="v">${esc((b.floors || []).length)}</div><div class="k">Floors in building</div></div>
    </div>
    <h3>Registration</h3>
    <div class="row"><span>Status</span><br/><span class="badge ${statusClass(f.legal_status)}">${esc(f.legal_status)}</span></div>
    <div class="row"><span>Registered on</span><br/><b>${esc(f.registered_on)}</b></div>
    <div class="row"><span>Office</span><br/>${esc(f.registration_office)}</div>
    <div class="row"><span>Deed</span><br/><code>${esc(f.deed_no)}</code></div>
    <h3>Previous owners</h3>
    <ul class="timeline">${prev || "<li>—</li>"}</ul>
    <h3>Use &amp; assessment</h3>
    <div class="row"><span>Use</span><br/><b>${esc(f.use)}</b></div>
    <div class="row"><span>Tax</span><br/>${esc(f.tax_assessment)}</div>
    <div class="row"><span>Encumbrance</span><br/>${esc(f.encumbrance)}</div>
    <h3>Utilities</h3>
    <div class="util">${utils}</div>
    <h3>Jump floor</h3>
    <div class="chips" id="floor-chips">${chips}</div>
    <div class="row" style="margin-top:12px;color:var(--text-dim);font-size:11px">${esc(f.notes || "")}</div>
  `;
  wirePanel(data);
}

function wirePanel(data) {
  document.getElementById("panel-close")?.addEventListener("click", (e) => {
    e.preventDefault();
    closePanel();
  });
  const ulpinEl = document.getElementById("ulpin-copy") || panelEl.querySelector(".ulpin");
  ulpinEl?.addEventListener("click", async () => {
    const text = data.kind === "stadium" ? data.building.ulpin : data.floor?.ulpin || data.ulpin;
    try {
      await navigator.clipboard.writeText(text);
      ulpinEl.style.opacity = "0.55";
      setTimeout(() => { ulpinEl.style.opacity = "1"; }, 400);
    } catch (_) {}
  });
  panelEl.querySelectorAll("#floor-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectFloorOnBuilding(data.buildingId || data.building.id, btn.dataset.floor);
    });
  });
}

async function loadCity() {
  setProgress(5, "Loading building registry…");
  const regRes = await fetch("./intel_city/intel_city_buildings.json?v=8");
  if (!regRes.ok) throw new Error(`Registry HTTP ${regRes.status}`);
  registry = await regRes.json();

  setProgress(12, "Downloading city…");

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/");
  draco.setDecoderConfig({ type: "js" });

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      "./intel_city/intel_city.glb?v=7",
      resolve,
      (ev) => {
        if (ev.total > 0) {
          const pct = 12 + (ev.loaded / ev.total) * 70;
          setProgress(pct, `Downloading… ${(ev.loaded / 1e6).toFixed(1)} / ${(ev.total / 1e6).toFixed(1)} MB`);
        } else {
          setProgress(25, `Downloading… ${(ev.loaded / 1e6).toFixed(1)} MB`);
        }
      },
      reject
    );
  });

  setProgress(88, "Preparing materials…");
  await new Promise((r) => requestAnimationFrame(r));

  cityRoot = gltf.scene;
  prepareMaterials(cityRoot);
  scene.add(cityRoot);

  await new Promise((r) => requestAnimationFrame(r));
  setProgress(93, "Tagging buildings from Blender map…");
  const { buildings: n, tagged } = applyBuildingRegistry(cityRoot);
  console.info("[intel_city] registry", registry.meta, "tagged meshes", tagged);

  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98, "Framing city…");
  frameCity(computeCoreBounds(cityRoot));

  document.getElementById("loading").style.display = "none";
  document.getElementById("badge").innerHTML =
    `<b>Intel City</b> · ${n} buildings · ${registry.meta.floor_count} floors · ${tagged} meshes · click any building`;
  const sub = document.querySelector("#hud .sub");
  if (sub) {
    sub.innerHTML =
      `Scroll / Zoom − to pull back · hover footprint · floor from click height.<br/>Keys: <kbd>+</kbd>/<kbd>−</kbd> zoom · <kbd>R</kbd> reset · <kbd>Esc</kbd> close`;
  }
  focusUlpinFromQuery();
  draco.dispose();
}

/** Portal deep-link: /viewer3d/intel_city.html?ulpin=3D-IND-600001-I1-L5 */
function focusUlpinFromQuery() {
  const params = new URLSearchParams(location.search);
  const ulpin = params.get("ulpin");
  if (!ulpin) return;
  for (const [, rt] of buildingRuntime) {
    const b = rt.building;
    if (b.ulpin === ulpin) {
      selectPick({
        kind: b.kind === "stadium" || !b.floors?.length ? "stadium" : "floor",
        building: b,
        floor: b.floors?.[0],
        meshes: rt.meshes,
        point: rt.center.clone(),
        buildingId: b.id,
        floorLabel: b.floors?.[0]?.floor_label,
        owner: b.floors?.[0]?.owner,
        ulpin: b.ulpin,
      });
      return;
    }
    const floor = (b.floors || []).find((f) => f.ulpin === ulpin);
    if (floor) {
      selectFloorOnBuilding(b.id, floor.floor_label);
      return;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (flyTarget) {
    camera.position.lerp(flyTarget.pos, 0.08);
    controls.target.lerp(flyTarget.look, 0.1);
    if (camera.position.distanceTo(flyTarget.pos) < 2.5) flyTarget = null;
  }
  clampToCity();
  controls.update();
  renderer.render(scene, camera);
}

setup();
animate();
loadCity().catch((err) => {
  document.getElementById("load-text").textContent =
    "Failed to load — open /viewer3d/intel_city.html with the API running";
  console.error(err);
});
