"""
Generates a stylized, legible 2D "campus map" layout for the /viewer page.

This is presentation-only: the society's real geo-referenced data
(coordinates, ULPINs, floor/unit counts...) is untouched and still served
as-is by /society, /building, /ulpin and /footprints. The source YAML's
lat/lon values are illustrative placeholders, not a surveyed site plan
(no road geometry exists in the data at all, and several buildings' real
centers are close enough to overlap) - so plotting them literally just
produces scattered rectangles.

Here we place the same 15 buildings, grouped by type, along a procedurally
curved road network - with sidewalks, walkways, parking stalls, and a
couple of irregular (L-shaped) footprints - in fixed (seeded,
deterministic) canvas positions, purely so the shape reads as an actual
site plan. The surrounding context beyond the campus boundary is real
OpenStreetMap road/building geometry for the dataset's actual coordinates
(see data/osm_context.json + README) - genuine Chennai street fabric,
reprojected into the same canvas space, giving real scale/density context
around the fictional campus without pretending the campus itself is real.
"""

import json
import math
import os
import random

CANVAS = {"width": 1000, "height": 700}

OSM_CONTEXT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "osm_context.json")

# Places the fictional campus (authored in the 0-1000 x 0-700 canvas above)
# onto real OpenStreetMap road/building geometry pulled for the dataset's
# actual origin coordinates (13.08268 N, 80.270718 E - Chennai). ANCHOR is
# that real site_boundary's center, in local metres around the same origin
# geo.py projects from; METERS_PER_UNIT scales the schematic canvas to
# roughly the real site_boundary's ~217m x 189m footprint. Real geometry
# outside the campus is real Chennai streets/buildings - not invented, but
# also not literally where Greenfield Heights exists (it's fictional).
OSM_ANCHOR = (11.0, -10.0)
METERS_PER_UNIT = 0.26
CAMPUS_CENTER = (CANVAS["width"] / 2, CANVAS["height"] / 2)

# stroke widths (canvas units, not metres) giving the real surrounding
# roads a visual hierarchy - kept thin/subdued relative to the fictional
# campus roads so the campus still reads as the focal point.
ROAD_HIERARCHY_WIDTH = {
    "trunk": 9, "trunk_link": 6, "primary": 8, "primary_link": 5,
    "secondary": 6, "secondary_link": 4, "tertiary": 4.5,
    "residential": 3, "living_street": 2.6, "service": 1.8,
    "pedestrian": 1.2, "footway": 0.9, "path": 0.9,
}
DEFAULT_ROAD_WIDTH = 2.5

ROAD_WIDTH = {"main": 24, "secondary": 16, "loop": 14}
ROAD_NAME = {
    "main": "Greenfield Boulevard",
    "cross_1": "Elm Cross Street",
    "cross_2": "Cedar Cross Street",
    "loop": "Villa Loop Road",
}
SIDEWALK_GAP = 7  # distance from road edge to sidewalk centerline

# schematic footprint size (canvas units) by building type - not to scale
# with real length_m/width_m, just relatively sized so towers read larger
# than villas.
SIZE_BY_TYPE = {
    "residential_tower": (78, 52),
    "residential_midrise": (64, 44),
    "low_rise_residential": (48, 36),
    "community_facility": (130, 84),
    "utility_facility": (54, 38),
}

# hand-tuned schematic position + rotation per building, grouped into
# clusters (towers / mid-rise / villas / clubhouse / security) around the
# road network defined below.
BUILDING_LAYOUT = {
    "BLDG-001": (150, 140, -6),
    "BLDG-002": (330, 118, 4),
    "BLDG-003": (515, 145, -3),
    "BLDG-004": (700, 120, 6),
    "BLDG-005": (870, 150, -5),

    "BLDG-006": (140, 320, 5),
    "BLDG-007": (320, 300, -4),
    "BLDG-008": (505, 330, 6),
    "BLDG-009": (690, 305, -3),
    "BLDG-010": (860, 335, 5),

    "BLDG-011": (215, 545, -8),
    "BLDG-012": (310, 590, 3),
    "BLDG-013": (390, 530, -10),

    "BLDG-014": (560, 470, -4),   # clubhouse - central, near the intersection
    "BLDG-015": (75, 250, -18),   # security - near the entrance
}

