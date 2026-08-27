"""
Generate Intel City underground registry from intel_city_buildings.json.
Utilities grid + parking (tall) / basement (lowrise). Plain Python — no Blender.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLDG_PATH = ROOT / "app" / "static3d" / "intel_city" / "intel_city_buildings.json"
OUT_PATH = ROOT / "app" / "static3d" / "intel_city" / "intel_city_underground.json"

PINCODE = "600001"
# Scene is large; multiply nominal metres so tubes/volumes are visible under towers.
DEPTH_SCALE = 12.0
FLOOR_H = 3.2 * DEPTH_SCALE  # ~one underground level thickness

UTIL_LAYERS = [
    {"type": "fiber_optic", "prefix": "UTIL-FIBER", "depth_m": 1.2, "diameter_m": 0.35, "label": "Broadband / fiber"},
    {"type": "electrical_cable", "prefix": "UTIL-ELEC", "depth_m": 1.8, "diameter_m": 0.45, "label": "Electrical"},
    {"type": "water_pipeline", "prefix": "UTIL-WATER", "depth_m": 3.0, "diameter_m": 0.55, "label": "Water"},
    {"type": "sewer", "prefix": "UTIL-SEWER", "depth_m": 4.5, "diameter_m": 0.7, "label": "Sewage"},
]

PARKING_KINDS = {"skyscraper", "midrise", "construction"}
BASEMENT_KINDS = {"lowrise"}


def round3(v: float) -> float:
    return round(float(v), 3)


def city_bounds(buildings: list) -> tuple[float, float, float, float, float]:
    """xmin, xmax, ymin, ymax, ground_z (min of aabb min z)."""
    xs, ys, zs = [], [], []
    for b in buildings:
        aabb = b["aabb_blender"]
        xs.extend([aabb["min"][0], aabb["max"][0]])
        ys.extend([aabb["min"][1], aabb["max"][1]])
        zs.append(aabb["min"][2])
    pad = 200.0
    return min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad, min(zs)


def grid_paths(xmin, xmax, ymin, ymax, z: float, step: float, axis: str) -> list[list[list[float]]]:
    """Axis-aligned polylines covering the city rectangle."""
    paths = []
    if axis == "x":
        y = ymin
        while y <= ymax + 1e-6:
            paths.append([[round3(xmin), round3(y), round3(z)], [round3(xmax), round3(y), round3(z)]])
            y += step
    else:
        x = xmin
        while x <= xmax + 1e-6:
            paths.append([[round3(x), round3(ymin), round3(z)], [round3(x), round3(ymax), round3(z)]])
            x += step
    return paths


def make_utilities(xmin, xmax, ymin, ymax, ground_z: float) -> list[dict]:
    utilities = []
    # Offset grids slightly so layers don't perfectly overlap in XY
    for i, layer in enumerate(UTIL_LAYERS):
        depth = layer["depth_m"] * DEPTH_SCALE
        z = ground_z - depth
        step = 380.0 + i * 40.0
        # Alternate primary axis; add a sparser cross set
        primary = "x" if i % 2 == 0 else "y"
        secondary = "y" if primary == "x" else "x"
        ox = (i % 3) * 45.0
        oy = (i % 2) * 55.0
        paths = grid_paths(xmin + ox, xmax + ox, ymin + oy, ymax + oy, z, step, primary)
        paths += grid_paths(xmin + ox, xmax + ox, ymin + oy, ymax + oy, z, step * 1.6, secondary)
        for j, path in enumerate(paths, start=1):
            utilities.append({
                "id": f"{layer['prefix']}-{j:03d}",
                "type": layer["type"],
                "label": layer["label"],
                "depth_m": layer["depth_m"],
                "depth_scene": round3(depth),
                "diameter_m": layer["diameter_m"] * DEPTH_SCALE * 0.35,
                "status": "active",
                "ownership": "city",
                "path_blender": path,
            })
    return utilities


def shrink_aabb(aabb: dict, xy_scale: float, levels: float, ground_z: float) -> dict:
    xmin, ymin, _zmin = aabb["min"]
    xmax, ymax, _zmax = aabb["max"]
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    hx = (xmax - xmin) * xy_scale / 2
    hy = (ymax - ymin) * xy_scale / 2
    # Cap absurd footprints from bad clustering
    hx = min(hx, 180.0)
    hy = min(hy, 180.0)
    # Always hang off city ground, not elevated mesh zmin
    top = ground_z - 2.0
    bottom = top - levels * FLOOR_H
    return {
        "min": [round3(cx - hx), round3(cy - hy), round3(bottom)],
        "max": [round3(cx + hx), round3(cy + hy), round3(top)],
        "center": [round3(cx), round3(cy), round3((top + bottom) / 2)],
    }


def building_index(ulpin: str) -> str:
    # 3D-IND-600001-I12 → 12
    if "-I" in ulpin:
        return ulpin.rsplit("-I", 1)[-1]
    return ulpin


def make_structures(buildings: list, ground_z: float) -> list[dict]:
    structures = []
    for b in buildings:
        kind = b.get("kind") or "lowrise"
        if kind == "stadium":
            continue
        bid = b["id"]
        idx = building_index(b["ulpin"])
        aabb = b["aabb_blender"]
        if kind in PARKING_KINDS:
            levels = 2.0 if kind == "skyscraper" else 1.5
            spaces = 80 if kind == "skyscraper" else (48 if kind == "midrise" else 24)
            ug_aabb = shrink_aabb(aabb, 0.72, levels, ground_z)
            structures.append({
                "id": f"UG-PARK-{idx}",
                "type": "underground_parking",
                "label": f"Parking — {b['name']}",
                "building_id": bid,
                "building_name": b["name"],
                "building_kind": kind,
                "ulpin": f"{b['ulpin']}-UG-P",
                "aabb_blender": ug_aabb,
                "spaces": spaces,
                "levels": levels,
                "status": "active",
                "depth_m": round3(levels * 3.2),
            })
        elif kind in BASEMENT_KINDS:
            ug_aabb = shrink_aabb(aabb, 0.78, 1.0, ground_z)
            structures.append({
                "id": f"UG-BASE-{idx}",
                "type": "basement",
                "label": f"Basement — {b['name']}",
                "building_id": bid,
                "building_name": b["name"],
                "building_kind": kind,
                "ulpin": f"{b['ulpin']}-UG-B",
                "aabb_blender": ug_aabb,
                "spaces": None,
                "levels": 1.0,
                "status": "active",
                "depth_m": 3.2,
            })
    return structures


def main():
    with open(BLDG_PATH, encoding="utf-8") as f:
        reg = json.load(f)
    buildings = reg.get("buildings") or []
    if not buildings:
        raise SystemExit("No buildings in registry")

    xmin, xmax, ymin, ymax, ground_z = city_bounds(buildings)
    utilities = make_utilities(xmin, xmax, ymin, ymax, ground_z)
    structures = make_structures(buildings, ground_z)

    out = {
        "meta": {
            "pincode": PINCODE,
            "coord_space": "blender_world_xyz_zup",
            "three_note": "glTF Y-up: x→x, z→y, y→-z",
            "source": "intel_city_underground_v1",
            "depth_scale": DEPTH_SCALE,
            "ground_z_blender": round3(ground_z),
            "utility_count": len(utilities),
            "structure_count": len(structures),
            "building_source": reg.get("meta", {}).get("source"),
        },
        "utilities": utilities,
        "structures": structures,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("WROTE", OUT_PATH)
    print("utilities", len(utilities), "structures", len(structures))
    by = {}
    for s in structures:
        by[s["type"]] = by.get(s["type"], 0) + 1
    print("structures_by_type", by)


if __name__ == "__main__":
    main()
