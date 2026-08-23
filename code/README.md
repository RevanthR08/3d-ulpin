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

## Portal (`/portal`) — the main demo entry point

A professional multi-page front-end tying the whole project together:
Command Center dashboard, Data Ingestion, AI Processing (animated using
the real pipeline stage data), ULPIN Registry search, Spatial Validation
(real results, not mocked), and Analytics — all wired to the real API
above, with mock login (`app/staticsite/login.html`) and role-based
access (**Admin**: ingest data, run AI processing, run validation;
**Public User**: read-only registry browsing) enforced at the page level,
not just by hiding sidebar links (`app/staticsite/shared/nav.js`). Auth
is intentionally a demo/prototype mock (localStorage, no server
validation), consistent with everything else here that's clearly labeled
simulated rather than claimed as real security. Data Ingestion has 6 real upload widgets, one per PS input type (drone
imagery, LiDAR point cloud, GIS parcel layers, floor plans, GNSS/CORS,
DEM/DSM), each accepting that type's real file formats. Every upload is a
genuine `POST /ingest` round-trip - the server reads the real file and
returns real filename/size/type. Only drone/satellite imagery gets real
processing (the file runs through the actual footprint extraction
pipeline on upload); the other 5 are honestly labeled as received-but-
not-parsed, since this prototype has no LiDAR/CAD/GIS/DEM libraries -
nothing about them is faked as processed. The Spatial Validation page is
likewise genuinely computed, not mocked.

Sidebar groups, in order: **Registry** (Command Center, ULPIN Registry,
Analytics), **Administration** (Data Ingestion, AI Processing, Spatial
Validation, Footprint Extraction Tool - admin-only), **Spatial Views**.
The footprint extraction tool is deliberately **not** rebuilt inside the
portal - that sidebar link goes out to the existing, already-verified
`/extract` page. The 3D/2D/real-map spatial views (`/viewer3d`, `/viewer`,
`/viewer-map` - all still fully working standalone) are intentionally
**not** linked from the portal's Spatial Views item either - that's a
placeholder (`app/staticsite/spatial.html`) since the team's own
spatial-visualization integration will replace it.