# a handful of buildings get an L-shaped (notched) footprint instead of a
# plain rectangle, just for silhouette variety - value is how big a bite
# is taken out of one corner (fraction of width/height).
IRREGULAR_NOTCH = {
    "BLDG-014": 0.42,  # clubhouse - reads as a wings-around-a-courtyard building
    "BLDG-007": 0.30,
    "BLDG-009": 0.26,
    "BLDG-012": 0.32,
}

PARKING_LOTS = [
    {"cx": 150, "cy": 205, "w": 130, "h": 36, "angle": -6},
    {"cx": 620, "cy": 200, "w": 150, "h": 36, "angle": 3},
    {"cx": 505, "cy": 400, "w": 110, "h": 34, "angle": 6},
    {"cx": 300, "cy": 480, "w": 120, "h": 34, "angle": -4},
    {"cx": 700, "cy": 470, "w": 110, "h": 34, "angle": -4},
]

# rounded-ish irregular blob covering most of the canvas - the "green
# campus grounds", loosely echoing the real site_boundary shape.
GREEN_BOUNDARY = [
    (40, 60), (300, 20), (620, 30), (860, 60), (960, 180),
    (955, 400), (940, 560), (760, 660), (480, 675), (220, 650),
    (60, 560), (25, 320), (35, 150),
]

ROAD_PATHS = {
    "main": [(-40, 210), (180, 175), (400, 235), (560, 210),
             (760, 260), (960, 210), (1040, 235)],
    "cross_1": [(300, -40), (295, 190), (330, 400), (300, 600), (280, 740)],
    "cross_2": [(650, -40), (640, 190), (610, 400), (630, 600), (650, 740)],
}
LOOP_ROAD = [(150, 460), (260, 420), (400, 460), (430, 570),
             (330, 645), (180, 630), (110, 550), (150, 460)]

TREE_COUNT = 90
TREE_SEED = 42
TREE_MARGIN_BUILDING = 14
TREE_MARGIN_PARKING = 10
TREE_MARGIN_ROAD = 16

# ---------------------------------------------------------------- geometry

def _rotate_point(x, y, cx, cy, angle_deg):
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = x - cx, y - cy
    return [round(cx + dx * ca - dy * sa, 1), round(cy + dx * sa + dy * ca, 1)]


def _rotated_rect(cx, cy, w, h, angle_deg):
    hw, hh = w / 2, h / 2
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    return [_rotate_point(cx + x, cy + y, cx, cy, angle_deg) for x, y in corners]


def _l_shaped_polygon(cx, cy, w, h, notch_frac, angle_deg):
    """A rectangle with one corner (top-right, in local frame) notched out -
    reads as a simple L / wings-around-a-courtyard footprint."""
    hw, hh = w / 2, h / 2
    nw, nh = w * notch_frac, h * notch_frac
    local = [
        (-hw, hh), (-hw, -hh), (hw - nw, -hh),
        (hw - nw, -hh + nh), (hw, -hh + nh), (hw, hh),
    ]
    return [_rotate_point(cx + x, cy + y, cx, cy, angle_deg) for x, y in local]


def _building_polygon(building_id, cx, cy, w, h, angle_deg):
    notch = IRREGULAR_NOTCH.get(building_id)
    if notch:
        return _l_shaped_polygon(cx, cy, w, h, notch, angle_deg)
    return _rotated_rect(cx, cy, w, h, angle_deg)


def _catmull_rom_to_bezier(points, closed=False):
    """Turns a list of (x, y) control points into an SVG path 'd' string
    that smoothly curves through every point."""
    pts = list(points)
    if closed:
        pts = [pts[-2]] + pts + [pts[1]]
    else:
        pts = [pts[0]] + pts + [pts[-1]]

    d = f"M {pts[1][0]} {pts[1][1]} "
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f} "
    return d.strip()


def _sample_curve(points, closed=False, samples_per_seg=12):
    """Densely sampled (x, y) points along the same catmull-rom curve -
    used for tree/sidewalk placement and doesn't need to be exact."""
    pts = list(points)
    if closed:
        pts = [pts[-2]] + pts + [pts[1]]
    else:
        pts = [pts[0]] + pts + [pts[-1]]

    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        for s in range(samples_per_seg + 1):
            t = s / samples_per_seg
            mt = 1 - t
            x = mt**3 * p1[0] + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p2[0]
            y = mt**3 * p1[1] + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p2[1]
            out.append((x, y))
    return out


