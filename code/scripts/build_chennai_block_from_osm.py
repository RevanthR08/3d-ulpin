"""
Build a VERTICA demo site GeoJSON for a Chennai (T. Nagar) block.

Sources:
  - OSM footprints + roads via Overpass (GOBS CSV download is not public)
  - Floors/height: OSM tags when present, else GOBS-style estimate
    floors = round_gobs(height_m / 3.0) with height from footprint heuristics

Outputs:
  code/data/labeled_sites/chennai_tnagar_block_a.geojson
  code/portal-web/public/data/chennai_tnagar_block_a.geojson (if present)
"""

from __future__ import annotations

import json
import math
import random
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # code/
OUT = ROOT / "data" / "labeled_sites" / "chennai_tnagar_block_a.geojson"
PORTAL = ROOT / "portal-web" / "public" / "data" / "chennai_tnagar_block_a.geojson"
RAW = ROOT / "data" / "_chennai_overpass_raw.json"

# T. Nagar, Chennai — dense mixed residential / commercial
SOUTH, WEST, NORTH, EAST = 13.0385, 80.2295, 13.0445, 80.2365
FLOOR_H_M = 3.0  # GOBS convention
CONF_MIN = 0.0
MAX_BUILDINGS = 180  # keep Blender scene manageable


def _overpass() -> dict:
    if RAW.is_file() and RAW.stat().st_size > 1000:
        return json.loads(RAW.read_text(encoding="utf-8"))

    query = f"""
[out:json][timeout:120];
(
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  relation["building"]({SOUTH},{WEST},{NORTH},{EAST});
  way["highway"~"^(primary|secondary|tertiary|residential|unclassified|service|living_street)$"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body;
>;
out skel qt;
"""
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
    ]
    last_err: Exception | None = None
    for url in endpoints:
        try:
            req = urllib.request.Request(
                url,
                data=query.encode("utf-8"),
                headers={"User-Agent": "VERTICA-SIH/1.0"},
            )
            print(f"Querying {url} ...")
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.load(resp)
            RAW.parent.mkdir(parents=True, exist_ok=True)
            RAW.write_text(json.dumps(data), encoding="utf-8")
            return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            print(f"  failed: {e}")
    raise RuntimeError(f"Overpass failed: {last_err}")


def _nodes_index(elements: list) -> dict[int, tuple[float, float]]:
    out: dict[int, tuple[float, float]] = {}
    for e in elements:
        if e.get("type") == "node":
            out[int(e["id"])] = (float(e["lon"]), float(e["lat"]))
    return out


def _way_ring(way: dict, nodes: dict[int, tuple[float, float]]) -> list[list[float]] | None:
    coords: list[list[float]] = []
    for nid in way.get("nodes") or []:
        pt = nodes.get(int(nid))
        if pt is None:
            return None
        coords.append([pt[0], pt[1]])
    if len(coords) < 3:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


def _ring_area_m2(ring: list[list[float]]) -> float:
    """Approximate polygon area via equirectangular local meters."""
    if len(ring) < 4:
        return 0.0
    lat0 = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))
    pts = [(p[0] * m_per_deg_lon, p[1] * m_per_deg_lat) for p in ring[:-1]]
    area = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) * 0.5


def _parse_height_m(tags: dict) -> float | None:
    h = tags.get("height") or tags.get("building:height")
    if h:
        try:
            return float(str(h).replace("m", "").strip())
        except ValueError:
            pass
    levels = tags.get("building:levels") or tags.get("levels")
    if levels:
        try:
            return float(str(levels).split(";")[0].strip()) * FLOOR_H_M
        except ValueError:
            pass
    return None


def _gobs_round_floors(height_m: float) -> int:
    """GOBS-style: round up only if fractional part >= 0.8."""
    raw = height_m / FLOOR_H_M
    whole = math.floor(raw)
    frac = raw - whole
    floors = whole + (1 if frac >= 0.8 else 0)
    return max(1, int(floors))


def _estimate_height_m(area_m2: float, tags: dict, rng: random.Random) -> float:
    """Heuristic height when OSM has no tag — produces villa / mid / high mix."""
    btype = (tags.get("building") or "yes").lower()
    if btype in {"house", "detached", "bungalow", "villa", "residential"} and area_m2 < 220:
        return rng.uniform(3.0, 7.5)
    if btype in {"apartments", "residential"} and area_m2 < 600:
        return rng.uniform(12.0, 28.0)
    if btype in {"commercial", "retail", "office"}:
        return rng.uniform(9.0, 36.0)
    if area_m2 < 120:
        return rng.uniform(3.0, 7.0)  # villa / low-rise
    if area_m2 < 350:
        return rng.uniform(9.0, 21.0)  # mid-rise
    if area_m2 < 900:
        return rng.uniform(18.0, 42.0)  # apartment block
    return rng.uniform(30.0, 72.0)  # high-rise footprint


def _typology(floors: int) -> tuple[str, str]:
    if floors <= 2:
        return "villa", "Low-rise · Villa"
    if floors <= 8:
        return "apartment", "Mid-rise · Apartment"
    return "highrise", "High-rise · Tower"


