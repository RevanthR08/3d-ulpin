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
let undergroundRoot = null;
let undergroundReg = { meta: {}, utilities: [], structures: [] };
let ugPickable = [];
let ugVisible = false;
let ugTypeEnabled = {
  fiber_optic: true,
  electrical_cable: true,
  water_pipeline: true,
  sewer: true,
  structure: true,
};
let ugLiftY = 0;
let cityBaseMeshes = [];

/** Portal citizen twin: lock orbit + picks to one building (mode=citizen&ulpin=…). */
let citizenMode = false;
let lockedBuildingId = null;
let lockedFloorLabel = null;
let lockedUnitUlpin = null;
let lockCenter = new THREE.Vector3();
/** Side-by-side 3D top view vs satellite orthophoto. */
let satCompareOn = false;
let lockRadius = 80;
let citizenStartDist = 70;

// Blender-authored floorplate interiors (one plate per residential building)
let interiorRoot = null;
let interiorReg = { meta: {}, buildings: [] };
let interiorByBuilding = new Map(); // building_id → { group, rooms: [], roomMeshes: [] }
let interiorView = "exterior"; // exterior | cutaway | interior
let interiorLoaded = false;
let interiorLoading = null;
let shellHidden = []; // { mesh, visible }

const UG_COLORS = {
  fiber_optic: 0x22d3ee,
  electrical_cable: 0xfacc15,
  water_pipeline: 0x60a5fa,
  sewer: 0xb45309,
  underground_parking: 0x94a3b8,
  basement: 0xa8a29e,
};

const ROOM_COLORS = {
  living_room: 0xdcb878,
  kitchen: 0xe8c890,
  dining: 0xd0a878,
  master_bedroom: 0x7898c8,
  bedroom: 0x68b898,
  bathroom: 0x68b8c0,
  balcony: 0x48a0d0,
  hall: 0xb8b0a8,
};

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
  if (st === "mortgage" || st === "leasehold") return "warn";
  return "bad";
}

function round1(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 10) / 10;
}

function shareTax(text, share) {
  if (!text) return "—";
  const raw = String(text);
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return raw;
  const n = Math.round(Number(m[1]) * share);
  return `₹${n.toLocaleString("en-IN")} / yr`;
}

function houseEncumbrance(unit, floor) {
  if (unit?.encumbrance) return unit.encumbrance;
  const s = String(unit?.legal_status || "").toLowerCase();
  if (s.includes("mortgage")) return "Mortgage lien";
  if (s.includes("dispute")) return "Title under dispute";
  if (s.includes("lease")) return "Leasehold occupancy";
  return floor?.encumbrance || "—";
}

/** Bind a house on this floor so the inspector shows that unit, not the floor roll-up. */
function attachHouse(pick, preferredUlpin, preferredLabel) {
  const units = pick?.floor?.units || [];
  if (!units.length) return pick;
  let unit = null;
  if (citizenMode && lockedUnitUlpin) {
    unit = units.find((u) => u.ulpin === lockedUnitUlpin) || units[0];
  } else if (preferredUlpin) {
    unit = units.find((u) => u.ulpin === preferredUlpin) || null;
  }
  if (!unit && preferredLabel) {
    unit = units.find((u) => String(u.unit_label) === String(preferredLabel)) || null;
  }
  if (!unit) unit = units[0];
  pick.unit = unit;
  pick.owner = unit.owner;
  pick.ulpin = unit.ulpin;
  return pick;
}

/** Per-house cadastral fields for the right panel. */
function houseRecord(floor, unit) {
  const n = Math.max((floor?.units || []).length, 1);
  const share = 1 / n;
  if (!unit) {
    return {
      legal_status: floor.legal_status,
      registered_on: floor.registered_on,
      registration_office: floor.registration_office,
      deed_no: floor.deed_no,
      previous_owners: floor.previous_owners || [],
      use: floor.use,
      tax: floor.tax_assessment,
      encumbrance: floor.encumbrance,
      utilities: floor.utilities || [],
      area: floor.area_sq_m,
      carpet: floor.carpet_sq_m,
      built_up: floor.built_up_sq_m,
      notes: floor.notes,
    };
  }
  return {
    legal_status: unit.legal_status || floor.legal_status,
    registered_on: unit.registered_on || floor.registered_on,
    registration_office: unit.registration_office || floor.registration_office,
    deed_no: unit.deed_no || floor.deed_no,
    previous_owners: unit.previous_owners || floor.previous_owners || [],
    use: unit.use || floor.use,
    tax: unit.tax_assessment || shareTax(floor.tax_assessment, share),
    encumbrance: houseEncumbrance(unit, floor),
    utilities: unit.utilities || floor.utilities || [],
    area: unit.area_sq_m ?? round1(floor.area_sq_m * share),
    carpet: unit.carpet_sq_m ?? round1(floor.carpet_sq_m * share),
    built_up: unit.built_up_sq_m ?? round1(floor.built_up_sq_m * share),
    notes: unit.notes || floor.notes,
  };
}

/** Infer utility type from Blender mesh name. */
function ugTypeFromName(name) {
  const n = (name || "").toUpperCase();
  if (n.includes("FIBER")) return "fiber_optic";
  if (n.includes("ELEC")) return "electrical_cable";
  if (n.includes("WATER")) return "water_pipeline";
  if (n.includes("SEWER")) return "sewer";
  if (n.includes("PARK")) return "underground_parking";
  if (n.includes("BASE")) return "basement";
  return null;
}

function findUgAsset(meshName) {
  const all = [...(undergroundReg.utilities || []), ...(undergroundReg.structures || [])];
  const exact = all.find((a) => a.mesh_name === meshName || a.id === meshName);
  if (exact) return exact;
  // GLB sometimes keeps "_curve" suffix stripped already; try prefix match
  return all.find((a) => meshName.startsWith(a.id) || a.id.startsWith(meshName.replace(/_curve$/i, "")));
}

/**
 * Load Blender-exported tubular underground GLB (not procedural cylinders).
 */
async function buildUndergroundLayerFromGlb(loader) {
  if (undergroundRoot) {
    scene.remove(undergroundRoot);
    undergroundRoot.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  undergroundRoot = new THREE.Group();
  undergroundRoot.name = "underground";
  ugPickable = [];

  const gltf = await new Promise((resolve, reject) => {
    loader.load("./intel_city/intel_city_underground.glb?v=5", resolve, undefined, reject);
  });

  const root = gltf.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.name || o.parent?.name || "";
    const type = ugTypeFromName(name);
    if (!type) return;
    const asset = findUgAsset(name) || {
      id: name,
      type,
      label: type.replace(/_/g, " "),
      depth_m: 2,
      status: "active",
      ulpin: name,
      mesh_name: name,
    };
    const isStruct = type === "underground_parking" || type === "basement";
    o.userData.isUnderground = true;
    o.userData.ugKind = isStruct ? "structure" : "utility";
    o.userData.ugType = type;
    o.userData.ugId = asset.id || name;
    o.userData.asset = asset;
    o.castShadow = false;
    o.receiveShadow = false;
    o.renderOrder = 2;
    o.frustumCulled = true;

    // Solid bright utility colors under the raised city
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = isStruct;
      m.opacity = isStruct ? 0.55 : 1.0;
      m.depthWrite = !isStruct;
      m.side = THREE.DoubleSide;
      // Bias UG meshes so they never z-fight the city slab if they get close
      m.polygonOffset = true;
      m.polygonOffsetFactor = isStruct ? 2 : 1;
      m.polygonOffsetUnits = isStruct ? 2 : 1;
      if (m.color && UG_COLORS[type] != null) m.color.setHex(UG_COLORS[type]);
      m.needsUpdate = true;
    }
    ugPickable.push(o);
  });

  undergroundRoot.add(root);
  scene.add(undergroundRoot);
  applyUgVisibility();
  return {
    utilities: (undergroundReg.utilities || []).length,
    structures: (undergroundReg.structures || []).length,
    meshes: ugPickable.length,
  };
}