def _offset_polyline(samples, offset):
    """Parallel curve at a fixed perpendicular distance from a sampled
    curve - used to draw sidewalks alongside a road."""
    n = len(samples)
    pts = []
    for i in range(n):
        if i == 0:
            tx, ty = samples[1][0] - samples[0][0], samples[1][1] - samples[0][1]
        elif i == n - 1:
            tx, ty = samples[-1][0] - samples[-2][0], samples[-1][1] - samples[-2][1]
        else:
            tx, ty = samples[i + 1][0] - samples[i - 1][0], samples[i + 1][1] - samples[i - 1][1]
        length = math.hypot(tx, ty) or 1
        nx, ny = -ty / length, tx / length
        pts.append((samples[i][0] + nx * offset, samples[i][1] + ny * offset))
    return pts


def _polyline_path(points):
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)


def _dist_point_to_points(pt, points):
    return min(math.hypot(pt[0] - p[0], pt[1] - p[1]) for p in points)


def _nearest_point(pt, points):
    return min(points, key=lambda p: (pt[0] - p[0]) ** 2 + (pt[1] - p[1]) ** 2)


def _point_in_rotated_rect(pt, cx, cy, w, h, angle_deg, margin):
    a = math.radians(-angle_deg)
    dx, dy = pt[0] - cx, pt[1] - cy
    lx = dx * math.cos(a) - dy * math.sin(a)
    ly = dx * math.sin(a) + dy * math.cos(a)
    return abs(lx) <= w / 2 + margin and abs(ly) <= h / 2 + margin


def _point_in_polygon(pt, polygon):
    x, y = pt
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if ((y1 > y) != (y2 > y)) and (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-9) + x1):
            inside = not inside
    return inside


def _parking_stalls(cx, cy, w, h, angle_deg):
    """Perpendicular divider lines striping a parking lot into stalls."""
    hw, hh = w / 2, h / 2
    stall_w = 16
    count = max(3, round(w / stall_w))
    lines = []
    for i in range(1, count):
        lx = -hw + i * (w / count)
        p1 = _rotate_point(cx + lx, cy - hh, cx, cy, angle_deg)
        p2 = _rotate_point(cx + lx, cy + hh, cx, cy, angle_deg)
        lines.append([p1, p2])
    return lines


