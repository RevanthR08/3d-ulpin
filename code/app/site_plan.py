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
curved road network with parking and green campus grounds, in fixed
(seeded, deterministic) canvas positions - purely so the shape reads as an
actual site plan, the way greenfield_heights' fictional buildings "should"
look if someone had actually mapped them.
"""

import math
import random

CANVAS = {"width": 1000, "height": 700}

ROAD_WIDTH = {"main": 24, "secondary": 16, "loop": 14}

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


def _rotated_rect(cx, cy, w, h, angle_deg):
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    hw, hh = w / 2, h / 2
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    return [[round(cx + x * ca - y * sa, 1), round(cy + x * sa + y * ca, 1)] for x, y in corners]


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
    """Densely sampled (x, y) points along the same catmull-rom curve, used
    only for tree placement to avoid roads - doesn't need to be exact."""
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


def _dist_point_to_points(pt, points):
    return min(math.hypot(pt[0] - p[0], pt[1] - p[1]) for p in points)


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
            "polygon": _rotated_rect(cx, cy, w, h, angle),
            "centroid": [cx, cy],
            "angle": angle,
            "floor_count": b["floor_count"],
            "unit_count": b["unit_count"],
            "room_count": b["room_count"],
        })

    roads = [
        {"id": "main", "kind": "main", "width": ROAD_WIDTH["main"],
         "path": _catmull_rom_to_bezier(ROAD_PATHS["main"])},
        {"id": "cross_1", "kind": "secondary", "width": ROAD_WIDTH["secondary"],
         "path": _catmull_rom_to_bezier(ROAD_PATHS["cross_1"])},
        {"id": "cross_2", "kind": "secondary", "width": ROAD_WIDTH["secondary"],
         "path": _catmull_rom_to_bezier(ROAD_PATHS["cross_2"])},
        {"id": "loop", "kind": "loop", "width": ROAD_WIDTH["loop"],
         "path": _catmull_rom_to_bezier(LOOP_ROAD, closed=True)},
    ]

    parking_lots = [
        {"id": f"P{i+1}", "polygon": _rotated_rect(p["cx"], p["cy"], p["w"], p["h"], p["angle"])}
        for i, p in enumerate(PARKING_LOTS)
    ]

    road_samples = (
        _sample_curve(ROAD_PATHS["main"]) + _sample_curve(ROAD_PATHS["cross_1"])
        + _sample_curve(ROAD_PATHS["cross_2"]) + _sample_curve(LOOP_ROAD, closed=True)
    )

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
        if _dist_point_to_points(pt, road_samples) < TREE_MARGIN_ROAD:
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
        "roads": roads,
        "parking_lots": parking_lots,
        "buildings": building_shapes,
        "trees": trees,
    }
