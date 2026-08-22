"""
Loads greenfield_heights.yaml and builds a fully expanded, ULPIN-tagged
data structure: society -> buildings -> floors -> units -> rooms.

Buildings come in three shapes in the source file:

1. "detailed"   (BLDG-001) - explicit basement + residential_floors, some
                 floors fully spelled out (unit type/area/rooms), some just
                 a bare list of unit numbers.
2. "apartments" (BLDG-002..013) - only floor_configuration.apartments
                 (counts by unit type per floor). Units are generated.
3. "facility"   (BLDG-014, BLDG-015) - ground_floor/first_floor "spaces"
                 instead of residential units (clubhouse, security centre).

No building/location data is invented — only structural expansion (turning
a floor's unit-type counts into individual unit records, and generating a
per-unit room breakdown from apartment_templates) is done, and always from
values already present in the source file.
"""

import yaml

from . import ulpin as ulpin_mod
from .rooms import generate_rooms

DEFAULT_LEGAL_STATUS = "unregistered"


def load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _demo_property_key(building_id: str, floor, unit: str):
    return (building_id, str(floor), str(unit))


def _index_demo_properties(demo_properties: list) -> dict:
    index = {}
    for dp in demo_properties:
        key = _demo_property_key(dp["building_id"], dp["floor"], dp["unit"])
        index[key] = dp
    return index


def _make_unit(building_id, block, bnum, floor_label, unit_num, unit_type, area_sq_m,
               rooms, demo_index, floor_num):
    key = _demo_property_key(building_id, floor_num, unit_num)
    demo = demo_index.get(key)
    u_ulpin = demo["ulpin"] if demo else ulpin_mod.unit_ulpin(block, bnum, floor_label, unit_num)

    unit = {
        "unit": unit_num,
        "ulpin": u_ulpin,
        "type": unit_type,
        "area_sq_m": area_sq_m,
        "rooms": rooms,
        "room_count": len(rooms),
        "owner": demo["owner"] if demo else None,
        "legal_status": demo["legal_status"] if demo else DEFAULT_LEGAL_STATUS,
        "topology_status": demo.get("topology_status") if demo else None,
        "collision_status": demo.get("collision_status") if demo else None,
        "confidence": demo.get("confidence") if demo else None,
        "is_demo_property": demo is not None,
    }
    return unit


def _build_detailed_building(b, templates, demo_index, block, bnum):
    floors_raw = b["floors"]
    floor_objs = []

    # basement
    basement_raw = floors_raw.get("basement")
    if isinstance(basement_raw, dict):
        floor_label = basement_raw["id"]  # "B1"
        floor_objs.append({
            "floor_label": floor_label,
            "floor_num": 0,
            "kind": "basement",
            "floor_type": basement_raw.get("type", "basement"),
            "ulpin": ulpin_mod.floor_ulpin(block, bnum, floor_label),
            "elevation_base_m": basement_raw["elevation_base_m"],
            "elevation_top_m": basement_raw["elevation_top_m"],
            "parking_spaces": basement_raw.get("parking_spaces"),
            "rooms": basement_raw.get("rooms", []),
            "units": [],
        })

    residential_floors_raw = floors_raw.get("residential_floors", [])
    template_layout = None  # captured from the first fully-detailed floor (floor 1)

    for f in residential_floors_raw:
        floor_num = f["floor"]
        floor_label = str(floor_num)
        units_raw = f["units"]

        is_full_detail = bool(units_raw) and isinstance(units_raw[0], dict)

        units = []
        if is_full_detail:
            if floor_num == 1:
                template_layout = units_raw
            for u in units_raw:
                unit_num = u["unit"]
                unit_type = u["type"]
                area_sq_m = u["area_sq_m"]
                rooms = u.get("rooms") or generate_rooms(unit_num, unit_type, templates)
                units.append(_make_unit(b["id"], block, bnum, floor_label, unit_num,
                                         unit_type, area_sq_m, rooms, demo_index, floor_num))
        else:
            # bare list of unit numbers -> reuse floor 1's layout positionally
            # (towers repeat the same floor plan on every residential level)
            for i, unit_num in enumerate(units_raw):
                layout = template_layout[i] if template_layout and i < len(template_layout) else {}
                unit_type = layout.get("type", "unknown")
                area_sq_m = layout.get("area_sq_m")
                rooms = generate_rooms(unit_num, unit_type, templates) if unit_type in templates else []
                units.append(_make_unit(b["id"], block, bnum, floor_label, unit_num,
                                         unit_type, area_sq_m, rooms, demo_index, floor_num))

        floor_objs.append({
            "floor_label": floor_label,
            "floor_num": floor_num,
            "kind": "residential",
            "floor_type": "residential",
            "ulpin": ulpin_mod.floor_ulpin(block, bnum, floor_label),
            "elevation_base_m": f["elevation_base_m"],
            "elevation_top_m": f["elevation_top_m"],
            "units": units,
        })

    return floor_objs


