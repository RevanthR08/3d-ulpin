import json
import os

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import loader
from . import geo
from . import site_plan as site_plan_mod
from . import footprint_extraction
from . import georeference as georeference_mod
from .validation import validate_society


class RefPoint(BaseModel):
    px: float
    py: float
    lat: float
    lon: float


class GeoreferenceRequest(BaseModel):
    polygon: list[list[float]]
    ref_points: list[RefPoint]

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DATA_PATH = os.path.join(DATA_DIR, "greenfield_heights.yaml")
CITY_BLOCK_JSON = os.path.join(DATA_DIR, "indian_city_block.json")
DEMO_SOCIETY_JSON = os.path.join(DATA_DIR, "demo_society.json")
UNIT_INDEX_JSON = os.path.join(DATA_DIR, "unit_index.json")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
STATIC3D_DIR = os.path.join(os.path.dirname(__file__), "static3d")
STATICMAP_DIR = os.path.join(os.path.dirname(__file__), "staticmap")
STATICEXTRACT_DIR = os.path.join(os.path.dirname(__file__), "staticextract")
STATICSITE_DIR = os.path.join(os.path.dirname(__file__), "staticsite")
STATICPORTAL_DIR = os.path.join(os.path.dirname(__file__), "staticportal")

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


def _load_society():
    # Optional demo mode (does not require real-world geo alignment)
    # Enable by setting env var USE_BHU_DEMO=1
    if os.getenv("USE_BHU_DEMO") == "1" and os.path.isfile(DEMO_SOCIETY_JSON):
        with open(DEMO_SOCIETY_JSON, encoding="utf-8") as f:
            society = json.load(f)
        print(f"[data] loaded BHU demo society from {DEMO_SOCIETY_JSON}")
        return society
    if os.path.isfile(CITY_BLOCK_JSON):
        with open(CITY_BLOCK_JSON, encoding="utf-8") as f:
            society = json.load(f)
        print(f"[data] loaded Indian City Block from {CITY_BLOCK_JSON}")
        return society
    raw = loader.load_yaml(DATA_PATH)
    society = loader.build_society(raw)
    print(f"[data] loaded Greenfield Heights from {DATA_PATH}")
    return society


@app.on_event("startup")
def startup():
    society = _load_society()
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
    if os.path.isfile(UNIT_INDEX_JSON):
        with open(UNIT_INDEX_JSON, encoding="utf-8") as f:
            _state["unit_index"] = json.load(f)
    else:
        _state["unit_index"] = {}
    _state["violations"] = violations
    _state["project"] = geo.make_projector(origin["latitude"], origin["longitude"])
    data_type = (society.get("meta") or {}).get("data_type")
    if data_type == "local_xy_demo":
        # Viewer only needs local extent to size the ground plane/camera.
        _state["site_plan"] = {"local_extent_m": society["meta"].get("local_extent_m", {"width": 280, "depth": 220})}
    else:
        # Existing behavior for normal datasets
        if os.path.isfile(CITY_BLOCK_JSON):
            _state["site_plan"] = site_plan_mod.generate_city_block_site_plan(society)
        else:
            _state["site_plan"] = site_plan_mod.generate_site_plan(society["buildings"])
    _state["geo_site_plan"] = site_plan_mod.generate_geo_site_plan(society["buildings"])
    _state["blender_export"] = site_plan_mod.generate_blender_export(society["buildings"])


app.mount("/viewer", StaticFiles(directory=STATIC_DIR, html=True), name="viewer")
app.mount("/viewer3d", StaticFiles(directory=STATIC3D_DIR, html=True), name="viewer3d")
app.mount("/viewer-map", StaticFiles(directory=STATICMAP_DIR, html=True), name="viewer_map")
app.mount("/extract", StaticFiles(directory=STATICEXTRACT_DIR, html=True), name="extract")

# Prefer built React SPA (VERTICA) when present; else legacy HTML portal.
_PORTAL_INDEX = os.path.join(STATICPORTAL_DIR, "index.html")
if os.path.isfile(_PORTAL_INDEX):
    _portal_assets = os.path.join(STATICPORTAL_DIR, "assets")
    if os.path.isdir(_portal_assets):
        app.mount(
            "/portal/assets",
            StaticFiles(directory=_portal_assets),
            name="portal_assets",
        )

    @app.get("/portal")
    @app.get("/portal/")
    def portal_root():
        return FileResponse(_PORTAL_INDEX)

    @app.get("/portal/{full_path:path}")
    def portal_spa(full_path: str):
        # Serve real files (favicon, etc.); otherwise SPA index for client routes
        candidate = os.path.normpath(os.path.join(STATICPORTAL_DIR, full_path))
        if not candidate.startswith(os.path.normpath(STATICPORTAL_DIR)):
            raise HTTPException(status_code=400, detail="invalid path")
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(_PORTAL_INDEX)
else:
    app.mount("/portal", StaticFiles(directory=STATICSITE_DIR, html=True), name="portal")


