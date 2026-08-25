"""
One-time converter:
  bhu-satya-polygons.geojson (local XY) -> demo_society.json (metadata-only).

This does NOT generate geometry. Geometry is served via static3d/bhu_demo.glb.
The JSON is used for labels/IDs/heights and future ULPIN mapping.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_GEOJSON = ROOT.parents[0] / "bhu-satya-polygons.geojson"  # repo root
OUT_JSON = ROOT / "data" / "demo_society.json"

FLOOR_HEIGHT_M = 3.0


def ring_bounds(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def centroid(ring):
    # polygon centroid (simple average; good enough for labels/demo)
    pts = ring[:-1] if ring and ring[0] == ring[-1] else ring
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return cx, cy


def main() -> None:
    gj = json.loads(IN_GEOJSON.read_text(encoding="utf-8"))
    feats = gj.get("features", [])

    site = next((f for f in feats if f.get("properties", {}).get("kind") == "site_boundary"), None)
    if site:
        ring = site["geometry"]["coordinates"][0]
        minx, miny, maxx, maxy = ring_bounds(ring)
    else:
        # derive from buildings
        xs, ys = [], []
        for f in feats:
            if f.get("properties", {}).get("kind") != "building":
                continue
            ring = f["geometry"]["coordinates"][0]
            for x, y in ring:
                xs.append(x)
                ys.append(y)
        minx, miny, maxx, maxy = min(xs), min(ys), max(xs), max(ys)

    width = maxx - minx
    depth = maxy - miny

    buildings_out = []
    for f in feats:
        props = f.get("properties", {})
        if props.get("kind") != "building":
            continue
        bid = str(props.get("id")).strip()
        floors = int(props.get("simulated_floors") or 3)
        height_m = max(3.0, floors * FLOOR_HEIGHT_M)
        ring = f["geometry"]["coordinates"][0]
        cx, cy = centroid(ring)
        b_minx, b_miny, b_maxx, b_maxy = ring_bounds(ring)

        buildings_out.append(
            {
                "id": bid,
                "ulpin": bid,
                "name": bid,
                "type": "building",
                "status": "demo",
                "local_center_m": [cx, cy, 0.0],
                "footprint": {"shape": "polygon", "length_m": b_maxx - b_minx, "width_m": b_maxy - b_miny},
                "footprint_polygon_local_m": ring,
                "height": {"total_m": height_m},
                "vertical_parcel": {"base_elevation_m": 0.0, "top_elevation_m": height_m},
                "floor_count": floors,
                "unit_count": 0,
                "room_count": 0,
                "floors": [],
            }
        )

    society = {
        "meta": {
            "id": "SOC-BHU-DEMO-001",
            "name": "BHU Demo",
            "display_name": "BHU Demo — Polygon Buildings",
            "dataset_version": "0.1.0",
            "data_type": "local_xy_demo",
            "purpose": "BHU polygon extrusion + raise-one interaction demo",
            "origin": {"latitude": 0.0, "longitude": 0.0, "elevation_amsl_m": 0.0},
            "coordinate_reference_system": {"horizontal": "LOCAL_XY", "vertical": "LOCAL_Z", "epsg": None},
            "local_extent_m": {"width": width, "depth": depth},
            "notes": gj.get("metadata", {}),
            "assets": {"glb": "bhu_demo.glb"},
        },
        "declared_totals": {
            "total_buildings": len(buildings_out),
            "total_floors": sum(b["floor_count"] for b in buildings_out),
            "total_units": 0,
            "total_rooms": 0,
        },
        "buildings": buildings_out,
        "underground_infrastructure": [],
        "roads": [],
        "statistics": {"registered_units": 0},
        "ai_processing": {},
    }

    OUT_JSON.write_text(json.dumps(society, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[ok] wrote {OUT_JSON}")


if __name__ == "__main__":
    main()

