"""Validate Indian City Block dataset parity for SIH 26011."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.validation import validate_society
from app import loader, site_plan as sp

DATA = ROOT / "data" / "indian_city_block.json"
UNIT_INDEX = ROOT / "data" / "unit_index.json"
BLENDER_RAW = Path(r"E:\Nexops-mcp-v2\nexops-mcp-V2\3dprint\city_export_raw.json")


def main():
    society = json.loads(DATA.read_text(encoding="utf-8"))
    unit_index_file = json.loads(UNIT_INDEX.read_text(encoding="utf-8"))

    violations = validate_society(society)
    ulpin_index = loader.build_ulpin_index(society)

    units = []
    owners = 0
    with_center = 0
    with_size = 0
    ulpins = []
    for b in society["buildings"]:
        for f in b["floors"]:
            for u in f["units"]:
                units.append(u)
                ulpins.append(u["ulpin"])
                if u.get("owner"):
                    owners += 1
                if u.get("center_m"):
                    with_center += 1
                if u.get("size_m"):
                    with_size += 1

    unique_ulpins = len(set(ulpins))
    plan = sp.generate_city_block_site_plan(society)

    print("=== Indian City Block validation ===")
    print(f"buildings: {len(society['buildings'])}")
    print(f"units: {len(units)} (declared {society['declared_totals']['total_units']})")
    print(f"unique unit ULPINs: {unique_ulpins}")
    print(f"unit_index.json entries: {len(unit_index_file)}")
    print(f"loader ulpin_index entries: {len(ulpin_index)}")
    print(f"units with owner: {owners}")
    print(f"units with center_m: {with_center}")
    print(f"units with size_m: {with_size}")
    print(f"underground segments: {len(society['underground_infrastructure'])}")
    print(f"site_plan buildings: {len(plan['buildings'])} trees: {len(plan['trees'])}")
    print(f"topology violations: {len(violations)}")
    if violations:
        for v in violations[:10]:
            print(f"  - {v['message']}")

    errors = []
    if len(units) != society["declared_totals"]["total_units"]:
        errors.append("unit count != declared_totals")
    if unique_ulpins != len(units):
        errors.append("duplicate unit ULPINs in society")
    if len(unit_index_file) != len(units):
        errors.append("unit_index.json count mismatch")
    if owners != len(units):
        errors.append("not all units have owner")
    if with_center != len(units) or with_size != len(units):
        errors.append("missing center_m or size_m on some units")
    if violations:
        errors.append(f"{len(violations)} topology violations")

    # Sample hero unit from plan
    hero = "3D-IND-560012-A1-L5-502"
    if hero not in ulpin_index:
        errors.append(f"hero ULPIN missing: {hero}")
    else:
        entry = ulpin_index[hero]
        print(f"hero unit {hero}: owner={entry['data'].get('owner')} area={entry['data'].get('area_sq_m')}")

    if errors:
        print("FAIL:", "; ".join(errors))
        sys.exit(1)

    if BLENDER_RAW.is_file():
        raw = json.loads(BLENDER_RAW.read_text(encoding="utf-8"))
        raw_ulpins = [
            u["ulpin"]
            for b in raw["buildings"]
            for f in b["floors"]
            for u in f["units"]
        ]
        if set(raw_ulpins) != set(ulpins):
            print("FAIL: Blender export ULPIN set differs from web JSON")
            sys.exit(1)
        print(f"Blender parity: {len(raw_ulpins)} ULPINs match web export")

    print("PASS: dataset ready for web demo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
