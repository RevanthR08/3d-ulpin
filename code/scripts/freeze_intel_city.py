"""
Freeze Intel city: DBSCAN 2D clustering + vertical strata,
write mesh_to_building map + footprint polygons + rich floor ULPIN JSON.
Run inside Blender (MCP or Scripting). JSON only by default (GLB already frozen).
"""
from __future__ import annotations

import json
import math
import os
from collections import defaultdict

import bpy
from mathutils import Vector

OUT_DIR = r"E:\sih3dplanner\cit_planner\code\app\static3d\intel_city"
JSON_PATH = os.path.join(OUT_DIR, "intel_city_buildings.json")
BOUNDS_PATH = os.path.join(OUT_DIR, "bounds.json")
GLB_PATH = os.path.join(OUT_DIR, "intel_city.glb")

FLOOR_H = 3.2
PINCODE = "600001"
DBSCAN_EPS = 90.0

SKIP_SUBSTR = (
    "road", "parking", "car", "beigecar", "bluecar", "greycar", "van_",
    "tree", "leaf", "bark", "grass_grass", "track", "bench",
    "conditioner", "cylinder", "watch", "drone", "train002", "null_",
    "all_white", "hotdog", "rotating_sculpture", "viewer",
    "stage2", "main_connections", "politika", "soccer_field",
    "floor_double_bool", "plane_2_rooftop",
    "windows_1_building_rooftop", "cube_5_main grey", "cube_1_creme",
    "cube_front", "boole_1_shiny", "tunnel_entrance", "cartel_",
    "box82_1", "tribune_corner_00_matte grey_0.001",
)

OWNERS = [
    "Ananya Krishnan", "Dhruv Gupta", "Meera Iyer", "Arjun Patel",
    "Sneha Reddy", "Karthik Subramanian", "Priya Nair", "Rohan Mehta",
    "Lakshmi Narayan", "Vikram Singh", "Fatima Begum", "Suresh Rao",
    "Nisha Verma", "Aditya Sharma", "Kavitha Menon", "Imran Ali",
    "Deepa Krishnamurthy", "Harsh Vardhan", "Pooja Desai", "Nikhil Joshi",
]
PREV_OWNERS = [
    "R. Venkatesh", "S. Balaji", "Chitra Devi", "Mohammed Farooq",
    "Helen Thomas", "Gopalakrishnan", "Uma Maheshwari", "Joseph Antony",
]
OFFICES = [
    "Chennai Central Sub-Registrar",
    "T. Nagar Sub-Registrar",
    "Guindy Sub-Registrar",
    "Egmore Sub-Registrar",
]
USES = [
    "Residential — 1BHK", "Residential — 2BHK", "Residential — 3BHK",
    "Residential — Studio", "Commercial — Retail", "Commercial — Office",
    "Mixed Use — Live/Work", "Institutional — Clinic",
]
STATUSES = ["registered", "registered", "registered", "mortgage", "registered", "under dispute"]

NAMES = {
    "skyscraper": ["Glass Spire", "Horizon Tower", "Meridian Peak", "Azure Column",
                   "Skyline Hub", "North Needle", "Coral Spire", "Harbor Crown"],
    "midrise": ["Harbour Block", "Lotus Residences", "Crescent Court", "Maple Plaza",
                "Indigo Quarters", "Cedar Walk", "Pearl Court", "Amber Residences"],
    "lowrise": ["Corner Shop Row", "Garden Walk", "Lane House", "Studio Annex",
                "Parcel Cottage", "Bazaar Lane", "Court Villa", "Pocket Flat"],
    "construction": ["Under-Construction Tower", "WIP Shell A", "Site Crane Parcel"],
    "stadium": ["City Stadium"],
}


def world_bb(o):
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [v.x for v in bb]
    ys = [v.y for v in bb]
    zs = [v.z for v in bb]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def should_skip(name: str) -> bool:
    low = name.lower()
    return any(s in low for s in SKIP_SUBSTR)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def seeded(n: int) -> int:
    return (n * 1103515245 + 12345) & 0x7FFFFFFF