/** Tag the big land/road slabs that block the under-city view. */
function tagCityBaseMeshes(root) {
  cityBaseMeshes = [];
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || "";
    // Exact-ish land layers — avoid matching building names like "2floor_long"
    const nameHit =
      /^Floor/i.test(n) ||
      /^Plane/i.test(n) ||
      /^Grass_/i.test(n) ||
      /City_Road/i.test(n) ||
      /soccer_field/i.test(n) ||
      /_road_0$/i.test(n) ||
      /Asphalt/i.test(n) ||
      /terrain/i.test(n) ||
      /ground/i.test(n);
    box.setFromObject(o);
    box.getSize(size);
    const footprint = size.x * size.z;
    const thin = size.y < 85;
    const hugeSlab = thin && footprint > 1.2e6;
    if (nameHit || hugeSlab) {
      o.userData.isCityBase = true;
      cityBaseMeshes.push(o);
    }
  });
  console.info("[intel_city] city base slabs tagged", cityBaseMeshes.length);
}

/** Lift city so underground pipes sit under the still-visible base. */
function applyCityCutaway(on) {
  if (!cityRoot) return;
  ugLiftY = on ? Math.max(55, Math.min(95, cityRadius * 0.045)) : 0;
  cityRoot.position.y = ugLiftY;
  if (footprintGroup) footprintGroup.position.y = ugLiftY;
  if (undergroundRoot) undergroundRoot.position.y = 0;
  // Keep land/road base visible — look under the lifted slab, don't hide it
  for (const m of cityBaseMeshes) {
    m.visible = true;
  }
}

function applyUgVisibility() {
  if (!undergroundRoot) return;
  undergroundRoot.visible = ugVisible;
  applyCityCutaway(ugVisible);

  if (controls) {
    if (ugVisible) {
      // Free orbit — including under the base
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.enablePan = !citizenMode;
    } else {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.495;
      if (!citizenMode) controls.enablePan = true;
    }
  }
  const chips = document.getElementById("ug-chips");
  if (chips) chips.style.display = ugVisible ? "flex" : "none";
  const btn = document.getElementById("btn-ug");
  if (btn) btn.classList.toggle("primary", ugVisible);

  for (const mesh of ugPickable) {
    const t = mesh.userData.ugType;
    const kind = mesh.userData.ugKind;
    let on = ugVisible;
    if (kind === "structure") on = on && ugTypeEnabled.structure;
    else on = on && !!ugTypeEnabled[t];
    mesh.visible = on;
  }
}

function setUgVisible(on) {
  if (citizenMode) on = false;
  ugVisible = on;
  applyUgVisibility();
  flyTarget = null;
}

function roomsForBuilding(buildingId) {
  const entry = (interiorReg.buildings || []).find(
    (b) => b.building_id === buildingId || b.id === buildingId
  );
  return entry?.rooms || [];
}

function restoreBuildingShell() {
  for (const s of shellHidden) {
    if (s.mesh) s.mesh.visible = s.visible;
  }
  shellHidden = [];
}

function hideBuildingShell(buildingId) {
  restoreBuildingShell();
  const rt = buildingRuntime.get(buildingId);
  if (!rt) return;
  for (const mesh of rt.meshes) {
    shellHidden.push({ mesh, visible: mesh.visible });
    mesh.visible = false;
  }
}

function placeInteriorAtFloor(buildingId, floor) {
  const ent = interiorByBuilding.get(buildingId);
  if (!ent?.allMeshes?.length) return null;

  // Hide every building's interior group; show only the active plate
  for (const [bid, other] of interiorByBuilding) {
    if (other.group) other.group.visible = false;
    for (const m of other.allMeshes || []) m.visible = false;
  }
  for (const m of ent.allMeshes) {
    const isCeil = /-CEIL$/i.test(m.name) || m.userData.interiorKind === "ceiling";
    m.visible = !isCeil;
  }

  const rt = buildingRuntime.get(buildingId);
  const y0 = rt?.box?.min?.y ?? 0;
  const ySpan = Math.max(rt?.size?.y ?? 8, 8);
  const n = Math.max(rt?.building?.floors?.length || 1, 1);
  const idx = floor?.floor_index ?? 0;
  const y = floor?.elevation_base != null ? Number(floor.elevation_base) : y0 + (idx / n) * ySpan;

  const g = ent.group;
  if (g) {
    // Fill ~88% of this building's footprint. Soft-cap only runaway tower AABBs.
    g.position.set(0, y, 0);
    g.scale.setScalar(1);
    if (rt?.center && rt?.size && ent.plateSize) {
      const kind = rt.building?.kind || "midrise";
      const softMax = kind === "lowrise" ? 160 : kind === "skyscraper" ? 110 : 140;
      const fit = 0.88;
      const tx = Math.min(rt.size.x * fit, softMax);
      const tz = Math.min(rt.size.z * fit, softMax);
      const sx = tx / Math.max(ent.plateSize.x, 1e-3);
      const sz = tz / Math.max(ent.plateSize.z, 1e-3);
      const s = Math.min(Math.max(Math.min(sx, sz), 0.5), 4.5);
      if (Math.abs(s - 1) > 0.03) {
        const cx = rt.center.x;
        const cz = rt.center.z;
        g.scale.setScalar(s);
        g.position.set(cx * (1 - s), y, cz * (1 - s));
      }
    }
    g.visible = true;
  }
  if (interiorRoot) interiorRoot.visible = true;
  return ent;
}