def _name_for(i: int, typology: str, tags: dict) -> str:
    if tags.get("name"):
        return str(tags["name"])[:48]
    prefixes = {
        "villa": ["Lotus", "Neem", "Mango", "Jasmine", "Palm"],
        "apartment": ["Marina", "Chettinad", "Kapaleeswarar", "Adyar", "Egmore"],
        "highrise": ["Bayview", "Coromandel", "Marina Tower", "Chola", "Pallava"],
    }
    p = prefixes[typology][i % len(prefixes[typology])]
    suffixes = {"villa": "Villa", "apartment": "Apartments", "highrise": "Heights"}
    return f"{p} {suffixes[typology]}"


def _landuse(tags: dict, typology: str) -> str:
    b = (tags.get("building") or "").lower()
    if b in {"commercial", "retail", "office", "yes"} and typology == "highrise":
        return "mixed"
    if b in {"commercial", "retail", "office"}:
        return "commercial"
    return "residential"


def build() -> dict:
    data = _overpass()
    elements = data.get("elements") or []
    nodes = _nodes_index(elements)
    print(f"nodes={len(nodes)} elements={len(elements)}")

    buildings: list[dict] = []
    roads: list[dict] = []

    for e in elements:
        if e.get("type") != "way":
            continue
        tags = e.get("tags") or {}
        ring = _way_ring(e, nodes)
        if not ring:
            continue

        if "highway" in tags:
            # keep as LineString (drop closing dup if any)
            line = ring[:-1] if len(ring) > 2 and ring[0] == ring[-1] else ring
            if len(line) < 2:
                continue
            roads.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"ROAD-{e['id']}",
                        "kind": "road",
                        "highway": tags.get("highway"),
                        "name": tags.get("name") or "",
                    },
                    "geometry": {"type": "LineString", "coordinates": line},
                }
            )
            continue

        if "building" not in tags:
            continue

        area = _ring_area_m2(ring)
        if area < 25 or area > 25000:
            continue

        buildings.append({"way_id": e["id"], "tags": tags, "ring": ring, "area": area})

    # Prefer larger / tagged buildings; shuffle for spatial variety then cap
    rng = random.Random(26011)
    buildings.sort(key=lambda b: (-(1 if _parse_height_m(b["tags"]) else 0), -b["area"]))
    if len(buildings) > MAX_BUILDINGS:
        # keep top 40% by area + random sample of rest for villa mix
        keep_n = MAX_BUILDINGS
        head = buildings[: keep_n // 2]
        tail = buildings[keep_n // 2 :]
        rng.shuffle(tail)
        buildings = head + tail[: keep_n - len(head)]

    features: list[dict] = [
        {
            "type": "Feature",
            "properties": {
                "id": "SITE-BOUNDARY",
                "kind": "site_boundary",
                "name": "Chennai T. Nagar Demo Block A",
                "label": "Site boundary",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [WEST, SOUTH],
                        [EAST, SOUTH],
                        [EAST, NORTH],
                        [WEST, NORTH],
                        [WEST, SOUTH],
                    ]
                ],
            },
        }
    ]

    counts = {"villa": 0, "apartment": 0, "highrise": 0}
    for i, b in enumerate(buildings, start=1):
        tags = b["tags"]
        height = _parse_height_m(tags)
        src = "osm_tag"
        if height is None:
            height = _estimate_height_m(b["area"], tags, rng)
            src = "gobs_style_estimate"
        floors = _gobs_round_floors(height)
        # clamp demo extremes
        floors = min(floors, 24)
        height = floors * FLOOR_H_M
        typology, label = _typology(floors)
        counts[typology] += 1
        bid = f"VERTICA-CHN-A-{i:03d}"
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": bid,
                    "kind": "building",
                    "name": _name_for(i, typology, tags),
                    "label": label,
                    "typology": typology,
                    "landuse": _landuse(tags, typology),
                    "simulated_floors": floors,
                    "height_m": round(height, 1),
                    "area_m2": round(b["area"], 1),
                    "osm_way_id": b["way_id"],
                    "source": src,
                },
                "geometry": {"type": "Polygon", "coordinates": [b["ring"]]},
            }
        )

    features.extend(roads)

    fc = {
        "type": "FeatureCollection",
        "metadata": {
            "id": "SITE-CHN-TNAGAR-A",
            "name": "Chennai T. Nagar Demo Block A",
            "city": "Chennai",
            "bbox": [WEST, SOUTH, EAST, NORTH],
            "coordinate_system": {
                "type": "wgs84",
                "epsg": 4326,
                "axis": "lon,lat",
                "units": "degrees",
            },
            "notes": (
                "Footprints + roads from OpenStreetMap via Overpass. "
                "GOBS public CSV download was unavailable; floors use OSM tags "
                "when present else GOBS-style height/3m estimate for demo typology mix."
            ),
            "floor_height_m": FLOOR_H_M,
            "label_scheme": "VERTICA-CHN-A-{NNN}",
            "building_counts": counts,
            "building_total": sum(counts.values()),
            "road_total": len(roads),
            "sources": ["OpenStreetMap/Overpass", "GOBS-style floor estimate"],
        },
        "features": features,
    }
    return fc


def main() -> None:
    fc = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(fc, indent=2)
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT}")
    print("buildings:", fc["metadata"]["building_counts"], "roads:", fc["metadata"]["road_total"])
    if PORTAL.parent.is_dir():
        PORTAL.write_text(text, encoding="utf-8")
        print(f"Wrote {PORTAL}")
    # tiny checksum so we notice empty dumps
    print("crc", zlib.crc32(text.encode("utf-8")) & 0xFFFFFFFF)


if __name__ == "__main__":
    main()
