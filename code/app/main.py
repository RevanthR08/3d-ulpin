import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import loader
from . import geo
from .validation import validate_society

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "greenfield_heights.yaml")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = FastAPI(
    title="3D ULPIN Vertical Property Mapping System — Data API",
    description="Society -> Buildings -> Floors -> Units -> Rooms, with 3D ULPINs, "
                 "for consumption by the Three.js 3D viewer.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state: dict = {}


@app.on_event("startup")
def startup():
    raw = loader.load_yaml(DATA_PATH)
    society = loader.build_society(raw)
    violations = validate_society(society)

    if violations:
        print(f"[topology_validation] {len(violations)} violation(s) found:")
        for v in violations:
            print(f"  - [{v['type']}] {v['message']}")
    else:
        print("[topology_validation] no violations found — dataset is clean.")

    origin = society["meta"]["origin"]
    _state["society"] = society
    _state["ulpin_index"] = loader.build_ulpin_index(society)
    _state["violations"] = violations
    _state["project"] = geo.make_projector(origin["latitude"], origin["longitude"])


app.mount("/viewer", StaticFiles(directory=STATIC_DIR, html=True), name="viewer")


@app.get("/")
def root():
    return {
        "service": "3D ULPIN Vertical Property Mapping System — Data API",
        "endpoints": [
            "/society",
            "/building/{building_id}",
            "/ulpin/{ulpin}",
            "/underground",
            "/footprints",
            "/processing-status",
        ],
        "viewer": "/viewer",
    }


@app.get("/society")
def get_society():
    society = _state["society"]
    buildings = society["buildings"]

    building_summaries = [
        {
            "id": b["id"],
            "ulpin": b["ulpin"],
            "name": b["name"],
            "type": b["type"],
            "block": b["block"],
            "status": b["status"],
            "coordinates": b["coordinates"],
            "footprint": b["footprint"],
            "vertical_parcel": b["vertical_parcel"],
            "floor_count": b["floor_count"],
            "unit_count": b["unit_count"],
            "room_count": b["room_count"],
        }
        for b in buildings
    ]

    return {
        "meta": society["meta"],
        "declared_totals": society["declared_totals"],
        "computed_totals": {
            "total_buildings": len(buildings),
            "total_floors": sum(b["floor_count"] for b in buildings),
            "total_units": sum(b["unit_count"] for b in buildings),
            "total_rooms": sum(b["room_count"] for b in buildings),
        },
        "statistics": society["statistics"],
        "topology_validation": {
            "violation_count": len(_state["violations"]),
            "violations": _state["violations"],
        },
        "buildings": building_summaries,
        "roads": society["roads"],
    }


@app.get("/building/{building_id}")
def get_building(building_id: str):
    for b in _state["society"]["buildings"]:
        if b["id"] == building_id or b["ulpin"] == building_id:
            return b
    raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found")


@app.get("/ulpin/{ulpin}")
def get_ulpin(ulpin: str):
    entry = _state["ulpin_index"].get(ulpin)
    if not entry:
        raise HTTPException(status_code=404, detail=f"ULPIN '{ulpin}' not found")
    return entry


@app.get("/underground")
def get_underground():
    society = _state["society"]
    return {
        "underground_infrastructure": society["underground_infrastructure"],
        "count": len(society["underground_infrastructure"]),
    }


@app.get("/footprints")
def get_footprints():
    """2D site plan: real building footprint polygons (from source corners
    where given, else a rectangle from center + length/width) and
    underground infrastructure lines, all projected to local metres
    (+x = east, +y = north) around the society origin. Powers /viewer."""
    society = _state["society"]
    project = _state["project"]
    meta = society["meta"]

    boundary = meta.get("site_boundary") or {}
    site_boundary_polygon = []
    if boundary.get("southwest") and boundary.get("northeast"):
        sw, ne = boundary["southwest"], boundary["northeast"]
        site_boundary_polygon = [
            project(sw["latitude"], sw["longitude"]),
            project(sw["latitude"], ne["longitude"]),
            project(ne["latitude"], ne["longitude"]),
            project(ne["latitude"], sw["longitude"]),
        ]

    buildings = []
    for b in society["buildings"]:
        polygon = geo.building_polygon(b, project)
        if not polygon:
            continue
        center = (b.get("coordinates") or {}).get("center")
        buildings.append({
            "id": b["id"],
            "ulpin": b["ulpin"],
            "name": b["name"],
            "type": b["type"],
            "block": b["block"],
            "status": b["status"],
            "polygon": polygon,
            "centroid": project(center["latitude"], center["longitude"]) if center else None,
            "floor_count": b["floor_count"],
            "unit_count": b["unit_count"],
            "room_count": b["room_count"],
        })

    underground = []
    for u in society["underground_infrastructure"]:
        underground.append({
            "id": u["id"],
            "type": u["type"],
            "status": u.get("status"),
            "line": [project(u["start"]["latitude"], u["start"]["longitude"]),
                     project(u["end"]["latitude"], u["end"]["longitude"])],
        })

    return {
        "origin": meta["origin"],
        "colors": (meta.get("visualization") or {}).get("colors", {}),
        "site_boundary_polygon": site_boundary_polygon,
        "buildings": buildings,
        "underground_infrastructure": underground,
    }


@app.get("/processing-status")
def get_processing_status():
    ai = _state["society"]["ai_processing"]
    return {
        "engine_name": ai.get("engine_name"),
        "engine_version": ai.get("engine_version"),
        "stages": ai.get("processing_stages", []),
        "results": ai.get("results", {}),
    }
