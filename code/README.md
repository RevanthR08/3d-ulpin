# 3D ULPIN Vertical Property Mapping System — Data/API Layer

Backend + data layer for the hackathon prototype. Parses the synthetic
`greenfield_heights.yaml` dataset, expands it into a full
society → building → floor → unit → room tree, generates 3D ULPINs for
every building/floor/unit that doesn't already have one, validates
topology, and serves it all over a small REST API for the Three.js
frontend to consume.

## Run it

```bash
cd code
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Startup prints a topology validation report to the console. The API is
then live at `http://127.0.0.1:8000` (CORS is open to any origin).

Open **http://127.0.0.1:8000/viewer/** for a 2D campus-style site plan —
curved roads, parking, green grounds and trees, with the same 15
buildings placed legibly along the road network. Pan/zoom, hover
tooltips, and a click-to-drill-down panel showing a building's ULPIN,
every floor's ULPIN, and every unit's ULPIN/owner. This is a QA/debug
view of the data layer, not the 3D viewer (that's the Three.js frontend).

Note: the source YAML's real lat/lon values don't form a coherent layout
(no road geometry exists in the data at all, and several buildings' real
centers are close enough to overlap), so `/viewer` uses a **generated
schematic layout** (`app/site_plan.py`) - same buildings, same ULPINs,
new positions chosen purely for legibility. The real geo-referenced data
is untouched and still served as-is by `/society`, `/building`, `/ulpin`
and `/footprints` (which projects the *real* lat/lon into local metres,
for anything that needs geographic accuracy instead of a pretty picture).

## Project layout

```
code/
  data/greenfield_heights.yaml   # source dataset (unmodified)
  app/
    loader.py       # YAML -> expanded data tree, unit/room generation
    rooms.py         # per-unit room generation from apartment_templates
    ulpin.py          # ULPIN generation
    geo.py             # lat/lon -> local metres projection + real footprint polygons
    site_plan.py     # generated schematic campus layout (roads/parking/trees/buildings)
    validation.py    # topology / referential sanity checks
    main.py            # FastAPI app + endpoints
    static/index.html  # 2D site plan viewer (served at /viewer)
```

## ULPIN pattern

Matches the `demo_ulpin` values already present in the dataset
(e.g. `3D-IND-560012-A1-L5-502`):

```
3D-IND-<pincode>-<blockletter><buildingnum>-L<floorlabel>-<unitnum>
```

| Level    | Example                        |
|----------|---------------------------------|
| Building | `3D-IND-560012-A1`             |
| Floor    | `3D-IND-560012-A1-L5`          |
| Unit     | `3D-IND-560012-A1-L5-502`      |

Pincode is hardcoded to `560012`, matching the pincode already used in the
dataset's own `demo_ulpin` values. Units/floors that already carry a
`demo_ulpin` in the source keep it as-is instead of generating a new one.

## Data expansion rules (no invented location/building data — only
structural expansion of values already in the YAML)

- **BLDG-001** has two fully detailed floors (1 and 5) and bare
  unit-number lists for the rest (2–4, 6–14). Bare floors reuse floor 1's
  unit-type/area layout positionally (towers repeat the same floor plan),
  then generate rooms from `apartment_templates`.
- **BLDG-002…013** only have `floor_configuration.apartments` (counts by
  unit type per floor). Each residential floor is expanded into individual
  units (`unit = floor*100 + position`, e.g. floor 3 → 301, 302, 303, 304),
  with rooms generated from `apartment_templates`.
- **BLDG-014 / BLDG-015** (clubhouse, security centre) aren't residential —
  their `ground_floor`/`first_floor` "spaces" are carried through as
  floor-level rooms, with no units.
- Units matching the dataset's `demo_properties` (BLDG-001 floor 5, units
  501/502/503) get their real `demo_ulpin`, owner, legal_status, and
  confidence merged in. Every other generated unit has `owner: null`,
  `legal_status: "unregistered"` — no fabricated owner names.
- Basements are only modeled with room/parking detail where the source
  gives it (BLDG-001). Other basements are generated with correct
  elevation ranges only, since the source has no room-level basement data
  for them.

## Topology validation (`validate_society`)

Runs at startup, printed to console, and surfaced via `/society`:

- no duplicate ULPINs across buildings/floors/units
- no duplicate unit numbers within a floor
- elevation continuity: each floor's top elevation must meet the next
  floor's base elevation (within 0.05 m)