def _build_apartments_building(b, templates, demo_index, block, bnum):
    floors_raw = b["floors"]
    fc = b["floor_configuration"]
    floor_height = fc["floor_height_m"]
    apartments = fc["apartments"]

    apt_layout = []
    for a in apartments:
        apt_layout.extend([{"type": a["unit_type"], "area_sq_m": a["area_sq_m"]}] * a["count"])

    ground_base = b["vertical_parcel"]["base_elevation_m"]
    floor_objs = []

    basement_count = floors_raw.get("basement", 0) or 0
    for k in range(1, basement_count + 1):
        top = ground_base - floor_height * (k - 1)
        base = ground_base - floor_height * k
        floor_label = f"B{k}"
        floor_objs.append({
            "floor_label": floor_label,
            "floor_num": -k,
            "kind": "basement",
            "floor_type": "parking_and_utilities",
            "ulpin": ulpin_mod.floor_ulpin(block, bnum, floor_label),
            "elevation_base_m": round(base, 2),
            "elevation_top_m": round(top, 2),
            "parking_spaces": None,
            "rooms": [],
            "units": [],
        })

    residential_count = floors_raw.get("residential", 0)
    for floor_num in range(1, residential_count + 1):
        base = ground_base + floor_height * (floor_num - 1)
        top = base + floor_height
        floor_label = str(floor_num)

        units = []
        for i, layout in enumerate(apt_layout, start=1):
            unit_num = str(floor_num * 100 + i)
            unit_type = layout["type"]
            area_sq_m = layout["area_sq_m"]
            rooms = generate_rooms(unit_num, unit_type, templates)
            units.append(_make_unit(b["id"], block, bnum, floor_label, unit_num,
                                     unit_type, area_sq_m, rooms, demo_index, floor_num))

        floor_objs.append({
            "floor_label": floor_label,
            "floor_num": floor_num,
            "kind": "residential",
            "floor_type": "residential",
            "ulpin": ulpin_mod.floor_ulpin(block, bnum, floor_label),
            "elevation_base_m": round(base, 2),
            "elevation_top_m": round(top, 2),
            "units": units,
        })

    return floor_objs


def _build_facility_building(b, block, bnum):
    floors_raw = b["floors"]
    # ground_floor/first_floor "spaces" live under floor_configuration for some buildings
    # (BLDG-014) and directly under floors for others (BLDG-015) - check both.
    fc = b.get("floor_configuration", {})
    vp = b["vertical_parcel"]
    total_floors = floors_raw["total"]

    floor_height = fc.get("floor_height_m")
    if floor_height is None:
        floor_height = (vp["top_elevation_m"] - vp["base_elevation_m"]) / total_floors

    named_floors = [
        ("0", "ground_floor"),
        ("1", "first_floor"),
    ][:total_floors]

    floor_objs = []
    for floor_num, (floor_label, key) in enumerate(named_floors):
        section = fc.get(key) or floors_raw.get(key, {})
        spaces = section.get("spaces", [])
        base = vp["base_elevation_m"] + floor_height * floor_num
        top = base + floor_height

        floor_objs.append({
            "floor_label": floor_label,
            "floor_num": floor_num,
            "kind": "facility",
            "floor_type": key,
            "ulpin": ulpin_mod.floor_ulpin(block, bnum, floor_label),
            "elevation_base_m": round(base, 2),
            "elevation_top_m": round(top, 2),
            "rooms": spaces,
            "units": [],
        })

    return floor_objs


