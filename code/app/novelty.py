"""
Hackathon "novelty feature" modules — all mocked with realistic hardcoded /
computed data on top of the EXISTING society dataset. No new dataset, no new
top-level tabs. Two modules:

  1. Disputes        — citizen files a one-tap dispute, backend auto-attaches
                       geometry/location; admin reviews. Persisted to
                       data/disputes.json.
  2. AR scan         — /ar/scan returns a random building+unit formatted for an
                       on-screen overlay (no real spatial alignment).

Everything operates on whatever /society currently loads (Indian City Block by
default, Greenfield Heights if you remove data/indian_city_block.json) — the
society -> buildings -> floors -> units -> ULPIN shape is the same either way.
"""

import json
import os
import random
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DISPUTES_PATH = os.path.join(DATA_DIR, "disputes.json")

ISSUE_TYPES = {"boundary_dispute", "ownership_error", "encroachment_report", "other"}


# --------------------------------------------------------------------------- #
# small geometry helpers (pure Python — no shapely)
# --------------------------------------------------------------------------- #

def _round_pt(p, nd=2):
    return [round(float(p[0]), nd), round(float(p[1]), nd)]


def _round_poly(poly, nd=2):
    return [_round_pt(p, nd) for p in poly]


def _rect_from_center(cx, cy, w, d):
    hw, hd = w / 2.0, d / 2.0
    return [
        (cx - hw, cy - hd),
        (cx + hw, cy - hd),
        (cx + hw, cy + hd),
        (cx - hw, cy + hd),
    ]


def _unit_footprint(unit, building):
    """Footprint polygon (local metres) for a unit: a rectangle from
    center_m + size_m, else the building box."""
    poly = unit.get("footprint_polygon_m")
    if poly and len(poly) >= 3:
        return [(p[0], p[1]) for p in poly]
    c, s = unit.get("center_m"), unit.get("size_m")
    if c and s:
        return _rect_from_center(c[0], c[1], s[0], s[1])
    return _building_footprint(building)