Open **http://127.0.0.1:8000/viewer/** for a 2D campus-style site plan —
curved roads with sidewalks, walkways connecting every building to the
road, parking lots with stall striping, a couple of L-shaped building
footprints for silhouette variety, road name labels, a compass, and a
faint surrounding city grid for scale context, with the same 15 buildings
placed legibly along the road network. Pan/zoom, hover tooltips, and a
click-to-drill-down panel showing a building's ULPIN, every floor's
ULPIN, and every unit's ULPIN/owner. This is a QA/debug view of the data
layer, not the 3D viewer (that's the Three.js frontend).

Note: the source YAML's real lat/lon values don't form a coherent layout
(no road geometry exists in the data at all, and several buildings' real
centers are close enough to overlap), so `/viewer` uses a **generated
schematic layout** (`app/site_plan.py`) - same buildings, same ULPINs,
new positions chosen purely for legibility. The real geo-referenced data
is untouched and still served as-is by `/society`, `/building`, `/ulpin`
and `/footprints` (which projects the *real* lat/lon into local metres,
for anything that needs geographic accuracy instead of a pretty picture).

The area surrounding the fictional campus in `/viewer` is **real
OpenStreetMap road and building geometry** for the dataset's actual
coordinates (13.08268°N, 80.270718°E - Chennai) - 586 real roads and
1,237 real building footprints, pulled once via the public Overpass API
and committed as `data/osm_context.json` (so the server doesn't need
internet access at runtime, and Overpass isn't hit on every restart).
This is genuine map data, not invented - it's there purely to give the
fictional campus authentic scale/density context, the same way the
reference campus map you'd compare this to sits inside a real city grid.
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
ODbL-licensed - credited in the viewer itself.

To regenerate `osm_context.json` (e.g. for a different area or after an
OSM edit), see the Overpass query and projection logic at the top of
`app/site_plan.py` (`_load_real_city_context` / `OSM_ANCHOR` /
`METERS_PER_UNIT`) - it's a one-off fetch + `json.dump`, not part of the
app's runtime.

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
    static3d/index.html # 3D orbit-able viewer (served at /viewer3d, Three.js)
    staticmap/index.html # real-map viewer (served at /viewer-map, MapLibre)
    staticextract/index.html # footprint extraction UI (served at /extract)
    footprint_extraction.py # OpenCV building-outline detection (PS Stage 3A)
    georeference.py  # pixel polygon -> real [lat,lon] + true area (PS Input #5)
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

## Building footprint extraction (`/extract`)

**PS Stage 3A** — the actual step this project was missing: image in, 2D
footprint polygon out, via real OpenCV edge/contour detection (not
hand-placed geometry). Upload a top-down drone/satellite image cropped
reasonably tightly around one building; the pipeline (`app/footprint_extraction.py`)
grayscales it, runs auto-thresholded Canny edge detection (with a
fixed-threshold fallback for low-contrast images, so a subtle real photo
doesn't just silently fail), finds the largest plausible external
contour, and simplifies it to a clean polygon with `approxPolyDP`. Two
sliders (edge sensitivity, minimum area %) let you retune a bad result
without re-uploading. The result overlays directly on the source image so
you can see exactly what was detected, plus the raw `[[x,y], ...]`
polygon to copy out. Powered by `POST /extract-footprint`.

**Two modes**, both real geometry processing (no hardcoded output):

- **Automatic** (edge detection) — per the PS's own suggested approach.
  Works well on a clean, high-contrast, tightly-cropped single building.
  Struggles on busy real photos (dense trees, low contrast, multiple
  similar-sized structures in frame) where nothing stands out sharply
  enough for pure edge detection to isolate.
- **Assisted** (drag a rectangle) — for the busy/hazy real photos where
  automatic mode fails. You drag a rough rectangle around the building
  (doesn't need to be precise, just contain it); [GrabCut](https://docs.opencv.org/4.x/dd/dd7/tutorial_grabcut.html)
  then models actual foreground/background color distributions to refine
  that into an accurate outline — much more robust than edge detection
  alone on a real satellite screenshot with mixed roof materials and
  similar-toned surrounding trees. `extract_footprint_assisted` in
  `app/footprint_extraction.py` / `POST /extract-footprint-assisted`.

Real-world validation: automatic mode failed on an actual Chennai
Institute of Technology satellite screenshot (comb-shaped building, solar
panel roofing, hazy lighting, tree cover of similar tone) — six different
parameter/preprocessing attempts all produced a frame-spanning blob
instead of a building outline. Assisted mode correctly traced the
building's actual footprint, including both internal courtyards, on the
first try.

### Georeferencing (PS Input #5) — turning the polygon into a real parcel

A pixel-space polygon isn't a cadastral record - "894.5 px²" means
nothing legally. Once a footprint is extracted, `/extract` shows a
**Georeference** panel: click "Pick on image" and click 2 points on the
image (ideally 2 corners of the building), then enter each point's real
lat/lon (e.g. right-click the same spot in Google Maps to read its
coordinates - this *is* PS Input #5, "GNSS/CORS-based coordinates," which
nothing else in this pipeline had used until now). Both decimal degrees
(`12.971428`) and DMS (`12°58'17.14"N`) are accepted directly - DMS is
what Google Earth/Maps often shows, and a plain `parseFloat()` on a DMS
string silently truncates to just the leading integer degree (this broke
in exactly that way during testing, with both real reference points
collapsing to ~`(12, 80)` and area coming back as 0 - fixed with a
proper DMS-aware parser plus live "parsed as ..." feedback on each
input, rather than silently misinterpreting it). `app/georeference.py`
fits an exact similarity transform (uniform scale + rotation +
translation - fully determined by 2 point correspondences, no
least-squares needed) from those 2 pixel↔lat/lon pairs, then:

- converts every polygon vertex to a real `[lat, lon]`
- computes true area via the shoelace formula on real local metres (not
  pixels) - reported in m², acres, and sqft
- reports the fitted scale (m/px) and rotation, so you can sanity-check
  the reference points were reasonable

Validated against the same real CIT building: 2 reference points from
Google Maps (`12°58'17.14"N 80°02'37.65"E` / `12°58'15.67"N
80°02'36.94"E`) produced a fitted scale of ~0.107 m/px and ~22° rotation
(both plausible for that screenshot), and a real area in the hundreds-
to-low-thousands of m² depending on how much of the building the
extracted polygon covers. `POST /georeference`.

## Real map viewer (`/viewer-map`)

The most visually accurate of the three: a real [MapLibre GL](https://maplibre.org/)
map over a real basemap (CARTO Positron raster tiles, OSM data) - actual
street names, actual neighborhood labels, actual water features, real
extruded building heights, and full pitch/rotate ("tilt the map into 3D
like Google Maps") since MapLibre is a WebGL map engine, not a flat 2D
one. The 15 buildings are extruded polygons (`fill-extrusion`) using
their **real** `footprint.length_m`/`width_m` and real total height
(`vertical_parcel.top_elevation_m - base_elevation_m`) from the dataset -
not the schematic `SIZE_BY_TYPE` guesses the other two views use.

Placement (`GEO_BUILDING_OFFSETS`/`GEO_GREEN_BOUNDARY_M` in
`app/site_plan.py`) is checked, not eyeballed: every building is verified
overlap-free against every other (rotated-rect separating-axis test), and
every building corner *and* every boundary vertex is checked against the
actual distance to every real road segment in `data/osm_context.json`.
The immediate area around the dataset's origin turned out to be a finely
gridded old residential neighbourhood with real lanes every ~50-80m - a
first attempt that only checked the two most visible roads still crossed
several others, so the campus was moved and shelf-packed tighter to sit
in an actual ~200m x 130m gap (an open field ~300m from the origin, real
building-free per the OSM data) found by grid-searching clearance to
every real road, not guessed. Same click-to-drill-down ULPIN panel as the
other views. Powered by `GET /geo-site-plan`.

## 3D viewer (`/viewer3d`)

A basic orbit-able 3D scene (`app/static3d/index.html`, Three.js via CDN,
no build step) - drag to rotate/tilt, scroll to zoom, right-drag to pan.
Every floor of every building is its own extruded mesh, using each
floor's **real** `elevation_base_m`/`elevation_top_m` from `/building/{id}`
for its height - not a fake uniform stack. Ground footprints come from
`/site-plan`; real OpenStreetMap buildings/roads render as low-detail
context around the campus, same data as `/viewer`. Click any floor to see
its ULPIN and units in a side panel (the containing building's other
floors are also listed, so you can drill from floor to any other floor
without going back to 2D). This is a genuinely separate, complementary
build to the 3D extrusion your teammate is building in the main app - a
lightweight ULPIN-focused viewer directly against this API's data, not a
replacement for their work.

Coordinate note: ground x/z use the same `METERS_PER_UNIT` (0.26)
`app/site_plan.py` uses to align the schematic campus with real OSM
geometry, so footprint width and real floor heights are proportioned
consistently (e.g. Tower Alpha's 44.8m real height reads correctly tall
against its ~20m x 14m real-proportioned footprint).

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
  "city_context": {
    "roads": [
      { "kind": "primary", "width": 8, "path": "M -2571.5 -2707.3 L ... " }
    ],
    "buildings": [[[10.2, 20.4], "...real OSM building footprint, N corners..."]]
  },
  "roads": [
    {
      "id": "main", "kind": "main", "width": 24, "name": "Greenfield Boulevard",
      "path": "M -40 210 C -3.3 204.2, ... ",
      "label_pos": [560.0, 210.0], "label_angle": 6.6
    }
  ],
  "sidewalks": [
    { "id": "main_left", "path": "M -40.0 195.5 L ... " }
  ],
  "walkways": [
    { "building_id": "BLDG-001", "path": "M 150 140 L 178.2 197.4" }
  ],
  "parking_lots": [
    {
      "id": "P1", "polygon": [[85, 187], [215, 179], "...4 corners..."],
      "stalls": [[[102.1, 188.9], [104.6, 222.3]], "...divider lines..."]
    }
  ],
  "buildings": [
    {
      "id": "BLDG-001", "ulpin": "3D-IND-560012-A1", "name": "Tower Alpha",
      "type": "residential_tower", "block": "A", "status": "registered",
      "polygon": [[108.5, 118.2], "...4 (or 6, for the L-shaped ones) corners, rotated..."],
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