- each floor's base elevation must be below its top elevation

Current result on `greenfield_heights.yaml`: **0 violations**.

Note: the dataset's own top-level `total_floors`/`total_units`/
`total_rooms` (79 / 474 / 1896) are aggregate stats from the source file
and don't fully reconcile with what full expansion produces (117 / 406 /
3201) — this is a property of the synthetic source data, not a bug. Both
are exposed side-by-side in `/society` as `declared_totals` vs
`computed_totals` so it's visible rather than silently papered over.

## Endpoints

### `GET /society`

Full overview + statistics: society meta, declared vs computed totals,
source `statistics` block, topology validation results, one summary row
per building, and roads.

```json
{
  "meta": { "id": "SOC-001", "name": "Greenfield Heights", "...": "..." },
  "declared_totals": { "total_buildings": 15, "total_floors": 79, "total_units": 474, "total_rooms": 1896 },
  "computed_totals": { "total_buildings": 15, "total_floors": 117, "total_units": 406, "total_rooms": 3201 },
  "statistics": { "...": "source statistics block, as-is" },
  "topology_validation": { "violation_count": 0, "violations": [] },
  "buildings": [
    {
      "id": "BLDG-001",
      "ulpin": "3D-IND-560012-A1",
      "name": "Tower Alpha",
      "type": "residential_tower",
      "block": "A",
      "status": "registered",
      "coordinates": { "center": { "latitude": 13.08218, "longitude": 80.27012, "elevation_amsl_m": 19.2 }, "corners": [ ["...4 lat/lon pairs..."] ] },
      "footprint": { "shape": "rectangle", "length_m": 42.0, "width_m": 28.0, "area_sq_m": 1176.0 },
      "vertical_parcel": { "base_elevation_m": 18.0, "top_elevation_m": 62.8, "volume_m3": 52915.2, "topology_status": "valid", "collision_status": "clear" },
      "floor_count": 15,
      "unit_count": 56,
      "room_count": 454
    }
  ],
  "roads": [ { "id": "ROAD-001", "name": "Central Avenue", "type": "internal_road", "width_m": 9.0, "surface": "asphalt" } ]
}
```

### `GET /building/{id}`

Full building data — accepts either the building `id` (`BLDG-001`) or its
`ulpin`. Includes every floor and every unit/room.

```json
{
  "id": "BLDG-001",
  "ulpin": "3D-IND-560012-A1",
  "name": "Tower Alpha",
  "type": "residential_tower",
  "block": "A",
  "building_number": 1,
  "status": "registered",
  "coordinates": { "...": "..." },
  "footprint": { "...": "..." },
  "height": { "ground_clearance_m": 0.0, "floor_to_floor_m": 3.2, "roof_height_m": 2.0, "total_height_m": 50.0 },
  "vertical_parcel": { "...": "..." },
  "floor_count": 15,
  "unit_count": 56,
  "room_count": 454,
  "floors": [
    {
      "floor_label": "B1",
      "floor_num": 0,
      "kind": "basement",
      "floor_type": "parking_and_utilities",
      "ulpin": "3D-IND-560012-A1-LB1",
      "elevation_base_m": 14.5,
      "elevation_top_m": 18.0,
      "parking_spaces": 48,
      "rooms": [ { "id": "B1-PARK", "type": "parking", "area_sq_m": 900 } ],
      "units": []
    },
    {
      "floor_label": "1",
      "floor_num": 1,
      "kind": "residential",
      "floor_type": "residential",
      "ulpin": "3D-IND-560012-A1-L1",
      "elevation_base_m": 18.0,
      "elevation_top_m": 21.2,
      "units": [
        {
          "unit": "101",
          "ulpin": "3D-IND-560012-A1-L1-101",
          "type": "3BHK",
          "area_sq_m": 142,
          "rooms": [ { "id": "101-LIV", "type": "living_room", "area_sq_m": 28 } ],
          "room_count": 9,
          "owner": null,
          "legal_status": "unregistered",
          "topology_status": null,
          "collision_status": null,
          "confidence": null,
          "is_demo_property": false
        }
      ]
    }
  ]
}
```

### `GET /ulpin/{ulpin}`

Looks up a single ULPIN at whatever level it belongs to.