def kind_for(h: float, name: str, forced: str | None = None) -> str:
    if forced:
        return forced
    low = name.lower()
    if "crane" in low:
        return "construction"
    if "tribune" in low:
        return "stadium"
    if h >= 280:
        return "skyscraper"
    if h >= 90:
        return "midrise"
    return "lowrise"


def floor_count(kind: str, h: float) -> int:
    if kind == "stadium":
        return 0
    n = int(round(h / FLOOR_H))
    if kind == "skyscraper":
        return clamp(n, 12, 40)
    if kind == "midrise":
        return clamp(n, 4, 12)
    if kind == "construction":
        return clamp(max(n, 2), 2, 12)
    return clamp(n, 1, 4)


def pretty_name(kind: str, idx: int) -> str:
    opts = NAMES.get(kind, ["City Parcel"])
    return opts[idx % len(opts)]


def make_floors(bidx: int, kind: str, n: int, zmin: float, zmax: float, footprint_area: float):
    floors = []
    span = max(zmax - zmin, FLOOR_H * max(n, 1))
    step = span / max(n, 1)
    for i in range(n):
        seed = seeded(bidx * 1000 + i)
        owner = OWNERS[seed % len(OWNERS)]
        prev = PREV_OWNERS[(seed // 7) % len(PREV_OWNERS)]
        year = 2008 + (seed % 16)
        month = 1 + (seed % 12)
        day = 1 + (seed % 27)
        reg_year = year + 1 + (seed % 5)
        if reg_year > 2025:
            reg_year = 2024
        area = max(45.0, round(footprint_area * (0.55 + (seed % 40) / 100.0), 1))
        if area > 420:
            area = round(120 + (seed % 180), 1)
        built = round(area * 0.89, 1)
        carpet = round(area * 0.78, 1)
        tax = int(8000 + area * 180 + (seed % 5000))
        status = STATUSES[seed % len(STATUSES)]
        base = zmin + i * step
        top = zmin + (i + 1) * step
        floors.append({
            "floor_label": str(i + 1),
            "ulpin": f"3D-IND-{PINCODE}-I{bidx}-L{i + 1}",
            "elevation_base": round(base, 3),
            "elevation_top": round(top, 3),
            "floor_index": i,
            "floor_t0": round(i / max(n, 1), 4),
            "floor_t1": round((i + 1) / max(n, 1), 4),
            "owner": owner,
            "owner_id": f"AADHAAR-DEMO-****{1000 + (seed % 9000)}",
            "registered_on": f"{reg_year:04d}-{month:02d}-{day:02d}",
            "registration_office": OFFICES[seed % len(OFFICES)],
            "deed_no": f"DOC/{reg_year}/CHN/{20000 + (seed % 70000)}",
            "legal_status": status,
            "previous_owners": [{
                "name": prev,
                "from": f"{year:04d}-{month:02d}-{day:02d}",
                "to": f"{reg_year:04d}-{month:02d}-{max(1, day - 1):02d}",
            }],
            "area_sq_m": area,
            "built_up_sq_m": built,
            "carpet_sq_m": carpet,
            "use": USES[seed % len(USES)],
            "tax_assessment": f"₹{tax:,} / yr",
            "encumbrance": (
                "Clear (EC verified 2025)" if status == "registered"
                else ("Mortgage lien — Axis Bank" if status == "mortgage"
                      else "Lis pendens — civil suit pending")
            ),
            "utilities": ["EB", "Metro water", "Sewer"] if kind != "construction"
            else ["Temporary EB", "Site water"],
            "notes": (
                "WIP structure — vertical parcel pre-assigned"
                if kind == "construction"
                else "Vertical parcel linked to surface ULPIN parent"
            ),
        })
    return floors


def convex_hull_2d(points: list[tuple[float, float]]) -> list[list[float]]:
    """Andrew's monotone chain. Returns closed-ish list of [x,y] (not closed)."""
    pts = sorted(set((round(p[0], 4), round(p[1], 4)) for p in points))
    if len(pts) <= 1:
        return [[p[0], p[1]] for p in pts]
    if len(pts) == 2:
        return [[pts[0][0], pts[0][1]], [pts[1][0], pts[1][1]]]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    return [[float(x), float(y)] for x, y in hull]


def collect_candidates():
    """All building-like meshes with disc representation for DBSCAN."""
    items = []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        if should_skip(o.name):
            continue
        xmin, xmax, ymin, ymax, zmin, zmax = world_bb(o)
        h = zmax - zmin
        w = xmax - xmin
        d = ymax - ymin
        faces = len(o.data.polygons)
        low = o.name.lower()

        forced = None
        if "tribune" in low and ".001" not in low:
            forced = "stadium"
        elif "crane004" in low:
            forced = "construction"

        if forced is None:
            if h < 12:
                continue
            if w < 15 or d < 15:
                continue
            if faces < 4:
                continue
            # city-spanners / flat decoration
            if w > 900 or d > 900:
                continue
            if w * d > 700_000 and h < 200:
                continue

        cx = (xmin + xmax) / 2
        cy = (ymin + ymax) / 2
        radius = 0.6 * max(w, d)
        if forced == "stadium":
            radius = min(radius, 420.0)
            # clamp stadium footprint for outline
            half = 420.0
            xmin, xmax = cx - half, cx + half
            ymin, ymax = cy - half, cy + half
            w = d = half * 2
            zmax = min(zmax, zmin + 80)
            h = zmax - zmin
            radius = half * 0.6
        elif forced == "construction":
            half_w = min(220.0, max(80.0, w * 0.35))
            half_d = min(220.0, max(80.0, d * 0.35))
            xmin, xmax = cx - half_w, cx + half_w
            ymin, ymax = cy - half_d, cy + half_d
            w, d = half_w * 2, half_d * 2
            radius = 0.6 * max(w, d)

        items.append({
            "name": o.name,
            "xmin": xmin, "xmax": xmax, "ymin": ymin, "ymax": ymax,
            "zmin": zmin, "zmax": zmax,
            "h": h, "w": w, "d": d, "faces": faces,
            "cx": cx, "cy": cy, "radius": radius,
            "forced": forced,
            "corners": [
                (xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax),
            ],
        })
    return items


def dbscan_2d(items, eps: float = DBSCAN_EPS):
    """
    DBSCAN on 2D centroids. Two meshes join if discs overlap OR centroid dist < eps.
    min_samples=1 → every point is a core (no noise).
    """
    n = len(items)
    if n == 0:
        return []

    def linked(i, j):
        a, b = items[i], items[j]
        dist = math.hypot(a["cx"] - b["cx"], a["cy"] - b["cy"])
        if dist < eps:
            return True
        if dist < (a["radius"] + b["radius"]):
            return True
        return False

    # adjacency
    neighbors = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            # forced stadium/construction stay alone until tagged later
            if items[i]["forced"] or items[j]["forced"]:
                continue
            if linked(i, j):
                neighbors[i].append(j)
                neighbors[j].append(i)

    labels = [-1] * n
    cluster_id = 0
    for i in range(n):
        if labels[i] != -1:
            continue
        if items[i]["forced"]:
            labels[i] = cluster_id
            cluster_id += 1
            continue
        # BFS expand
        labels[i] = cluster_id
        queue = [i]
        while queue:
            u = queue.pop()
            for v in neighbors[u]:
                if labels[v] == -1:
                    labels[v] = cluster_id
                    queue.append(v)
        cluster_id += 1

    groups = defaultdict(list)
    for i, lab in enumerate(labels):
        groups[lab].append(items[i])
    return list(groups.values())


def split_vertical_strata(parts: list) -> list[list]:
    """
    Split rooftop-only thin meshes into sub-buildings if they sit well above
    the main ground mass. Merge back if footprint is inside a taller sibling.
    """
    if len(parts) <= 1:
        return [parts]

    tallest = max(parts, key=lambda p: p["h"])
    ground_zmax = tallest["zmax"]
    main = []
    roofies = []
    for p in parts:
        thin = (p["zmax"] - p["zmin"]) < 60
        elevated = p["zmin"] > (tallest["zmin"] + 40) and p["zmax"] < ground_zmax + 5
        if thin and elevated and p is not tallest and p["forced"] is None:
            roofies.append(p)
        else:
            main.append(p)

    if not roofies:
        return [parts]

    # Try merge roofies back if XY footprint sits inside main footprint
    mx0 = min(p["xmin"] for p in main)
    mx1 = max(p["xmax"] for p in main)
    my0 = min(p["ymin"] for p in main)
    my1 = max(p["ymax"] for p in main)
    mz0 = min(p["zmin"] for p in main)
    mz1 = max(p["zmax"] for p in main)

    kept_main = list(main)
    orphan_roofs = []
    for r in roofies:
        inside_xy = (r["cx"] >= mx0 and r["cx"] <= mx1 and r["cy"] >= my0 and r["cy"] <= my1)
        height_overlap = not (r["zmax"] < mz0 or r["zmin"] > mz1 + 80)
        if inside_xy and height_overlap:
            kept_main.append(r)
        else:
            orphan_roofs.append([r])

    return [kept_main] + orphan_roofs


def finalize_cluster(parts, forced_kind=None):
    if not parts:
        return None
    xmin = min(p["xmin"] for p in parts)
    xmax = max(p["xmax"] for p in parts)
    ymin = min(p["ymin"] for p in parts)
    ymax = max(p["ymax"] for p in parts)
    zmin = min(p["zmin"] for p in parts)
    zmax = max(p["zmax"] for p in parts)
    h = zmax - zmin
    w = xmax - xmin
    d = ymax - ymin

    if forced_kind not in {"stadium", "construction"}:
        if w > 900 or d > 900:
            return None
        if h < 15:
            return None

    kind = kind_for(h, parts[0]["name"], forced_kind)
    corners = []
    for p in parts:
        corners.extend(p["corners"])
    poly = convex_hull_2d(corners)
    if len(poly) < 3:
        poly = [
            [xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax],
        ]

    return {
        "parts": parts,
        "mesh_names": [p["name"] for p in parts],
        "xmin": xmin, "xmax": xmax, "ymin": ymin, "ymax": ymax,
        "zmin": zmin, "zmax": zmax, "h": h, "w": w, "d": d,
        "kind": kind,
        "footprint_polygon": poly,
    }


def cluster_buildings(items):
    raw_groups = dbscan_2d(items, eps=DBSCAN_EPS)
    clusters = []

    for group in raw_groups:
        forced = None
        for p in group:
            if p["forced"]:
                forced = p["forced"]
                break

        if forced:
            c = finalize_cluster(group, forced_kind=forced)
            if c:
                clusters.append(c)
            continue

        for sub in split_vertical_strata(group):
            c = finalize_cluster(sub)
            if c:
                clusters.append(c)

    return clusters


def build_registry(clusters):
    order = {"skyscraper": 0, "midrise": 1, "construction": 2, "lowrise": 3, "stadium": 4}
    clusters = sorted(clusters, key=lambda c: (order.get(c["kind"], 9), -c["h"]))

    buildings = []
    mesh_to_building = {}

    for i, c in enumerate(clusters, start=1):
        cx = (c["xmin"] + c["xmax"]) / 2
        cy = (c["ymin"] + c["ymax"]) / 2
        cz = (c["zmin"] + c["zmax"]) / 2
        footprint_area = max(55.0, min(380.0, (c["w"] * c["d"]) / 8000.0))
        n = floor_count(c["kind"], c["h"])
        bid = f"INTEL-BLDG-{i:03d}"

        if c["kind"] == "stadium":
            name = "City Stadium"
        elif c["kind"] == "construction":
            name = "Under-Construction Tower"
        else:
            name = pretty_name(c["kind"], i - 1)

        b = {
            "id": bid,
            "name": name,
            "kind": c["kind"],
            "ulpin": f"3D-IND-{PINCODE}-I{i}",
            "mesh_names": c["mesh_names"],
            "aabb_blender": {
                "min": [round(c["xmin"], 3), round(c["ymin"], 3), round(c["zmin"], 3)],
                "max": [round(c["xmax"], 3), round(c["ymax"], 3), round(c["zmax"], 3)],
                "center": [round(cx, 3), round(cy, 3), round(cz, 3)],
            },
            "size_blender": {
                "x": round(c["w"], 3),
                "y": round(c["d"], 3),
                "z": round(c["h"], 3),
            },
            "footprint_polygon": [
                [round(x, 3), round(y, 3)] for x, y in c["footprint_polygon"]
            ],
            "floors": make_floors(i, c["kind"], n, c["zmin"], c["zmax"], footprint_area),
        }
        buildings.append(b)
        for mn in c["mesh_names"]:
            mesh_to_building[mn] = bid

    return {
        "meta": {
            "pincode": PINCODE,
            "coord_space": "blender_world_xyz_zup",
            "three_note": "glTF Y-up: aabb_blender x→x, z→y, y→-z; footprint_polygon [[x,y],...] → Three (x, groundY, -y)",
            "floor_height_m": FLOOR_H,
            "building_count": len(buildings),
            "floor_count": sum(len(b["floors"]) for b in buildings),
            "source": "blender_dbscan_v2",
            "dbscan_eps": DBSCAN_EPS,
        },
        "mesh_to_building": mesh_to_building,
        "buildings": buildings,
    }


def write_bounds_only():
    mins = [1e18, 1e18, 1e18]
    maxs = [-1e18, -1e18, -1e18]
    count = 0
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        xmin, xmax, ymin, ymax, zmin, zmax = world_bb(o)
        mins[0] = min(mins[0], xmin); maxs[0] = max(maxs[0], xmax)
        mins[1] = min(mins[1], ymin); maxs[1] = max(maxs[1], ymax)
        mins[2] = min(mins[2], zmin); maxs[2] = max(maxs[2], zmax)
        count += 1
    center = [(mins[i] + maxs[i]) / 2 for i in range(3)]
    size = [maxs[i] - mins[i] for i in range(3)]
    with open(BOUNDS_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "mesh_count": count,
            "min": mins, "max": maxs, "center": center, "size": size,
        }, f, indent=2)
    print("BOUNDS", BOUNDS_PATH)


def export_glb():
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format="JPEG",
        export_jpeg_quality=88,
        export_extras=False,
        export_animations=False,
    )
    write_bounds_only()
    print("GLB", GLB_PATH, "bytes", os.path.getsize(GLB_PATH) if os.path.exists(GLB_PATH) else 0)


def main(do_export=False):
    os.makedirs(OUT_DIR, exist_ok=True)
    items = collect_candidates()
    print("CANDIDATES", len(items))
    clusters = cluster_buildings(items)
    print("CLUSTERS", len(clusters))
    registry = build_registry(clusters)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
    print("JSON", JSON_PATH)
    print("BUILDINGS", registry["meta"]["building_count"],
          "FLOORS", registry["meta"]["floor_count"],
          "MESH_MAP", len(registry["mesh_to_building"]))
    for b in registry["buildings"]:
        print(f"  {b['id']} {b['kind']:12} F{len(b['floors']):2} "
              f"poly={len(b['footprint_polygon'])} {b['name']} :: {b['mesh_names'][:2]}")
    if do_export:
        export_glb()
    else:
        write_bounds_only()
    print("DONE")


if __name__ == "__main__":
    main(do_export=False)