@app.get("/")
def root():
    return {
        "service": "3D ULPIN Vertical Property Mapping System — Data API",
        "endpoints": [
            "/society",
            "/building/{building_id}",
            "/ulpin/{ulpin}",
            "/unit/{ulpin}",
            "/units",
            "/underground",
            "/footprints",
            "/site-plan",
            "/geo-site-plan",
            "/blender-export",
            "/processing-status",
            "POST /extract-footprint",
            "POST /extract-footprint-assisted",
            "POST /georeference",
            "POST /ingest",
        ],
        "viewer": "/viewer",
        "viewer3d": "/viewer3d",
        "viewer_map": "/viewer-map",
        "extract": "/extract",
        "portal": "/portal",
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


@app.get("/unit/{ulpin}")
def get_unit(ulpin: str):
    """Unit detail for click-to-zoom: owner, size, layout, elevations."""
    entry = _state["ulpin_index"].get(ulpin)
    if not entry or entry.get("level") != "unit":
        raise HTTPException(status_code=404, detail=f"Unit ULPIN '{ulpin}' not found")
    data = entry.get("data") or {}
    building_id = entry.get("building_id")
    building = next((b for b in _state["society"]["buildings"] if b["id"] == building_id), None)
    floor = None
    if building:
        for f in building["floors"]:
            if f["floor_label"] == entry.get("floor_label"):
                floor = f
                break
    return {
        "ulpin": ulpin,
        "building_id": building_id,
        "building_name": building["name"] if building else entry.get("building_name"),
        "building_type": building["type"] if building else entry.get("building_type"),
        "floor_label": entry.get("floor_label"),
        "unit": entry.get("unit"),
        "owner": data.get("owner"),
        "legal_status": data.get("legal_status", "registered"),
        "property_type": data.get("type"),
        "area_sq_m": data.get("area_sq_m"),
        "layout": data.get("layout") or ", ".join(r.get("name", r.get("id", "")) for r in data.get("rooms", [])),
        "rooms": data.get("rooms", []),
        "room_count": data.get("room_count", 0),
        "furniture": data.get("furniture", []),
        "is_demo_property": data.get("is_demo_property", False),
        "is_hero_interior": data.get("is_hero_interior", False),
        "interior_enrichment": data.get("interior_enrichment"),
        "center_m": data.get("center_m"),
        "size_m": data.get("size_m"),
        "elevations": entry.get("elevations") or (
            {"base_m": floor["elevation_base_m"], "top_m": floor["elevation_top_m"]} if floor else None
        ),
    }


@app.get("/units")
def list_units(limit: int = Query(50, ge=1, le=500), q: str = Query("", max_length=120)):
    """Search units by ULPIN fragment, unit id, owner name, or building id."""
    society = _state["society"]
    q_raw = q.strip()
    q_lower = q_raw.lower()
    exact = []
    partial = []
    for b in society["buildings"]:
        for f in b["floors"]:
            for u in f["units"]:
                if q_lower:
                    ulpin_l = u["ulpin"].lower()
                    if ulpin_l == q_lower or ulpin_l.endswith("-" + q_lower):
                        exact.append(_unit_search_row(b, f, u))
                        continue
                    if (
                        q_lower not in ulpin_l
                        and q_lower not in str(u["unit"]).lower()
                        and not (u.get("owner") and q_lower in u["owner"].lower())
                        and q_lower not in b["id"].lower()
                    ):
                        continue
                partial.append(_unit_search_row(b, f, u))
    results = exact + partial
    return {"count": min(len(results), limit), "units": results[:limit]}


def _unit_search_row(building, floor, unit):
    return {
        "ulpin": unit["ulpin"],
        "building_id": building["id"],
        "building_name": building["name"],
        "floor_label": floor["floor_label"],
        "unit": unit["unit"],
        "owner": unit.get("owner"),
        "area_sq_m": unit.get("area_sq_m"),
        "type": unit.get("type"),
        "center_m": unit.get("center_m"),
    }


@app.get("/underground")
def get_underground():
    society = _state["society"]
    return {
        "underground_infrastructure": society["underground_infrastructure"],
        "count": len(society["underground_infrastructure"]),
    }


@app.get("/intel-city/underground")
def get_intel_city_underground():
    path = os.path.join(STATIC3D_DIR, "intel_city", "intel_city_underground.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Intel City underground registry missing")
    return FileResponse(path, media_type="application/json")


@app.get("/intel-city/interiors")
def get_intel_city_interiors():
    path = os.path.join(STATIC3D_DIR, "intel_city", "intel_city_interiors.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Intel City interiors registry missing")
    return FileResponse(path, media_type="application/json")


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


@app.post("/extract-footprint")
async def extract_footprint(
    file: UploadFile = File(...),
    sigma: float = Query(0.33, ge=0.05, le=1.0),
    min_area_frac: float = Query(0.015, ge=0.0, le=0.5),
):
    """PS Stage 3A: building extraction. Upload a top-down (drone/satellite)
    image, get back its detected footprint polygon in pixel coordinates.
    sigma/min_area_frac tune edge sensitivity if the first result is off -
    no re-upload needed. Powers /extract."""
    content = await file.read()
    try:
        result = footprint_extraction.extract_footprint(content, sigma=sigma, min_area_frac=min_area_frac)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.post("/extract-footprint-assisted")
async def extract_footprint_assisted(
    file: UploadFile = File(...),
    x: float = Query(...), y: float = Query(...),
    w: float = Query(...), h: float = Query(...),
):
    """Assisted mode: caller draws a rough rectangle around the building
    (x,y,w,h in image pixel coords); GrabCut refines it into an accurate
    outline. Far more robust than pure edge detection on busy/hazy real
    photos. Powers /extract's rectangle-select mode."""
    content = await file.read()
    try:
        result = footprint_extraction.extract_footprint_assisted(content, (x, y, w, h))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.post("/georeference")
def georeference(req: GeoreferenceRequest):
    """PS Input #5 (GNSS/CORS coordinates): converts a pixel-space
    footprint polygon into real [lat, lon] + true area, given 2 reference
    points (pixel coord + known real lat/lon, e.g. from right-clicking the
    same spot in Google Maps). Powers /extract's georeference step."""
    try:
        result = georeference_mod.georeference_polygon(
            req.polygon, [rp.model_dump() for rp in req.ref_points]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.post("/ingest")
async def ingest(file: UploadFile = File(...), kind: str = Query(...)):
    """Records a real uploaded file for one of the PS's 6 input types and
    returns real metadata (filename, size, content-type) - powers the
    Data Ingestion page's upload cards. Only drone/satellite imagery gets
    real processing (the footprint extraction pipeline); the other 5
    types are captured for real but not parsed (no LiDAR/CAD/GIS/DEM
    libraries in this prototype) - the response is honest about that."""
    content = await file.read()
    result = {
        "kind": kind,
        "filename": file.filename,
        "size_bytes": len(content),
        "content_type": file.content_type,
        "processed": False,
    }
    if kind == "drone_imagery":
        try:
            result["extraction"] = footprint_extraction.extract_footprint(content)
            result["processed"] = True
        except ValueError as e:
            result["extraction_error"] = str(e)
    return result


@app.get("/site-plan")
def get_site_plan():
    """Stylized, legible 2D campus-map layout for /viewer: the same 15
    buildings placed along a generated curved road network with parking
    and green grounds. Presentation-only - see app/site_plan.py for why."""
    return _state["site_plan"]


@app.get("/geo-site-plan")
def get_geo_site_plan():
    """Real [lat, lon] version of the site plan for a real map library
    (Leaflet) to render over an actual OSM basemap - powers /viewer-map."""
    return _state["geo_site_plan"]


@app.get("/blender-export")
def get_blender_export():
    """Real, exact building footprint polygons (local metres) + real
    per-floor elevations, for a script to generate 3D geometry
    programmatically - no manual coordinate entry. See
    site_plan.generate_blender_export for details, and
    code/blender_import.py for a ready-to-run consumer script."""
    return _state["blender_export"]


@app.get("/processing-status")
def get_processing_status():
    ai = _state["society"]["ai_processing"]
    return {
        "engine_name": ai.get("engine_name"),
        "engine_version": ai.get("engine_version"),
        "stages": ai.get("processing_stages", []),
        "results": ai.get("results", {}),
    }
