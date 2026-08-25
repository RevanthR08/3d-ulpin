"""
Apply Swiss-style hero interior enrichment to ONE demo unit.

Does NOT rebuild the city. Only patches BLDG-001 / Floor 5 / Unit 502
(ULPIN 3D-IND-560012-A1-L5-502) inside indian_city_block.json + unit_index.json.

Usage:
  python code/scripts/apply_hero_interior.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HERO = DATA / "hero_interiors" / "3D-IND-560012-A1-L5-502.json"
CITY = DATA / "indian_city_block.json"
INDEX = DATA / "unit_index.json"


def main() -> None:
    hero = json.loads(HERO.read_text(encoding="utf-8"))
    ulpin = hero["ulpin"]
    city = json.loads(CITY.read_text(encoding="utf-8"))

    patched = False
    for b in city.get("buildings", []):
        if b.get("id") != hero["building_id"]:
            continue
        for f in b.get("floors", []):
            if str(f.get("floor_label")) != str(hero["floor_label"]):
                continue
            for u in f.get("units", []):
                if u.get("ulpin") != ulpin and u.get("unit") != hero["unit"]:
                    continue
                u["rooms"] = hero["rooms"]
                u["room_count"] = len(hero["rooms"])
                u["layout"] = hero["layout"]
                u["furniture"] = hero["furniture"]
                u["is_demo_property"] = True
                u["is_hero_interior"] = True
                u["interior_enrichment"] = hero["interior_enrichment"]
                u["area_sq_m"] = hero["area_sq_m"]
                patched = True
                print(f"[ok] patched {ulpin} with {len(hero['rooms'])} polygon rooms + {len(hero['furniture'])} furniture items")
                break

    if not patched:
        raise SystemExit(f"[fail] unit {ulpin} not found in {CITY}")

    CITY.write_text(json.dumps(city, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[ok] wrote {CITY}")

    if INDEX.is_file():
        idx = json.loads(INDEX.read_text(encoding="utf-8"))
        # unit_index may be dict keyed by ulpin or list
        if isinstance(idx, dict) and ulpin in idx:
            entry = idx[ulpin]
            data = entry.get("data") if isinstance(entry, dict) else None
            if isinstance(data, dict):
                data["rooms"] = hero["rooms"]
                data["room_count"] = len(hero["rooms"])
                data["layout"] = hero["layout"]
                data["furniture"] = hero["furniture"]
                data["is_hero_interior"] = True
                data["interior_enrichment"] = hero["interior_enrichment"]
                INDEX.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"[ok] patched unit_index entry for {ulpin}")
            else:
                print("[warn] unit_index entry shape unexpected — city JSON is source of truth")
        else:
            # try list / nested
            found = False
            if isinstance(idx, dict):
                for key, entry in idx.items():
                    if not isinstance(entry, dict):
                        continue
                    data = entry.get("data") or entry
                    if isinstance(data, dict) and data.get("ulpin") == ulpin:
                        data["rooms"] = hero["rooms"]
                        data["room_count"] = len(hero["rooms"])
                        data["layout"] = hero["layout"]
                        data["furniture"] = hero["furniture"]
                        data["is_hero_interior"] = True
                        data["interior_enrichment"] = hero["interior_enrichment"]
                        found = True
                        break
            if found:
                INDEX.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"[ok] patched unit_index for {ulpin}")
            else:
                print("[warn] ulpin not in unit_index — API rebuilds from society on startup")


if __name__ == "__main__":
    main()