def _building_footprint(building):
    c = building.get("local_center_m")
    fp = building.get("footprint") or {}
    if c and fp.get("length_m") and fp.get("width_m"):
        return _rect_from_center(c[0], c[1], fp["length_m"], fp["width_m"])
    # last resort: bbox of this building's unit centres
    pts = [
        u["center_m"]
        for f in building.get("floors", [])
        for u in f.get("units", [])
        if u.get("center_m")
    ]
    if pts:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return [(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]
    return [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]


def _find_building(society, ident):
    for b in society["buildings"]:
        if b["id"] == ident or b["ulpin"] == ident:
            return b
    return None


# --------------------------------------------------------------------------- #
# module 1 — one-tap disputes
# --------------------------------------------------------------------------- #

class UlpinNotFound(Exception):
    pass


class BadIssueType(Exception):
    pass


class DisputeNotFound(Exception):
    pass


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_disputes():
    if os.path.isfile(DISPUTES_PATH):
        try:
            with open(DISPUTES_PATH, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return []


def save_disputes(disputes):
    with open(DISPUTES_PATH, "w", encoding="utf-8") as f:
        json.dump(disputes, f, indent=2, ensure_ascii=False)
        f.write("\n")


def find_dispute(disputes, dispute_id):
    return next((d for d in disputes if d.get("dispute_id") == dispute_id), None)


def _next_dispute_id(disputes):
    year = datetime.now(timezone.utc).year
    prefix = f"DSP-{year}-"
    seqs = [
        int(d["dispute_id"].rsplit("-", 1)[-1])
        for d in disputes
        if isinstance(d.get("dispute_id"), str) and d["dispute_id"].startswith(prefix)
    ]
    return f"{prefix}{(max(seqs, default=0) + 1):04d}"


def _resolve_context(society, ulpin_index, ulpin):
    entry = ulpin_index.get(ulpin)
    if not entry:
        raise UlpinNotFound(ulpin)

    level = entry["level"]
    building = _find_building(society, entry["building_id"])
    floor = unit = None
    if building:
        if entry.get("floor_label"):
            floor = next((f for f in building["floors"] if f["floor_label"] == entry["floor_label"]), None)
        if level == "unit" and floor:
            unit = next((u for u in floor.get("units", []) if u["ulpin"] == ulpin), None)
    return level, building, floor, unit


def _gps_for(building):
    center = ((building or {}).get("coordinates") or {}).get("center") or {}
    return {
        "latitude": center.get("latitude"),
        "longitude": center.get("longitude"),
        "elevation_amsl_m": center.get("elevation_amsl_m"),
        "source": "building_gnss_reference",
    }


def build_dispute(society, ulpin_index, disputes, ulpin, issue_type, note):
    """Pure: builds one dispute record. Caller is responsible for appending +
    persisting. `disputes` is used only to generate the next id."""
    if issue_type not in ISSUE_TYPES:
        raise BadIssueType(f"issue_type must be one of {sorted(ISSUE_TYPES)}")

    level, building, floor, unit = _resolve_context(society, ulpin_index, ulpin)

    vp = (building or {}).get("vertical_parcel") or {}
    if floor:
        vertical = {"base": floor.get("elevation_base_m"), "top": floor.get("elevation_top_m")}
    else:
        vertical = {"base": vp.get("base_elevation_m"), "top": vp.get("top_elevation_m")}

    if unit:
        polygon = _round_poly(_unit_footprint(unit, building))
        center_m = unit.get("center_m")
        owner = unit.get("owner")
        prop_type = unit.get("type")
        area = unit.get("area_sq_m")
    else:
        polygon = _round_poly(_building_footprint(building)) if building else None
        center_m = (building or {}).get("local_center_m")
        owner = (floor or {}).get("owner")
        prop_type = (building or {}).get("type")
        fp = (building or {}).get("footprint") or {}
        area = round(float(fp.get("length_m", 0) or 0) * float(fp.get("width_m", 0) or 0), 1) or None

    auto_attached = {
        "building_id": (building or {}).get("id"),
        "building_ulpin": (building or {}).get("ulpin"),
        "building_name": (building or {}).get("name"),
        "floor_label": floor.get("floor_label") if floor else None,
        "unit": unit.get("unit") if unit else None,
        "owner": owner,
        "property_type": prop_type,
        "area_sq_m": area,
        "unit_center_m": center_m,
        "unit_polygon_m": polygon,
        "vertical_extent_m": vertical,
        "gps": _gps_for(building),
    }

    return {
        "dispute_id": _next_dispute_id(disputes),
        "ulpin": ulpin,
        "level": level,
        "issue_type": issue_type,
        "note": (note or "").strip(),
        "status": "pending_review",
        "filed_at": _now_iso(),
        "filed_by": "citizen",
        "reviewed_at": None,
        "reviewer_note": None,
        "auto_attached": auto_attached,
    }


def list_disputes(disputes):
    ordered = sorted(disputes, key=lambda d: d.get("filed_at", ""), reverse=True)
    by_status = {"pending_review": 0, "approved": 0, "rejected": 0}
    for d in ordered:
        by_status[d.get("status", "pending_review")] = by_status.get(d.get("status", "pending_review"), 0) + 1
    return {"count": len(ordered), "by_status": by_status, "disputes": ordered}


def review_dispute(disputes, dispute_id, action, reviewer_note):
    d = find_dispute(disputes, dispute_id)
    if d is None:
        raise DisputeNotFound(dispute_id)
    if action not in ("approve", "reject"):
        raise ValueError("action must be 'approve' or 'reject'")
    d["status"] = "approved" if action == "approve" else "rejected"
    d["reviewed_at"] = _now_iso()
    d["reviewer_note"] = (reviewer_note or "").strip() or None
    return d


# Pre-seeded disputes so the admin review queue isn't empty on a fresh clone.
SEED_SPECS = [
    {
        "ulpin": "3D-IND-560012-A3-L3-303",
        "issue_type": "encroachment_report",
        "note": "The flat next to mine has extended into the corridor and is blocking the fire exit.",
        "filed_at": "2026-08-27T18:22:10Z",
        "status": "pending_review",
    },
    {
        "ulpin": "3D-IND-560012-B9-L2-202",
        "issue_type": "ownership_error",
        "note": "The registry still shows the previous owner — this flat was sold to me last year.",
        "filed_at": "2026-08-28T09:05:44Z",
        "status": "approved",
        "reviewed_at": "2026-08-29T11:40:00Z",
        "reviewer_note": "Verified against sale deed; correction queued.",
    },
]


def load_or_seed_disputes(society, ulpin_index):
    disputes = load_disputes()
    if disputes:
        return disputes
    seeded = []
    for spec in SEED_SPECS:
        try:
            d = build_dispute(society, ulpin_index, seeded, spec["ulpin"], spec["issue_type"], spec["note"])
        except (UlpinNotFound, BadIssueType):
            continue
        d["filed_at"] = spec["filed_at"]
        d["status"] = spec.get("status", "pending_review")
        d["reviewed_at"] = spec.get("reviewed_at")
        d["reviewer_note"] = spec.get("reviewer_note")
        seeded.append(d)
    save_disputes(seeded)
    return seeded


# --------------------------------------------------------------------------- #
# module 2 — AR scan (admin "AR Scanner" tab)
# --------------------------------------------------------------------------- #

def ar_scan(society, seed=None):
    """Returns a random building+unit formatted for an on-screen AR overlay.
    Pass ?seed=<int> for a repeatable demo; omit for a fresh random pick +
    fresh match_confidence each call."""
    rng = random.Random(seed) if seed is not None else random.Random()

    candidates = [b for b in society["buildings"] if b.get("unit_count", 0) > 0]
    if not candidates:
        candidates = society["buildings"]
    b = rng.choice(candidates)
    floors = [f for f in b["floors"] if f.get("units")] or b["floors"]
    f = rng.choice(floors)
    units = f.get("units") or []
    u = rng.choice(units) if units else None

    base_z = f.get("elevation_base_m", 0.0) or 0.0
    if u and u.get("center_m") and u.get("size_m"):
        cx, cy, _ = u["center_m"]
        w, d, h = u["size_m"]
        corners = [[round(x, 2), round(y, 2), round(base_z, 2)] for (x, y) in _rect_from_center(cx, cy, w, d)]
        height = round(h, 2)
    else:
        corners = [[round(x, 2), round(y, 2), round(base_z, 2)] for (x, y) in _building_footprint(b)]
        height = round((f.get("elevation_top_m", base_z + 3) or base_z + 3) - base_z, 2)

    owner = (u or {}).get("owner") or (f or {}).get("owner") or "Unregistered"
    prop_type = (u or {}).get("type") or b.get("type") or "—"
    area = (u or {}).get("area_sq_m")
    ulpin = (u or {}).get("ulpin") or f.get("ulpin") or b["ulpin"]
    level = "unit" if u else "floor"

    return {
        "scan_id": "AR-" + "".join(rng.choice("0123456789abcdef") for _ in range(6)),
        "scanned_at": _now_iso(),
        "match_confidence": round(rng.uniform(0.82, 0.94), 2),
        "ulpin": ulpin,
        "level": level,
        "building": {
            "id": b["id"],
            "ulpin": b["ulpin"],
            "name": b["name"],
            "type": b.get("type"),
            "floor_count": b.get("floor_count"),
        },
        "floor_label": f["floor_label"],
        "unit": (u or {}).get("unit"),
        "owner": owner,
        "legal_status": (u or {}).get("legal_status", "registered"),
        "property_type": prop_type,
        "area_sq_m": area,
        "gps": _gps_for(b),
        "overlay": {
            "label": f"{ulpin} · {owner}",
            "sub_label": (
                f"{b['name']} · Floor {f['floor_label']} · {prop_type}"
                + (f" · {area} m²" if area else "")
            ),
            "corners_m": corners,
            "height_m": height,
        },
    }