async function ensureInteriorsLoaded(loader) {
  if (interiorLoaded) return true;
  if (interiorLoading) return interiorLoading;
  interiorLoading = (async () => {
    if (!(interiorReg.buildings || []).length) {
      const res = await fetch("./intel_city/intel_city_interiors.json?v=6");
      if (!res.ok) throw new Error(`interiors JSON ${res.status}`);
      interiorReg = await res.json();
    }

    if (interiorRoot) {
      scene.remove(interiorRoot);
      interiorRoot.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
    }
    interiorRoot = new THREE.Group();
    interiorRoot.name = "interiors";
    interiorRoot.visible = false;
    interiorRoot.position.set(0, 0, 0);
    interiorByBuilding.clear();

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        "./intel_city/intel_city_interiors.glb?v=6",
        resolve,
        undefined,
        reject
      );
    });
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const metaByBuilding = new Map();
    for (const b of interiorReg.buildings || []) {
      metaByBuilding.set(b.building_id || b.id, b);
    }

    // Per-building groups so we can lift/scale one plate without moving others
    const pending = new Map(); // bid → meshes[]
    root.traverse((c) => {
      if (!c.isMesh) return;
      const rm = /^INT-(\d+)/.exec(c.name);
      if (!rm) return;
      const bid = `INTEL-BLDG-${String(parseInt(rm[1], 10)).padStart(3, "0")}`;
      if (!pending.has(bid)) pending.set(bid, []);
      pending.get(bid).push(c);
    });

    for (const [bid, meshes] of pending) {
      const meta = metaByBuilding.get(bid);
      const g = new THREE.Group();
      g.name = `interior-${bid}`;
      g.visible = false;
      // Keep world positions while reparenting into the group
      for (const c of meshes) {
        g.attach(c);
        c.visible = false;
        c.userData.isInterior = true;
        c.userData.buildingId = bid;
        if (/-CEIL$/i.test(c.name)) c.userData.interiorKind = "ceiling";
      }
      interiorRoot.add(g);

      const roomMeshes = [];
      const pickable = [];
      for (const c of meshes) {
        const roomMeta = (meta?.rooms || []).find(
          (r) => c.name === r.mesh_name || c.name.startsWith(`${r.mesh_name}-`)
        );
        if (roomMeta && c.name === roomMeta.mesh_name) {
          c.userData.roomType = roomMeta.type;
          c.userData.roomId = roomMeta.id;
          c.userData.roomLabel = roomMeta.label;
          c.userData.asset = roomMeta;
          roomMeshes.push(c);
          pickable.push(c);
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const mat of mats) {
            if (!mat) continue;
            const clone = mat.clone();
            if (ROOM_COLORS[roomMeta.type] != null) clone.color?.setHex(ROOM_COLORS[roomMeta.type]);
            clone.side = THREE.DoubleSide;
            clone.needsUpdate = true;
            c.material = clone;
          }
        } else if (roomMeta) {
          c.userData.roomType = roomMeta.type;
          c.userData.roomId = roomMeta.id;
        }
      }

      // Authored plate size (Blender XY → Three XZ)
      let plateSize = null;
      const pb = meta?.plate_blender;
      if (pb?.min && pb?.max) {
        plateSize = {
          x: Math.abs(pb.max[0] - pb.min[0]),
          z: Math.abs(pb.max[1] - pb.min[1]),
        };
      } else {
        const box = new THREE.Box3().setFromObject(g);
        const size = box.getSize(new THREE.Vector3());
        plateSize = { x: size.x, z: size.z };
      }

      interiorByBuilding.set(bid, {
        group: g,
        rooms: meta?.rooms || [],
        roomMeshes,
        pickable,
        allMeshes: meshes,
        plateSize,
      });
    }

    // Drop empty GLTF wrappers
    if (root.parent === interiorRoot) {
      /* meshes already attached to groups */
    }
    scene.add(interiorRoot);
    interiorLoaded = true;
    console.info("[intel_city] interiors ready", interiorReg.meta, "buildings", interiorByBuilding.size);
    return true;
  })();
  try {
    return await interiorLoading;
  } catch (e) {
    interiorLoading = null;
    console.warn("[intel_city] interiors load failed", e);
    return false;
  }
}

function setHint(msg) {
  const el = document.getElementById("hint");
  if (!el) return;
  if (!msg) {
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = msg;
  el.classList.add("show");
}

function showPlaceholderPanel() {
  panelEl.classList.remove("open");
  panelEl.innerHTML = `
    <div class="placeholder">
      <p><b>Right inspector</b> — click a building floor in the 3D view to open ownership, deeds, and rooms.</p>
      <p>Then use <b>Exterior</b> / <b>Cutaway</b> here to inspect Blender rooms (kitchen, living, …).</p>
      <p style="margin:0;font-size:11px">Keys: <kbd>1</kbd> Exterior · <kbd>2</kbd> Cutaway · <kbd>U</kbd> Underground</p>
    </div>`;
}

function syncInteriorToolbar() {
  if (interiorView === "interior") interiorView = "cutaway";
  panelEl.querySelectorAll(".view-btn[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === interiorView);
  });
  panelEl.querySelectorAll("[data-ilayer]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ilayer === interiorView);
  });
}

async function setInteriorView(mode) {
  if (mode === "interior") mode = "cutaway";
  const pick = selectedData;
  const needFloor = mode !== "exterior";
  if (needFloor && (!pick || pick.kind !== "floor")) {
    setHint("Select a <b>building floor</b> in the 3D view first — then use Cutaway in the <b>right panel</b>.");
    return false;
  }
  if (needFloor && (pick.building?.kind === "stadium" || pick.building?.kind === "construction")) {
    setHint("Cutaway is for residential buildings (lowrise / midrise / skyscraper).");
    return false;
  }

  const loader = window.__intelLoader;
  if (mode !== "exterior") {
    // GLB is preloaded with the city — only show a hint if still pending
    if (!interiorLoaded) setHint("Opening rooms…");
    const ok = loader ? await ensureInteriorsLoaded(loader) : interiorLoaded;
    if (!ok) {
      setHint("Room models failed to load. Hard-refresh and try again.");
      return false;
    }
  }

  interiorView = mode;
  syncInteriorToolbar();
  applyCitizenZoomLimits(mode !== "exterior");

  if (mode === "exterior") {
    if (interiorRoot) interiorRoot.visible = false;
    for (const [, ent] of interiorByBuilding) {
      if (ent.group) {
        ent.group.visible = false;
        ent.group.position.set(0, 0, 0);
        ent.group.scale.setScalar(1);
      }
      for (const m of ent.allMeshes || []) m.visible = false;
    }
    restoreBuildingShell();
    if (pick?.kind === "floor") {
      flyToPick(pick);
      showPanel(pick);
      setHint("Exterior · Orbit the building · <kbd>2</kbd> Cutaway");
    } else {
      setHint("");
    }
    return true;
  }

  if (ugVisible) setUgVisible(false);

  const buildingId = pick.buildingId || pick.building?.id;
  const floor = pick.floor || pick.building?.floors?.[0];
  hideBuildingShell(buildingId);
  const ent = placeInteriorAtFloor(buildingId, floor);
  if (!ent) {
    setHint("No interior floorplate for this building yet.");
    restoreBuildingShell();
    interiorView = "exterior";
    return false;
  }
  if (interiorRoot) interiorRoot.visible = true;

  const rt = buildingRuntime.get(buildingId);
  const look = rt?.center.clone() || new THREE.Vector3();
  look.y = (ent.group?.position.y || 0) + 14;
  let dist = citizenMode ? Math.max(48, (citizenStartDist || 70) * 0.72) : 90;
  flyTarget = {
    pos: new THREE.Vector3(look.x + dist * 0.7, look.y + dist * 0.55, look.z + dist * 0.62),
    look,
  };
  setHint("Cutaway · Rooms from above · Click room chips in the right panel · <kbd>1</kbd> Exterior");
  showPanel(pick);
  return true;
}

window.__setView = (mode) => {
  setInteriorView(mode);
};

window.__highlightRoom = (roomId) => {
  const bid = selectedData?.buildingId || selectedData?.building?.id;
  if (!bid) {
    setHint("Select a floor first.");
    return;
  }
  const go = async () => {
    if (interiorView === "exterior") await setInteriorView("cutaway");
    else if (selectedData?.kind === "floor") {
      hideBuildingShell(bid);
      placeInteriorAtFloor(bid, selectedData.floor || selectedData.building?.floors?.[0]);
      if (interiorRoot) interiorRoot.visible = true;
    }
    flyToRoom(bid, roomId);
    panelEl.querySelectorAll("#room-chips .chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.room === roomId);
    });
  };
  go();
};

