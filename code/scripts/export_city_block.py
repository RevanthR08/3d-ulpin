"""Convert Blender city_export_raw.json -> cit_planner indian_city_block.json."""
import json
from pathlib import Path

RAW = Path(r"E:\Nexops-mcp-v2\nexops-mcp-V2\3dprint\city_export_raw.json")
OUT_DIR = Path(__file__).resolve().parents[1] / "data"

ORIGIN_LAT, ORIGIN_LON = 12.9716, 77.5946
M_LAT = 1 / 111320
M_LON = 1 / (111320 * 0.917)


def main():
    CITY = json.loads(RAW.read_text(encoding="utf-8"))
    buildings_out = []
    unit_index = {}
    total_floors = total_units = total_rooms = 0

    for b in CITY["buildings"]:
        cx, cy, _ = b["center"]
        w = b["footprint"]["width"]
        d = b["footprint"]["depth"]
        lat = ORIGIN_LAT + cy * M_LAT
        lon = ORIGIN_LON + cx * M_LON
        half_w, half_d = w / 2, d / 2
        corners = [
            [lat + half_d * M_LAT, lon - half_w * M_LON],
            [lat + half_d * M_LAT, lon + half_w * M_LON],
            [lat - half_d * M_LAT, lon + half_w * M_LON],
            [lat - half_d * M_LAT, lon - half_w * M_LON],
        ]
        top_z = max((f["elevation_top_m"] for f in b["floors"]), default=3)
        floors = []
        for f in b["floors"]:
            units = []
            for u in f["units"]:
                rooms = []
                for r in u.get("rooms", []):
                    rid = r["id"] if isinstance(r, dict) else r
                    rooms.append(
                        {
                            "id": f"{u['unit']}-{rid[:3].upper()}",
                            "type": rid.lower().replace(" ", "_"),
                            "name": rid,
                            "area_sq_m": round(u["area_sq_m"] / max(1, len(u["rooms"])), 1),
                        }
                    )
                unit_obj = {
                    "unit": u["unit"],
                    "ulpin": u["ulpin"],
                    "type": u["type"],
                    "area_sq_m": u["area_sq_m"],
                    "rooms": rooms,
                    "room_count": len(rooms),
                    "owner": u.get("owner"),
                    "legal_status": u.get("legal_status", "registered"),
                    "is_demo_property": True,
                    "center_m": u.get("center"),
                    "size_m": u.get("size"),
                    "layout": ",".join(r["name"] for r in rooms),
                }
                units.append(unit_obj)
                unit_index[u["ulpin"]] = {
                    "level": "unit",
                    "building_id": b["id"],
                    "building_name": b["name"],
                    "building_type": b["type"],
                    "floor_label": f["floor_label"],
                    "unit": u["unit"],
                    "data": unit_obj,
                    "elevations": {
                        "base_m": f["elevation_base_m"],
                        "top_m": f["elevation_top_m"],
                    },
                }
                total_rooms += len(rooms)
            floors.append(
                {
                    "floor_label": f["floor_label"],
                    "floor_num": f["floor_num"],
                    "kind": f.get("kind", "residential"),
                    "floor_type": "residential",
                    "ulpin": f["ulpin"],
                    "elevation_base_m": f["elevation_base_m"],
                    "elevation_top_m": f["elevation_top_m"],
                    "units": units,
                }
            )
            total_floors += 1
            total_units += len(units)

        buildings_out.append(
            {
                "id": b["id"],
                "ulpin": b["ulpin"],
                "name": b["name"],
                "type": b["type"],
                "block": b["block"],
                "building_number": int(b["id"].split("-")[-1]),
                "status": b.get("status", "registered"),
                "coordinates": {
                    "center": {
                        "latitude": lat,
                        "longitude": lon,
                        "elevation_amsl_m": 920,
                    },
                    "corners": corners,
                },
                "footprint": {"shape": "rectangle", "length_m": w, "width_m": d},
                "local_center_m": [cx, cy, 0],
                "height": {"total_m": top_z},
                "vertical_parcel": {
                    "base_elevation_m": 0.0,
                    "top_elevation_m": top_z,
                },
                "floors": floors,
                "floor_count": len(floors),
                "unit_count": sum(len(f["units"]) for f in floors),
                "room_count": sum(u["room_count"] for f in floors for u in f["units"]),
            }
        )

    ug = []
    type_map = {
        "water": "water_pipeline",
        "sewer": "sewer",
        "drain": "drain",
        "electrical": "electrical_cable",
    }
    for u in CITY.get("utilities", []):
        path = u.get("path", [])
        if len(path) < 2:
            continue

        def to_ll(p):
            return {
                "latitude": ORIGIN_LAT + p[1] * M_LAT,
                "longitude": ORIGIN_LON + p[0] * M_LON,
            }

        ug.append(
            {
                "id": u["id"],
                "type": type_map.get(u["type"], u["type"]),
                "depth_m": abs(u["depth_m"]),
                "start": to_ll(path[0]),
                "end": to_ll(path[1]),
                "status": "active",
                "path_m": path,
            }
        )

    society = {
        "meta": {
            "id": "SOC-ICB-001",
            "name": "Indian City Block",
            "display_name": "Indian City Block — 3D ULPIN Vertical Property Mapping",
            "dataset_version": "2.0.0",
            "data_type": "synthetic_demo_data",
            "purpose": "SIH 2026 Problem Statement 26011 demo",
            "coordinate_reference_system": {
                "horizontal": "WGS84",
                "vertical": "AMSL",
                "epsg": "EPSG:4979",
            },
            "origin": {
                "latitude": ORIGIN_LAT,
                "longitude": ORIGIN_LON,
                "elevation_amsl_m": 920,
            },
            "site_boundary": {
                "southwest": {"latitude": ORIGIN_LAT, "longitude": ORIGIN_LON},
                "northeast": {
                    "latitude": ORIGIN_LAT + 220 * M_LAT,
                    "longitude": ORIGIN_LON + 280 * M_LON,
                },
            },
            "site_area_sq_m": 280 * 220,
            "visualization": {},
            "local_extent_m": {"width": 280, "depth": 220},
        },
        "declared_totals": {
            "total_buildings": len(buildings_out),
            "total_floors": total_floors,
            "total_units": total_units,
            "total_rooms": total_rooms,
        },
        "buildings": buildings_out,
        "underground_infrastructure": ug,
        "roads": [
            {"id": "ROAD-MAIN-H", "name": "Main Avenue", "type": "main", "width_m": 12},
            {"id": "ROAD-MAIN-V", "name": "North Spine", "type": "main", "width_m": 12},
            {"id": "ROAD-INT-H1", "name": "Park Cross", "type": "internal", "width_m": 8},
        ],
        "statistics": {"registered_units": total_units},
        "ai_processing": {
            "ulpin_generation": {"status": "complete"},
            "floor_segmentation": {"status": "complete"},
            "vertical_parcel_delineation": {"status": "complete"},
        },
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "indian_city_block.json").write_text(
        json.dumps(society, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "unit_index.json").write_text(
        json.dumps(unit_index, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "indian_city_block.yaml").write_text(
        f"""# Indian City Block — SIH 26011
# Authoritative expanded dataset: indian_city_block.json (from Blender export)
society:
  id: SOC-ICB-001
  name: Indian City Block
  source_blend: E:/Nexops-mcp-v2/nexops-mcp-V2/3dprint/indian_city_block_3d.blend
  source_json: indian_city_block.json
  total_buildings: {len(buildings_out)}
  total_units: {total_units}
""",
        encoding="utf-8",
    )
    assert len(unit_index) == total_units
    print(
        f"OK buildings={len(buildings_out)} units={total_units} ulpins={len(unit_index)} utils={len(ug)}"
    )


if __name__ == "__main__":
    main()