def _road_label_anchor(samples):
    mid = samples[len(samples) // 2]
    a, b = samples[len(samples) // 2 - 3], samples[len(samples) // 2 + 3]
    angle = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    if angle > 90 or angle < -90:
        angle += 180
    return [round(mid[0], 1), round(mid[1], 1)], round(angle, 1)


def _osm_to_canvas(x, y):
    """Real local metres (from data/osm_context.json, projected around the
    dataset's real origin) -> the same canvas-unit space the fictional
    campus is authored in."""
    ax, ay = OSM_ANCHOR
    ccx, ccy = CAMPUS_CENTER
    return [round(ccx + (x - ax) / METERS_PER_UNIT, 1), round(ccy + (y - ay) / METERS_PER_UNIT, 1)]


def _load_real_city_context():
    """Real OpenStreetMap road + building geometry around the dataset's
    actual coordinates (fetched once via the Overpass API, see README),
    reprojected into the campus's canvas-unit space. This is genuine
    Chennai street/building geometry - not invented - used purely as
    authentic surrounding context; Greenfield Heights itself is fictional
    and doesn't literally sit in these buildings' place."""
    with open(OSM_CONTEXT_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    roads = []
    for r in raw["roads"]:
        pts = [_osm_to_canvas(x, y) for x, y in r["points"]]
        roads.append({
            "kind": r["kind"],
            "width": ROAD_HIERARCHY_WIDTH.get(r["kind"], DEFAULT_ROAD_WIDTH),
            "path": _polyline_path(pts),
        })
    buildings = [[_osm_to_canvas(x, y) for x, y in b["polygon"]] for b in raw["buildings"]]

    return {"roads": roads, "buildings": buildings}


# ------------------------------------------------------- real-geo variant

# same origin as data/osm_context.json / geo.py's projector
GEO_ORIGIN_LAT, GEO_ORIGIN_LON = 13.082680, 80.270718
_M_PER_DEG_LAT = 111320.0
_M_PER_DEG_LON = _M_PER_DEG_LAT * math.cos(math.radians(GEO_ORIGIN_LAT))

# The immediate area around the dataset's origin turned out to be a very
# finely gridded old residential neighbourhood (real service/residential
# lanes every ~50-80m) - checking distance from every building corner to
# every real road (not just eyeballing the two obviously visible ones)
# showed the first attempt still crossed several minor real streets. A
# grid search over the surrounding ~300m for the largest real gap free of
# roads found one ~300m NNE of the origin (an open field/ground with no
# real buildings nearby - data/osm_context.json confirms it), so the
# campus sits there instead. Real-metre (east, north) offsets from
# GEO_ORIGIN, shelf-packed from each building's *actual*
# footprint.length_m/width_m (6m gaps - tight, because even this open
# pocket is only ~200m x 130m) and verified with an actual rotated-rect
# separating-axis overlap check (buildings) and point-to-real-road-segment
# distance check (buildings AND the boundary polygon) - every corner
# clears the nearest real road by at least ~3m, not just "looks fine."
GEO_BUILDING_OFFSETS = {
    "BLDG-001": (35.0, 365.0, 0), "BLDG-002": (82.0, 365.0, 0), "BLDG-003": (130.0, 365.0, 0),
    "BLDG-004": (177.0, 365.0, 0),
    "BLDG-005": (45.0, 330.5, 0), "BLDG-006": (89.0, 330.5, 0), "BLDG-007": (130.0, 330.5, 0),
    "BLDG-008": (170.0, 330.5, 0),
    "BLDG-009": (49.0, 298.5, 0), "BLDG-010": (91.0, 298.5, 0), "BLDG-011": (129.5, 298.5, 0),
    "BLDG-012": (164.0, 298.5, 0),
    "BLDG-013": (63.0, 265.5, 0), "BLDG-014": (108.0, 265.5, 0), "BLDG-015": (150.0, 265.5, 0),
}

# every building corner falls inside this polygon (checked, not eyeballed)
# and every vertex clears the nearest real road (checked - min ~3m)
GEO_GREEN_BOUNDARY_M = [
    (5, 258), (0, 340), (10, 383), (110, 396), (198, 385),
    (204, 328), (200, 258), (150, 230), (60, 227),
]

GEO_ROADS_M = {
    "main_1": [(0, 346), (60, 347), (120, 346), (195, 347)],
    "main_2": [(0, 315), (60, 314), (120, 315), (195, 314)],
    "main_3": [(0, 283), (60, 282), (120, 283), (195, 282)],
    "connector": [(105, 396), (105, 315), (105, 227)],
}

GEO_PARKING_LOTS_M = [
    {"cx": 55, "cy": 388, "w": 50, "h": 10, "angle": 0},
    {"cx": 150, "cy": 240, "w": 50, "h": 10, "angle": 0},
]

# real-metre tree-avoidance margins (the canvas-unit TREE_MARGIN_* above
# would be the wrong scale here - this layout is authored directly in
# metres, not canvas units)
GEO_TREE_MARGIN_BUILDING = 4
GEO_TREE_MARGIN_PARKING = 3
GEO_TREE_MARGIN_ROAD = 6


def _m_to_latlon(dx, dy):
    """Real metre offset (dx=east, dy=north) from GEO_ORIGIN -> [lat, lon]."""
    lat = GEO_ORIGIN_LAT + dy / _M_PER_DEG_LAT
    lon = GEO_ORIGIN_LON + dx / _M_PER_DEG_LON
    return [round(lat, 7), round(lon, 7)]


def generate_geo_site_plan(buildings: list) -> dict:
    """Real [lat, lon] version of the campus for a real map library
    (Leaflet/MapLibre) to render over an actual OSM basemap. Buildings use
    each one's *real* footprint.length_m/width_m from the dataset (not the
    schematic SIZE_BY_TYPE guesses) at a freshly authored, verified
    non-overlapping arrangement (GEO_BUILDING_OFFSETS) - real size, real
    map, legible position."""
    building_shapes = []
    for b in buildings:
        offset = GEO_BUILDING_OFFSETS.get(b["id"])
        if not offset:
            continue
        dx, dy, angle = offset
        fp = b.get("footprint") or {}
        w = fp.get("length_m") or SIZE_BY_TYPE.get(b["type"], (60, 40))[0]
        h = fp.get("width_m") or SIZE_BY_TYPE.get(b["type"], (60, 40))[1]
        notch = IRREGULAR_NOTCH.get(b["id"])
        corners_m = _l_shaped_polygon(dx, dy, w, h, notch, angle) if notch else _rotated_rect(dx, dy, w, h, angle)
        building_shapes.append({
            "id": b["id"], "ulpin": b["ulpin"], "name": b["name"], "type": b["type"],
            "block": b["block"], "status": b["status"],
            "polygon": [_m_to_latlon(x, y) for x, y in corners_m],
            "centroid": _m_to_latlon(dx, dy),
            "floor_count": b["floor_count"], "unit_count": b["unit_count"], "room_count": b["room_count"],
        })

    road_sample_map = {rid: _sample_curve(pts) for rid, pts in GEO_ROADS_M.items()}
    roads = [{"id": rid, "points": [_m_to_latlon(x, y) for x, y in pts]} for rid, pts in road_sample_map.items()]
    all_road_samples = [pt for pts in road_sample_map.values() for pt in pts]

    parking_lots = [
        {"id": f"P{i+1}", "polygon": [_m_to_latlon(x, y) for x, y in _rotated_rect(p["cx"], p["cy"], p["w"], p["h"], p["angle"])]}
        for i, p in enumerate(GEO_PARKING_LOTS_M)
    ]

    walkways = [
        {"building_id": bid, "points": [_m_to_latlon(dx, dy), _m_to_latlon(*_nearest_point((dx, dy), all_road_samples))]}
        for bid, (dx, dy, angle) in GEO_BUILDING_OFFSETS.items()
    ]

    building_type_by_id = {b["id"]: b["type"] for b in buildings}
    building_rects = []
    for bid, (dx, dy, angle) in GEO_BUILDING_OFFSETS.items():
        b = next((bb for bb in buildings if bb["id"] == bid), None)
        if not b:
            continue
        fp = b.get("footprint") or {}
        w = fp.get("length_m") or SIZE_BY_TYPE.get(b["type"], (60, 40))[0]
        h = fp.get("width_m") or SIZE_BY_TYPE.get(b["type"], (60, 40))[1]
        building_rects.append((dx, dy, w, h, angle))

    rng = random.Random(TREE_SEED)
    trees = []
    attempts = 0
    minx = min(p[0] for p in GEO_GREEN_BOUNDARY_M)
    maxx = max(p[0] for p in GEO_GREEN_BOUNDARY_M)
    miny = min(p[1] for p in GEO_GREEN_BOUNDARY_M)
    maxy = max(p[1] for p in GEO_GREEN_BOUNDARY_M)
    while len(trees) < TREE_COUNT and attempts < TREE_COUNT * 40:
        attempts += 1
        pt = (rng.uniform(minx, maxx), rng.uniform(miny, maxy))
        if not _point_in_polygon(pt, GEO_GREEN_BOUNDARY_M):
            continue
        if _dist_point_to_points(pt, all_road_samples) < GEO_TREE_MARGIN_ROAD:
            continue
        if any(_point_in_rotated_rect(pt, cx, cy, w, h, angle, GEO_TREE_MARGIN_BUILDING) for cx, cy, w, h, angle in building_rects):
            continue
        if any(_point_in_rotated_rect(pt, p["cx"], p["cy"], p["w"], p["h"], p["angle"], GEO_TREE_MARGIN_PARKING) for p in GEO_PARKING_LOTS_M):
            continue
        trees.append(_m_to_latlon(*pt))

    return {
        "origin": {"latitude": GEO_ORIGIN_LAT, "longitude": GEO_ORIGIN_LON},
        "green_boundary": [_m_to_latlon(x, y) for x, y in GEO_GREEN_BOUNDARY_M],
        "roads": roads,
        "parking_lots": parking_lots,
        "walkways": walkways,
        "buildings": building_shapes,
        "trees": trees,
    }


# ----------------------------------------------------------------- build

def generate_site_plan(buildings: list) -> dict:
    building_shapes = []
    for b in buildings:
        layout = BUILDING_LAYOUT.get(b["id"])
        if not layout:
            continue
        cx, cy, angle = layout
        w, h = SIZE_BY_TYPE.get(b["type"], (60, 40))
        building_shapes.append({
            "id": b["id"],
            "ulpin": b["ulpin"],
            "name": b["name"],
            "type": b["type"],
            "block": b["block"],
            "status": b["status"],
            "polygon": _building_polygon(b["id"], cx, cy, w, h, angle),
            "centroid": [cx, cy],
            "angle": angle,
            "floor_count": b["floor_count"],
            "unit_count": b["unit_count"],
            "room_count": b["room_count"],
        })

    road_sample_map = {
        "main": _sample_curve(ROAD_PATHS["main"]),
        "cross_1": _sample_curve(ROAD_PATHS["cross_1"]),
        "cross_2": _sample_curve(ROAD_PATHS["cross_2"]),
        "loop": _sample_curve(LOOP_ROAD, closed=True),
    }

    roads = []
    sidewalks = []
    for rid, kind, path_pts in [
        ("main", "main", ROAD_PATHS["main"]),
        ("cross_1", "secondary", ROAD_PATHS["cross_1"]),
        ("cross_2", "secondary", ROAD_PATHS["cross_2"]),
        ("loop", "loop", LOOP_ROAD),
    ]:
        width = ROAD_WIDTH[kind]
        closed = rid == "loop"
        label_pos, label_angle = _road_label_anchor(road_sample_map[rid])
        roads.append({
            "id": rid, "kind": kind, "width": width, "name": ROAD_NAME[rid],
            "path": _catmull_rom_to_bezier(path_pts, closed=closed),
            "label_pos": label_pos, "label_angle": label_angle,
        })
        offset = width / 2 + SIDEWALK_GAP
        for side, sign in (("left", -1), ("right", 1)):
            sidewalks.append({
                "id": f"{rid}_{side}",
                "path": _polyline_path(_offset_polyline(road_sample_map[rid], offset * sign)),
            })

    parking_lots = [
        {
            "id": f"P{i+1}",
            "polygon": _rotated_rect(p["cx"], p["cy"], p["w"], p["h"], p["angle"]),
            "stalls": _parking_stalls(p["cx"], p["cy"], p["w"], p["h"], p["angle"]),
        }
        for i, p in enumerate(PARKING_LOTS)
    ]

    all_road_samples = [pt for pts in road_sample_map.values() for pt in pts]

    walkways = [
        {"building_id": bid, "path": _polyline_path([(cx, cy), _nearest_point((cx, cy), all_road_samples)])}
        for bid, (cx, cy, angle) in BUILDING_LAYOUT.items()
    ]

    building_type_by_id = {b["id"]: b["type"] for b in buildings}
    building_rects = [
        (cx, cy, *SIZE_BY_TYPE.get(building_type_by_id.get(bid), (60, 40)), angle)
        for bid, (cx, cy, angle) in BUILDING_LAYOUT.items()
        if bid in building_type_by_id
    ]

    rng = random.Random(TREE_SEED)
    trees = []
    attempts = 0
    minx = min(p[0] for p in GREEN_BOUNDARY)
    maxx = max(p[0] for p in GREEN_BOUNDARY)
    miny = min(p[1] for p in GREEN_BOUNDARY)
    maxy = max(p[1] for p in GREEN_BOUNDARY)

    while len(trees) < TREE_COUNT and attempts < TREE_COUNT * 40:
        attempts += 1
        pt = (rng.uniform(minx, maxx), rng.uniform(miny, maxy))

        if not _point_in_polygon(pt, GREEN_BOUNDARY):
            continue
        if _dist_point_to_points(pt, all_road_samples) < TREE_MARGIN_ROAD:
            continue
        if any(_point_in_rotated_rect(pt, cx, cy, w, h, angle, TREE_MARGIN_BUILDING)
               for cx, cy, w, h, angle in building_rects):
            continue
        if any(_point_in_rotated_rect(pt, p["cx"], p["cy"], p["w"], p["h"], p["angle"], TREE_MARGIN_PARKING)
               for p in PARKING_LOTS):
            continue

        trees.append([round(pt[0], 1), round(pt[1], 1)])

    return {
        "canvas": CANVAS,
        "green_boundary": [list(p) for p in GREEN_BOUNDARY],
        "city_context": _load_real_city_context(),
        "roads": roads,
        "sidewalks": sidewalks,
        "walkways": walkways,
        "parking_lots": parking_lots,
        "buildings": building_shapes,
        "trees": trees,
    }