def _room_count(floor_objs):
    total = 0
    for f in floor_objs:
        total += len(f.get("rooms", []))
        for u in f["units"]:
            total += len(u["rooms"])
    return total


def _build_building(b, templates, demo_index):
    block = b["block"]
    bnum = ulpin_mod.building_number_from_id(b["id"])
    floors_raw = b["floors"]

    if isinstance(floors_raw.get("basement"), dict):
        floor_objs = _build_detailed_building(b, templates, demo_index, block, bnum)
    elif "floor_configuration" in b and "apartments" in b["floor_configuration"]:
        floor_objs = _build_apartments_building(b, templates, demo_index, block, bnum)
    elif "ground_floor" in b.get("floor_configuration", {}) or "first_floor" in b.get("floor_configuration", {}) \
            or "ground_floor" in floors_raw or "first_floor" in floors_raw:
        floor_objs = _build_facility_building(b, block, bnum)
    else:
        floor_objs = []

    unit_count = sum(len(f["units"]) for f in floor_objs)

    return {
        "id": b["id"],
        "ulpin": ulpin_mod.building_ulpin(block, bnum),
        "name": b["name"],
        "type": b["type"],
        "block": block,
        "building_number": bnum,
        "status": b.get("status", "unregistered"),
        "coordinates": b.get("coordinates"),
        "footprint": b.get("footprint"),
        "height": b.get("height"),
        "vertical_parcel": b.get("vertical_parcel"),
        "floors": floor_objs,
        "floor_count": len(floor_objs),
        "unit_count": unit_count,
        "room_count": _room_count(floor_objs),
    }


def build_society(raw: dict) -> dict:
    s = raw["society"]
    templates = s.get("apartment_templates", {})
    demo_index = _index_demo_properties(s.get("demo_properties", []))

    buildings = [_build_building(b, templates, demo_index) for b in s["buildings"]]

    return {
        "meta": {
            "id": s["id"],
            "name": s["name"],
            "display_name": s.get("display_name"),
            "dataset_version": s.get("dataset_version"),
            "data_type": s.get("data_type"),
            "purpose": s.get("purpose"),
            "coordinate_reference_system": s.get("coordinate_reference_system"),
            "origin": s.get("origin"),
            "site_boundary": s.get("site_boundary"),
            "site_area_sq_m": s.get("site_area_sq_m"),
            "visualization": s.get("visualization"),
        },
        "declared_totals": {
            "total_buildings": s.get("total_buildings"),
            "total_floors": s.get("total_floors"),
            "total_units": s.get("total_units"),
            "total_rooms": s.get("total_rooms"),
        },
        "buildings": buildings,
        "underground_infrastructure": s.get("underground_infrastructure", []),
        "roads": s.get("roads", []),
        "statistics": s.get("statistics", {}),
        "ai_processing": s.get("ai_processing", {}),
    }


def build_ulpin_index(society: dict) -> dict:
    """Flat lookup: ulpin -> {level, building_id, floor_num, unit, data}"""
    index = {}
    for b in society["buildings"]:
        index[b["ulpin"]] = {
            "level": "building",
            "building_id": b["id"],
            "data": b,
        }
        for f in b["floors"]:
            index[f["ulpin"]] = {
                "level": "floor",
                "building_id": b["id"],
                "floor_label": f["floor_label"],
                "data": f,
            }
            for u in f["units"]:
                index[u["ulpin"]] = {
                    "level": "unit",
                    "building_id": b["id"],
                    "floor_label": f["floor_label"],
                    "unit": u["unit"],
                    "data": u,
                }
    return index