/** Room meshes have verts in world space and Object3D at origin — never use getWorldPosition(). */
function roomLookTarget(ent, mesh, meta) {
  const look = new THREE.Vector3();
  let radius = 18;
  if (ent?.group) ent.group.updateMatrixWorld(true);
  if (mesh) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) {
      box.getCenter(look);
      const size = box.getSize(new THREE.Vector3());
      radius = Math.max(14, 0.7 * Math.max(size.x, size.z, 10));
      look.y += Math.max(3, Math.min(size.y * 0.35, 10));
      return { look, radius };
    }
  }
  if (meta?.aabb_blender) {
    const a = blenderAabbToThree(meta.aabb_blender);
    look.copy(a.center);
    if (ent?.group) look.applyMatrix4(ent.group.matrixWorld);
    radius = Math.max(14, 0.7 * Math.max(a.size.x, a.size.z, 10));
    look.y += Math.max(3, Math.min(a.size.y * 0.2, 10));
    return { look, radius };
  }
  return null;
}

function flyToRoom(buildingId, roomId) {
  const ent = interiorByBuilding.get(buildingId);
  if (!ent) {
    setHint("No interior for this building yet.");
    return;
  }
  if (selectedData?.kind === "floor") {
    hideBuildingShell(buildingId);
    placeInteriorAtFloor(buildingId, selectedData.floor || selectedData.building?.floors?.[0]);
    if (interiorRoot) interiorRoot.visible = true;
  }
  const mesh = ent.roomMeshes.find((m) => m.userData.roomId === roomId || m.name === roomId);
  const meta = ent.rooms.find((r) => r.id === roomId);
  const target = roomLookTarget(ent, mesh, meta);
  if (!target) return;

  const { look, radius } = target;
  const rt = buildingRuntime.get(buildingId);
  let outward = new THREE.Vector3(1, 0, 1);
  if (rt?.center) {
    outward.set(look.x - rt.center.x, 0, look.z - rt.center.z);
    if (outward.lengthSq() < 1e-3) outward.set(1, 0, 1);
  }
  outward.normalize();
  flyTarget = {
    pos: new THREE.Vector3(
      look.x + outward.x * radius * 1.15,
      look.y + radius * 0.5,
      look.z + outward.z * radius * 1.15
    ),
    look,
  };
  setMeshGlow(ent.roomMeshes, false);
  if (mesh) setMeshGlow([mesh], true, 0x0ea5a8);
  setHint(`Room · ${meta?.label || roomId} · <kbd>2</kbd> Cutaway · <kbd>1</kbd> Exterior`);
}