```json
{
  "level": "unit",
  "building_id": "BLDG-001",
  "floor_label": "5",
  "unit": "502",
  "data": {
    "unit": "502",
    "ulpin": "3D-IND-560012-A1-L5-502",
    "type": "3BHK",
    "area_sq_m": 142,
    "rooms": [ "..." ],
    "room_count": 9,
    "owner": "Demo Owner",
    "legal_status": "registered",
    "topology_status": "valid",
    "collision_status": "clear",
    "confidence": 0.968,
    "is_demo_property": true
  }
}
```

`level` is `"building"`, `"floor"`, or `"unit"`; `data` is the matching
object exactly as it appears in `/building/{id}`. 404 with
`{"detail": "ULPIN '...' not found"}` if unknown.

### `GET /underground`

```json
{
  "underground_infrastructure": [
    {
      "id": "UTIL-WATER-001",
      "type": "water_pipeline",
      "diameter_mm": 450,
      "depth_m": 3.8,
      "start": { "latitude": 13.08195, "longitude": 80.2699 },
      "end": { "latitude": 13.08355, "longitude": 80.2717 },
      "status": "active",
      "ownership": "society"
    }
  ],
  "count": 5
}
```

### `GET /footprints`

Powers `/viewer`. Real building footprint polygons (source `corners`
where given, else a rectangle from center + `length_m`/`width_m`) and
underground infrastructure lines, projected to local metres (+x = east,
+y = north) around the society origin — not something a 3D frontend needs
directly (it has real lat/lon already), but handy for any 2D/top-down
rendering.

```json
{
  "origin": { "latitude": 13.08268, "longitude": 80.270718, "elevation_amsl_m": 18.5 },
  "colors": { "building": "#334155", "parcel_boundary": "#22d3ee", "...": "..." },
  "site_boundary_polygon": [[-97.37, -84.6], [119.49, -84.6], [119.49, 104.64], [-97.37, 104.64]],
  "buildings": [
    {
      "id": "BLDG-001",
      "ulpin": "3D-IND-560012-A1",
      "name": "Tower Alpha",
      "type": "residential_tower",
      "block": "A",
      "status": "registered",
      "polygon": [[-75.68, -44.53], [-54.0, -44.53], [-54.0, -66.79], [-75.68, -66.79]],
      "centroid": [-64.84, -55.66],
      "floor_count": 15,
      "unit_count": 56,
      "room_count": 454
    }
  ],
  "underground_infrastructure": [
    { "id": "UTIL-WATER-001", "type": "water_pipeline", "status": "active", "line": [[-89.6, -76.05], [122.4, 139.3]] }
  ]
}
```

### `GET /site-plan`

Powers `/viewer`'s campus-map rendering: the generated schematic layout.
Canvas-unit coordinates (not geographic), deterministic (seeded), same
building identity/ULPINs as everywhere else.

```json
{
  "canvas": { "width": 1000, "height": 700 },
  "green_boundary": [[40, 60], [300, 20], "...campus grounds polygon..."],
  "roads": [
    { "id": "main", "kind": "main", "width": 24, "path": "M -40 210 C -3.3 204.2, ... " }
  ],
  "parking_lots": [
    { "id": "P1", "polygon": [[85, 187], [215, 179], "...4 corners..."] }
  ],
  "buildings": [
    {
      "id": "BLDG-001", "ulpin": "3D-IND-560012-A1", "name": "Tower Alpha",
      "type": "residential_tower", "block": "A", "status": "registered",
      "polygon": [[108.5, 118.2], "...4 corners, rotated..."],
      "centroid": [150, 140], "angle": -6,
      "floor_count": 15, "unit_count": 56, "room_count": 454
    }
  ],
  "trees": [[231.4, 178.2], "...[x, y] points..."]
}
```

### `GET /processing-status`

Drives the fake "AI is processing..." loading sequence on the frontend.

```json
{
  "engine_name": "3D Cadastre Intelligence Engine",
  "engine_version": "demo-1.0",
  "stages": [
    { "stage": "data_ingestion", "label": "Spatial Data Ingestion", "duration_ms": 850, "status": "completed" },
    { "stage": "coordinate_alignment", "label": "GNSS / Coordinate Alignment", "duration_ms": 1100, "status": "completed" }
  ],
  "results": {
    "buildings_detected": 15,
    "floors_detected": 79,
    "property_volumes_generated": 474,
    "underground_assets_detected": 5,
    "spatial_conflicts": 0,
    "boundary_errors": 0,
    "average_confidence": 0.964,
    "processing_status": "SUCCESS"
  }
}
```