function getGltfLoader() {
  return window.__intelLoader || null;
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

function ensureUniqueMaterials(mesh) {
  // Shared GLB materials: mutating emissive was painting half the city blue
  if (mesh.userData.matsCloned) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const cloned = mats.map((m) => (m && m.clone ? m.clone() : m));
  mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  mesh.userData.matsCloned = true;
}

function rememberEmissive(mesh) {
  ensureUniqueMaterials(mesh);
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
    if (!mesh || mesh.userData.isCityBase) continue;
    rememberEmissive(mesh);
    const saved = meshOrigEmissive.get(mesh) || [];
    for (const s of saved) {
      if (!s.m?.emissive) continue;
      if (on) {
        s.m.emissive.setHex(colorHex);
        s.m.emissiveIntensity = 0.35;
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

/** Drop giant land slabs from hover/select so glow can't paint the whole map. */
function isGiantLandMesh(mesh) {
  if (!mesh?.isMesh) return false;
  if (mesh.userData.isCityBase) return true;
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  return size.y < 90 && size.x * size.z > 800000;
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
    if (isGiantLandMesh(mesh)) continue;
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
  const viewport = document.getElementById("viewport") || wrap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec4e8);

  camera = new THREE.PerspectiveCamera(42, viewport.clientWidth / viewport.clientHeight, 1, 20000);
  camera.position.set(1200, 900, 1600);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    // Large city + coplanar grass/roads — cuts z-fighting flicker
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.zoomSpeed = 1.15;
  controls.panSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minPolarAngle = 0.05;
  controls.addEventListener("start", () => {
    flyTarget = null;
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x8a9a6a, 0.55));

  sun = new THREE.DirectionalLight(0xfff1d6, 1.65);
  sun.position.set(1400, 2200, 900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 1.4;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
  fill.position.set(-900, 600, -700);
  scene.add(fill);

  window.addEventListener("resize", resizeViewport);
  document.getElementById("btn-reset").addEventListener("click", resetView);
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => zoomBy(1.35));
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => zoomBy(1 / 1.35));
  document.getElementById("btn-top")?.addEventListener("click", topView);
  document.getElementById("btn-sat-compare")?.addEventListener("click", () => setSatCompare(!satCompareOn));
  document.getElementById("btn-sat-close")?.addEventListener("click", () => setSatCompare(false));
  document.getElementById("btn-ug")?.addEventListener("click", () => setUgVisible(!ugVisible));
  // Interior modes live only in the right panel (society-style) — not in left HUD
  document.querySelectorAll("#ug-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.ug;
      if (!key) return;
      ugTypeEnabled[key] = !ugTypeEnabled[key];
      btn.classList.toggle("active", ugTypeEnabled[key]);
      applyUgVisibility();
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") resetView();
    if (e.key === "Escape") {
      if (satCompareOn) setSatCompare(false);
      else closePanel();
    }
    if (e.key === "+" || e.key === "=") zoomBy(1 / 1.25);
    if (e.key === "-" || e.key === "_") zoomBy(1.25);
    if (e.key === "u" || e.key === "U") {
      if (!citizenMode) setUgVisible(!ugVisible);
    }
    if (e.key === "1") setInteriorView("exterior");
    if (e.key === "2") setInteriorView("cutaway");
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
  if (citizenMode) {
    resetView();
    return;
  }
  const dist = Math.min(controls.maxDistance * 0.85, cityRadius * 4.2);
  controls.target.copy(cityCenter);
  camera.position.set(cityCenter.x, cityCenter.y + dist, cityCenter.z + dist * 0.08);
  controls.update();
}

function resizeViewport() {
  const viewport = document.getElementById("viewport") || document.getElementById("wrap");
  if (!viewport || !camera || !renderer) return;
  const w = Math.max(1, viewport.clientWidth);
  const h = Math.max(1, viewport.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function setSatCompare(on) {
  if (citizenMode) on = false;
  satCompareOn = !!on;
  const wrap = document.getElementById("wrap");
  const btn = document.getElementById("btn-sat-compare");
  wrap?.classList.toggle("compare-on", satCompareOn);
  btn?.classList.toggle("primary", satCompareOn);
  if (satCompareOn) {
    topView();
    setHint("Compare mode · <b>3D top view</b> (left) vs <b>satellite orthophoto</b> (right). Esc closes.");
  }
  // Layout change needs a frame before measuring viewport size
  requestAnimationFrame(() => {
    resizeViewport();
    requestAnimationFrame(resizeViewport);
  });
}

function citizenVisualBox(rt) {
  const box = new THREE.Box3();
  let any = false;
  for (const m of rt.meshes || []) {
    if (!m) continue;
    box.expandByObject(m);
    any = true;
  }
  if (!any || box.isEmpty()) {
    return { box: rt.box, size: rt.size.clone(), center: rt.center.clone() };
  }
  return {
    box,
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
  };
}

/** Start distance so the house fills ~60% of the view (screenshot framing). */
function citizenFitDistance(size) {
  const height = Math.max(size.y, 28);
  const slim = Math.min(size.x, size.z);
  const fov = THREE.MathUtils.degToRad(camera?.fov || 42);
  const isTower = height > 180;
  if (isTower) {
    const fill = 0.68;
    return (height * 0.5) / Math.tan(fov * 0.5) / fill;
  }
  // Midrise / mall AABBs are often inflated — keep the close 3/4 street frame
  return THREE.MathUtils.clamp(height * 0.58 + slim * 0.04, 56, 78);
}

/** Exterior stays outside the facade; cutaway may move in for rooms. */
function applyCitizenZoomLimits(cutaway) {
  if (!citizenMode || !controls) return;
  const start = citizenStartDist || 70;
  controls.minDistance = cutaway ? start * 0.55 : start * 0.92;
  controls.maxDistance = start * 2.5;
}

/**
 * Citizen portal mode: frame their property. Neighbours stay visible.
 * Default zoom matches a 3/4 street view — house fills most of the frame.
 */
function applyCitizenLock(buildingId) {
  const rt = buildingRuntime.get(buildingId);
  if (!rt) {
    setHint("Citizen twin needs a valid ULPIN for <b>your</b> property.");
    return false;
  }
  citizenMode = true;
  lockedBuildingId = buildingId;
  const vis = citizenVisualBox(rt);
  const floorPt = selectedData?.point;
  lockCenter.copy(vis.center);
  if (floorPt) {
    lockCenter.x = floorPt.x;
    lockCenter.z = floorPt.z;
  }
  const height = Math.max(vis.size.y, 28);
  const dist = citizenFitDistance(vis.size);
  citizenStartDist = dist;
  lockRadius = Math.max(dist * 0.55, 48);

  for (const [, other] of buildingRuntime) {
    for (const m of other.meshes || []) {
      m.visible = true;
      if (m.userData) m.userData.citizenHidden = false;
    }
    if (other.outline) other.outline.visible = true;
  }
  showOutline(buildingId);

  controls.enablePan = false;
  applyCitizenZoomLimits(false);
  homeTarget.copy(lockCenter);
  const dir = new THREE.Vector3(1.0, 0.9, 1.08).normalize();
  homeCam.copy(lockCenter).addScaledVector(dir, dist);
  homeCam.y = Math.max(homeCam.y, lockCenter.y + height * 0.12);
  flyTarget = null;
  camera.position.copy(homeCam);
  controls.target.copy(homeTarget);
  controls.update();

  const ugBtn = document.getElementById("btn-ug");
  if (ugBtn) ugBtn.style.display = "none";
  const topBtn = document.getElementById("btn-top");
  if (topBtn) topBtn.style.display = "none";
  const satBtn = document.getElementById("btn-sat-compare");
  if (satBtn) satBtn.style.display = "none";
  setSatCompare(false);
  const chips = document.getElementById("ug-chips");
  if (chips) chips.style.display = "none";

  const house = selectedData?.unit;
  const badge = document.getElementById("badge");
  if (badge) {
    const floorBit = lockedFloorLabel ? ` · F${lockedFloorLabel}` : "";
    const houseBit = house?.unit_label ? ` · House ${house.unit_label}` : "";
    badge.innerHTML = `<b>My house</b> · ${esc(rt.building?.name || buildingId)}${floorBit}${houseBit}`;
  }
  const sub = document.querySelector("#hud .sub");
  if (sub) {
    sub.innerHTML =
      `<b>Citizen view</b> — focused on your house. Neighbours stay in view. Exterior or Cutaway in the right panel.<br/>Keys: <kbd>1</kbd> Exterior · <kbd>2</kbd> Cutaway`;
  }
  setHint("Your house · orbit / zoom freely · <kbd>1</kbd> Exterior · <kbd>2</kbd> Cutaway");
  return true;
}

function resolveBuildingIdFromUlpin(ulpin) {
  if (!ulpin) return null;
  for (const [bid, rt] of buildingRuntime) {
    const b = rt.building;
    if (b.ulpin === ulpin) return bid;
    if ((b.floors || []).some((f) => {
      if (f.ulpin === ulpin) return true;
      return (f.units || []).some((u) => u.ulpin === ulpin);
    })) return bid;
  }
  return null;
}

function clampToCity() {
  const t = controls.target;
  if (citizenMode && lockedBuildingId) {
    const maxOff = lockRadius * 0.22;
    t.x = THREE.MathUtils.clamp(t.x, lockCenter.x - maxOff, lockCenter.x + maxOff);
    t.z = THREE.MathUtils.clamp(t.z, lockCenter.z - maxOff, lockCenter.z + maxOff);
    if (ugVisible) {
      const yLo = lockCenter.y - lockRadius * 2.5;
      const yHi = lockCenter.y + lockRadius * 1.4 + ugLiftY;
      t.y = THREE.MathUtils.clamp(t.y, yLo, yHi);
      camera.position.y = THREE.MathUtils.clamp(
        camera.position.y,
        lockCenter.y - lockRadius * 3,
        lockCenter.y + lockRadius * 3 + ugLiftY
      );
    } else {
      const yLo = lockCenter.y - lockRadius * 0.55;
      const yHi = lockCenter.y + lockRadius * 1.2;
      t.y = THREE.MathUtils.clamp(t.y, yLo, yHi);
      const minY = lockCenter.y - lockRadius * 0.45;
      if (camera.position.y < minY) camera.position.y = minY;
    }
    const offset = camera.position.clone().sub(t);
    const minD = controls?.minDistance || citizenStartDist * 0.92;
    if (offset.length() < minD && offset.length() > 1e-4) {
      offset.setLength(minD);
      camera.position.copy(t).add(offset);
    }
    return;
  }
  const maxOff = cityRadius * 1.35;
  t.x = THREE.MathUtils.clamp(t.x, cityCenter.x - maxOff, cityCenter.x + maxOff);
  t.z = THREE.MathUtils.clamp(t.z, cityCenter.z - maxOff, cityCenter.z + maxOff);
  if (ugVisible) {
    // Free roam under / around the lifted base — no hard floor lock
    const yLo = cityCenter.y - cityRadius * 2.8;
    const yHi = cityCenter.y + ugLiftY + cityRadius * 1.5;
    t.y = THREE.MathUtils.clamp(t.y, yLo, yHi);
    camera.position.y = THREE.MathUtils.clamp(
      camera.position.y,
      cityCenter.y - cityRadius * 3.2,
      cityCenter.y + ugLiftY + cityRadius * 4
    );
  } else {
    t.y = THREE.MathUtils.clamp(t.y, cityCenter.y - cityRadius * 0.25, cityCenter.y + cityRadius * 0.85);
    const minY = cityCenter.y + cityRadius * 0.02;
    if (camera.position.y < minY) camera.position.y = minY;
  }
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
      // Clear any leftover hover emissive on shared mats
      if (m.emissive) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
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

  if (ugVisible && ugPickable.length) {
    const ugHits = raycaster.intersectObjects(ugPickable.filter((m) => m.visible), false);
    if (ugHits.length) {
      const hit = ugHits[0];
      const mesh = hit.object;
      const asset = mesh.userData.asset;
      const ugBid = asset?.building_id || null;
      // Citizen: only utilities tagged to this building (or untagged near lock)
      if (citizenMode && lockedBuildingId && ugBid && ugBid !== lockedBuildingId) {
        /* fall through to building pick */
      } else if (!citizenMode || !lockedBuildingId || !ugBid || ugBid === lockedBuildingId) {
        return {
          kind: "underground",
          ugKind: mesh.userData.ugKind,
          ugType: mesh.userData.ugType,
          asset,
          meshes: [mesh],
          point: hit.point,
          buildingId: ugBid,
          ulpin: asset?.ulpin || asset?.id,
        };
      }
    }
  }

  if (interiorView !== "exterior" && interiorRoot?.visible) {
    const picks = [];
    for (const [bid, ent] of interiorByBuilding) {
      if (citizenMode && lockedBuildingId && bid !== lockedBuildingId) continue;
      if (!ent.group?.visible) continue;
      picks.push(...(ent.pickable || []));
    }
    if (picks.length) {
      const hits = raycaster.intersectObjects(picks, false);
      if (hits.length) {
        const mesh = hits[0].object;
        const bid = mesh.userData.buildingId;
        if (citizenMode && lockedBuildingId && bid !== lockedBuildingId) return null;
        return {
          kind: "room",
          buildingId: bid,
          building: buildingRuntime.get(bid)?.building,
          floor: selectedData?.floor,
          roomId: mesh.userData.roomId,
          roomLabel: mesh.userData.roomLabel,
          roomType: mesh.userData.roomType,
          meshes: [mesh],
          point: hits[0].point,
          ulpin: mesh.userData.asset?.ulpin,
        };
      }
    }
  }

  const hits = raycaster.intersectObjects(pickableMeshes, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const mesh = hit.object;
  const bid = mesh.userData.buildingId;
  if (citizenMode && lockedBuildingId && bid !== lockedBuildingId) return null;
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
    if (!isSel) {
      const glow =
        pick.kind === "underground" ? 0xf59e0b
          : pick.kind === "room" ? 0x0ea5a8
            : 0x2a9bb0;
      setMeshGlow(hoverMeshes, true, glow);
    }
    if (pick.buildingId) showOutline(pick.buildingId);
    else hideOutline();
  }
  if (pick.kind === "underground") {
    const a = pick.asset || {};
    tip.innerHTML = `<div><b>${esc(a.label || a.type || "Underground")}</b></div>
      <div class="t-owner">${esc((a.type || "").replace(/_/g, " "))} · ${esc(a.depth_m ?? "—")} m depth</div>
      <div class="t-ulpin">${esc(a.ulpin || a.id || "")}</div>`;
  } else if (pick.kind === "room") {
    tip.innerHTML = `<div><b>${esc(pick.roomLabel || pick.roomType || "Room")}</b></div>
      <div class="t-owner">${esc(pick.building?.name || "")} · interior</div>
      <div class="t-ulpin">${esc(pick.ulpin || pick.roomId || "")}</div>`;
  } else if (pick.kind === "stadium") {
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
  if (citizenMode && lockedBuildingId && pick.buildingId && pick.buildingId !== lockedBuildingId) {
    setHint("Citizen twin is locked to <b>your</b> property only.");
    return;
  }
  if (pick.kind === "room") {
    // Keep floor selection context; zoom into room
    if (selectedData?.kind === "floor") {
      selectedData = { ...selectedData, roomId: pick.roomId };
    }
    setMeshGlow(selectedMeshes, false);
    selectedMeshes = pick.meshes;
    setMeshGlow(selectedMeshes, true, 0x0ea5a8);
    flyToRoom(pick.buildingId, pick.roomId);
    if (selectedData?.kind === "floor") showPanel(selectedData);
    return;
  }
  const prevLabel = selectedData?.unit?.unit_label;
  if (pick.kind === "floor") attachHouse(pick, pick.unit?.ulpin, prevLabel);
  if (selectedMeshes.length) setMeshGlow(selectedMeshes, false);
  selectedMeshes = pick.meshes;
  selectedData = pick;
  setMeshGlow(selectedMeshes, true, pick.kind === "underground" ? 0xf59e0b : 0x0ea5a8);
  if (pick.buildingId) showOutline(pick.buildingId);
  else hideOutline();
  if (interiorView !== "exterior" && pick.kind === "floor") {
    // Switching floors while inside — re-place plate
    setInteriorView(interiorView);
  } else {
    flyToPick(pick);
    showPanel(pick);
  }
}

function flyToPick(pick) {
  if (pick.kind === "underground") {
    const look = pick.point ? pick.point.clone() : new THREE.Vector3();
    // Side angle in the open gap — avoid staring into the slab underside
    const y = ugVisible
      ? look.y + Math.max(30, ugLiftY * 0.35)
      : look.y + 40;
    look.y = Math.min(look.y + 10, y);
    flyTarget = {
      pos: new THREE.Vector3(look.x + 260, y, look.z + 220),
      look,
    };
    return;
  }
  const rt = buildingRuntime.get(pick.buildingId);
  if (!rt) return;
  const vis = citizenVisualBox(rt);
  const radius = 0.55 * Math.max(vis.size.x, vis.size.z, 80);
  const look = pick.point ? pick.point.clone() : vis.center.clone();
  if (pick.floor) {
    const y0 = vis.box.min.y;
    const ySpan = Math.max(vis.size.y, 8);
    const idx = pick.floor.floor_index ?? 0;
    const n = pick.building.floors.length;
    look.y = y0 + ((idx + 0.5) / Math.max(n, 1)) * ySpan;
  }
  const dir = new THREE.Vector3(1.0, 0.9, 1.08).normalize();
  let dist = citizenMode
    ? citizenFitDistance(vis.size)
    : Math.max(70, radius * 1.45);
  if (citizenMode && controls) dist = Math.min(dist, controls.maxDistance * 0.95);
  flyTarget = {
    pos: look.clone().add(dir.multiplyScalar(dist)),
    look,
  };
}

function selectFloorOnBuilding(buildingId, floorLabel, unitUlpin) {
  if (citizenMode && lockedBuildingId && buildingId !== lockedBuildingId) {
    setHint("Citizen twin is locked to <b>your</b> property only.");
    return;
  }
  if (citizenMode && lockedFloorLabel && String(floorLabel) !== String(lockedFloorLabel)) {
    setHint("Citizen twin is locked to <b>your floor</b> only.");
    return;
  }
  const rt = buildingRuntime.get(buildingId);
  if (!rt) return;
  const floor = rt.building.floors.find((f) => f.floor_label === floorLabel);
  if (!floor) return;
  const sameFloor =
    selectedData?.buildingId === buildingId &&
    String(selectedData?.floorLabel) === String(floor.floor_label);
  const y0 = rt.box.min.y;
  const ySpan = Math.max(rt.size.y, 8);
  const idx = floor.floor_index ?? 0;
  const n = rt.building.floors.length;
  const point = rt.center.clone();
  point.y = y0 + ((idx + 0.5) / Math.max(n, 1)) * ySpan;
  const pick = {
    kind: "floor",
    building: rt.building,
    floor,
    meshes: rt.meshes,
    point,
    buildingId,
    floorLabel: floor.floor_label,
    owner: floor.owner,
    ulpin: floor.ulpin,
  };
  attachHouse(
    pick,
    unitUlpin || (citizenMode ? lockedUnitUlpin : null),
    unitUlpin ? null : selectedData?.unit?.unit_label,
  );
  if (selectedMeshes.length) setMeshGlow(selectedMeshes, false);
  selectedMeshes = pick.meshes;
  selectedData = pick;
  setMeshGlow(selectedMeshes, true, 0x0ea5a8);
  showOutline(buildingId);
  if (interiorView !== "exterior") setInteriorView(interiorView);
  else if (sameFloor) showPanel(pick);
  else {
    flyToPick(pick);
    showPanel(pick);
  }
}

function closePanel() {
  if (selectedMeshes.length) setMeshGlow(selectedMeshes, false);
  selectedMeshes = [];
  const wasInterior = interiorView !== "exterior";
  selectedData = null;
  hideOutline();
  if (wasInterior) {
    interiorView = "exterior";
    if (interiorRoot) interiorRoot.visible = false;
    for (const [, ent] of interiorByBuilding) {
      if (ent.group) {
        ent.group.visible = false;
        ent.group.position.set(0, 0, 0);
        ent.group.scale.setScalar(1);
      }
      for (const m of ent.allMeshes || []) m.visible = false;
    }
    restoreBuildingShell();
  }
  if (citizenMode && lockedBuildingId) {
    const rt = buildingRuntime.get(lockedBuildingId);
    if (rt) {
      selectedMeshes = rt.meshes.slice();
      setMeshGlow(selectedMeshes, true, 0x0ea5a8);
      showOutline(lockedBuildingId);
      const floor = lockedFloorLabel
        ? rt.building?.floors?.find((f) => String(f.floor_label) === String(lockedFloorLabel))
        : rt.building?.floors?.[0];
      const unit = lockedUnitUlpin
        ? (floor?.units || []).find((u) => u.ulpin === lockedUnitUlpin)
        : null;
      selectedData = {
        kind: rt.building?.floors?.length ? "floor" : "stadium",
        building: rt.building,
        floor,
        unit: unit || undefined,
        meshes: rt.meshes,
        point: rt.center.clone(),
        buildingId: lockedBuildingId,
        floorLabel: floor?.floor_label,
        owner: unit?.owner || floor?.owner,
        ulpin: unit?.ulpin || floor?.ulpin || rt.building?.ulpin,
      };
      showPanel(selectedData);
      setHint("Your house · <kbd>1</kbd> Exterior · <kbd>2</kbd> Cutaway");
      return;
    }
  }
  showPlaceholderPanel();
  setHint("City overview · Click a floor · use the <b>right panel</b> for Cutaway");
}

function showPanel(data) {
  if (!data) {
    showPlaceholderPanel();
    return;
  }
  panelEl.classList.add("open");
  if (data.kind === "underground") {
    const a = data.asset || {};
    const typeLabel = (a.type || "asset").replace(/_/g, " ");
    const linked = a.building_name
      ? `<div class="row"><span>Linked building</span><br/><b>${esc(a.building_name)}</b> · ${esc(a.building_kind || "")}</div>
         <div class="row"><span>Building ULPIN</span><br/><code>${esc(a.building_id || "")}</code></div>`
      : `<div class="row"><span>Network</span><br/>City utility corridor</div>`;
    const spaces = a.spaces != null
      ? `<div class="stat"><div class="v">${esc(a.spaces)}</div><div class="k">Parking spaces</div></div>`
      : `<div class="stat"><div class="v">${esc(a.levels ?? "—")}</div><div class="k">Levels</div></div>`;
    panelEl.innerHTML = `
      <a class="close" id="panel-close">Close</a>
      <h2>${esc(a.label || typeLabel)}</h2>
      <div class="breadcrumb"><b>City</b> → Underground → ${esc(typeLabel)}</div>
      <div class="ulpin" id="ulpin-copy" title="Click to copy">${esc(a.ulpin || a.id || "")}</div>
      <div class="banner">Subsurface asset — conflict-aware planning layer for DoLR 3D twin.</div>
      <div class="grid">
        <div class="stat"><div class="v">${esc(a.depth_m ?? "—")} m</div><div class="k">Depth</div></div>
        ${spaces}
      </div>
      <h3>Classification</h3>
      <div class="row"><span>Type</span><br/><b>${esc(typeLabel)}</b></div>
      <div class="row"><span>Status</span><br/><span class="badge ok">${esc(a.status || "active")}</span></div>
      ${linked}
    `;
    wirePanel(data);
    return;
  }
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
  const rec = houseRecord(f, data.unit);
  const prev = (rec.previous_owners || []).map((p) =>
    `<li><b>${esc(p.name)}</b><br/><span>${esc(p.from)} → ${esc(p.to)}</span></li>`
  ).join("");
  const chips = (citizenMode && lockedFloorLabel
    ? (b.floors || []).filter((fl) => String(fl.floor_label) === String(lockedFloorLabel))
    : (b.floors || [])
  ).map((fl) =>
    `<button type="button" class="chip ${fl.floor_label === f.floor_label ? "active" : ""}" data-floor="${esc(fl.floor_label)}">F${esc(fl.floor_label)}</button>`
  ).join("");
  const utils = (rec.utilities || []).map((u) => `<i>${esc(u)}</i>`).join("");
  const banner = b.kind === "construction"
    ? `<div class="banner">WIP structure — vertical parcel <b>pre-assigned</b> for cadastral continuity.</div>`
    : "";
  const canInterior = b.kind === "lowrise" || b.kind === "midrise" || b.kind === "skyscraper";
  const rooms = roomsForBuilding(b.id);
  const roomChips = rooms.map((r) =>
    `<button type="button" class="chip" data-room="${esc(r.id)}">${esc(r.label || r.type)}</button>`
  ).join("");
  const units = citizenMode && lockedUnitUlpin
    ? (f.units || []).filter((u) => u.ulpin === lockedUnitUlpin)
    : (f.units || []);
  const activeUlpin = data.unit?.ulpin;
  const housesHtml = units.length
    ? `<h3>${citizenMode ? "Your house" : "Houses on this floor"}</h3>
    <div class="house-list">
      ${units.map((u) => {
        const on = u.ulpin === activeUlpin;
        return `<button type="button" class="house-card${on ? " active" : ""}" data-unit="${esc(u.ulpin)}">
          <b>House ${esc(u.unit_label || "?")}</b>
          <div class="ulpin" style="font-size:10px;margin-top:4px">${esc(u.ulpin)}</div>
          <div style="margin-top:4px;font-size:13px">${esc(u.owner || "—")}</div>
          <div style="font-size:11px;opacity:.7">${esc(u.legal_status || "registered")}${u.area_sq_m != null ? ` · ${esc(u.area_sq_m)} m²` : ""}</div>
        </button>`;
      }).join("")}
    </div>`
    : `<div class="owner">${esc(f.owner)}</div>
    <div class="owner-id">${esc(f.owner_id || "")}</div>`;
  const houseBit = data.unit?.unit_label ? ` · House ${esc(data.unit.unit_label)}` : "";
  const houseCrumb = data.unit?.unit_label ? ` → House ${esc(data.unit.unit_label)}` : "";

  panelEl.innerHTML = `
    <a class="close" id="panel-close">Close</a>
    <h2>${esc(b.name)} · Floor ${esc(f.floor_label)}${houseBit}</h2>
    <div class="breadcrumb"><b>${citizenMode ? "My house" : "City"}</b> → ${esc(b.name)} → Floor ${esc(f.floor_label)}${houseCrumb}</div>
    <div class="ulpin" id="ulpin-copy" title="Click to copy">${esc(data.unit?.ulpin || f.ulpin)}</div>
    ${banner}
    ${housesHtml}
    <div class="grid">
      <div class="stat"><div class="v">${esc(rec.carpet ?? "—")} m²</div><div class="k">Carpet</div></div>
      <div class="stat"><div class="v">${esc(rec.built_up ?? "—")} m²</div><div class="k">Built-up</div></div>
      <div class="stat"><div class="v">${esc(rec.area ?? "—")} m²</div><div class="k">Parcel area</div></div>
      <div class="stat"><div class="v">${esc(data.unit?.unit_label || units.length || 1)}</div><div class="k">${data.unit ? "This house" : "Houses"}</div></div>
    </div>
    <h3>Registration</h3>
    <div class="row"><span>Owner</span><br/><b>${esc(data.unit?.owner || f.owner)}</b></div>
    <div class="row"><span>Status</span><br/><span class="badge ${statusClass(rec.legal_status)}">${esc(rec.legal_status)}</span></div>
    <div class="row"><span>Registered on</span><br/><b>${esc(rec.registered_on)}</b></div>
    <div class="row"><span>Office</span><br/>${esc(rec.registration_office)}</div>
    <div class="row"><span>Deed</span><br/><code>${esc(rec.deed_no)}</code></div>
    <h3>Previous owners</h3>
    <ul class="timeline">${prev || "<li>—</li>"}</ul>
    <h3>Use &amp; assessment</h3>
    <div class="row"><span>Use</span><br/><b>${esc(rec.use)}</b></div>
    <div class="row"><span>Tax</span><br/>${esc(rec.tax)}</div>
    <div class="row"><span>Encumbrance</span><br/>${esc(rec.encumbrance)}</div>
    <h3>Utilities</h3>
    <div class="util">${utils}</div>
    <h3>${citizenMode ? "Your floor" : "Jump floor"}</h3>
    <div class="chips" id="floor-chips">${chips}</div>
    ${canInterior ? `
    <h3>Inspect view</h3>
    <div class="view-controls">
      <button type="button" class="view-btn ${interiorView === "exterior" ? "active" : ""}" data-view="exterior">Exterior</button>
      <button type="button" class="view-btn ${interiorView === "cutaway" ? "active" : ""}" data-view="cutaway">Cutaway</button>
    </div>
    <h3>Rooms — click to zoom</h3>
    <div class="chips" id="room-chips">${roomChips || "<span style='font-size:12px;opacity:.7'>No room metadata</span>"}</div>
    <div class="keys-inline"><kbd>1</kbd> Exterior · <kbd>2</kbd> Cutaway · rooms are Blender meshes fitted to this building</div>
    ` : `<div class="banner" style="margin-top:12px">No interior floorplate for this landmark / WIP kind.</div>`}
    <div class="row" style="margin-top:12px;color:var(--text-dim);font-size:11px">${esc(rec.notes || "")}</div>
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
    const text = data.kind === "stadium"
      ? data.building.ulpin
      : data.kind === "underground"
        ? (data.asset?.ulpin || data.asset?.id || data.ulpin)
        : data.unit?.ulpin || data.floor?.ulpin || data.ulpin;
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
  panelEl.querySelectorAll(".house-card[data-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectFloorOnBuilding(
        data.buildingId || data.building.id,
        data.floorLabel || data.floor?.floor_label,
        btn.dataset.unit,
      );
    });
  });
  panelEl.querySelectorAll(".view-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setInteriorView(btn.dataset.view);
    });
  });
  panelEl.querySelectorAll("[data-ilayer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setInteriorView(btn.dataset.ilayer);
    });
  });
  panelEl.querySelectorAll("#room-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.__highlightRoom(btn.dataset.room);
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
  window.__intelLoader = loader;

  // Prefetch interiors metadata so room chips appear before GLB load
  try {
    const iRes = await fetch("./intel_city/intel_city_interiors.json?v=6");
    if (iRes.ok) interiorReg = await iRes.json();
  } catch (_) {}

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
  tagCityBaseMeshes(cityRoot);
  scene.add(cityRoot);

  await new Promise((r) => requestAnimationFrame(r));
  setProgress(93, "Tagging buildings from Blender map…");
  const { buildings: n, tagged } = applyBuildingRegistry(cityRoot);
  console.info("[intel_city] registry", registry.meta, "tagged meshes", tagged);

  setProgress(95, "Loading underground…");
  let ugCounts = { utilities: 0, structures: 0, meshes: 0 };
  try {
    const ugRes = await fetch("./intel_city/intel_city_underground.json?v=7");
    if (ugRes.ok) {
      undergroundReg = await ugRes.json();
      ugCounts = await buildUndergroundLayerFromGlb(loader);
      console.info("[intel_city] underground", undergroundReg.meta, ugCounts);
    }
  } catch (e) {
    console.warn("[intel_city] underground load failed", e);
  }

  setProgress(97, "Loading room models…");
  try {
    await ensureInteriorsLoaded(loader);
  } catch (e) {
    console.warn("[intel_city] interiors preload failed", e);
  }

  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98, "Framing city…");
  frameCity(computeCoreBounds(cityRoot));

  const params = new URLSearchParams(location.search);
  const wantCitizen = params.get("mode") === "citizen" || params.get("lock") === "1";
  if (params.get("ug") === "1" && !wantCitizen) setUgVisible(true);
  else setUgVisible(false);

  document.getElementById("loading").style.display = "none";
  document.getElementById("badge").innerHTML =
    `<b>Intel City</b> · ${n} buildings · UG ${ugCounts.meshes || ugCounts.utilities + ugCounts.structures} · interiors ${interiorReg.meta?.building_count || 0}`;
  const sub = document.querySelector("#hud .sub");
  if (sub) {
    sub.innerHTML =
      `Left = camera tools · <b>Right panel</b> = ownership + Exterior/Cutaway.<br/>Keys: <kbd>1</kbd>/<kbd>2</kbd> views · <kbd>U</kbd> underground · <kbd>+</kbd>/<kbd>−</kbd> zoom · <kbd>Esc</kbd> clear`;
  }
  setHint("Click a building floor — inspect in the <b>right panel</b>");

  focusUlpinFromQuery();
  if (wantCitizen) {
    const ulpin = params.get("ulpin");
    const bid =
      selectedData?.buildingId ||
      resolveBuildingIdFromUlpin(ulpin);
    if (bid) {
      applyCitizenLock(bid);
    } else {
      setHint("Citizen twin requires your property ULPIN — open from the portal <b>My Property</b> page.");
      document.getElementById("badge").innerHTML = `<b>Citizen twin</b> · ULPIN required`;
    }
  }
  if (params.get("interior") === "1" && !wantCitizen) {
    setTimeout(() => {
      if (selectedData?.kind === "floor") setInteriorView("cutaway");
    }, 600);
  }
  draco.dispose();
}

/** Portal deep-link: /viewer3d/intel_city.html?ulpin=…&mode=citizen */
function focusUlpinFromQuery() {
  const params = new URLSearchParams(location.search);
  const ulpin = params.get("ulpin");
  if (!ulpin) return;
  const wantCitizen = params.get("mode") === "citizen" || params.get("lock") === "1";
  for (const [, rt] of buildingRuntime) {
    const b = rt.building;
    if (b.ulpin === ulpin) {
      if (wantCitizen) lockedFloorLabel = b.floors?.[0]?.floor_label || lockedFloorLabel;
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
    const unitFloor = (b.floors || []).find((f) => (f.units || []).some((u) => u.ulpin === ulpin));
    const floor = unitFloor || (b.floors || []).find((f) => f.ulpin === ulpin);
    if (floor) {
      const unit = (floor.units || []).find((u) => u.ulpin === ulpin);
      if (wantCitizen) {
        lockedFloorLabel = floor.floor_label;
        if (unit) lockedUnitUlpin = unit.ulpin;
      }
      selectFloorOnBuilding(b.id, floor.floor_label);
      return;
    }
  }
  if (wantCitizen || citizenMode) return;
  for (const mesh of ugPickable) {
    const a = mesh.userData.asset;
    if (a && (a.ulpin === ulpin || a.id === ulpin)) {
      setUgVisible(true);
      selectPick({
        kind: "underground",
        ugKind: mesh.userData.ugKind,
        ugType: mesh.userData.ugType,
        asset: a,
        meshes: [mesh],
        point: mesh.getWorldPosition(new THREE.Vector3()),
        buildingId: a.building_id || null,
        ulpin: a.ulpin || a.id,
      });
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
