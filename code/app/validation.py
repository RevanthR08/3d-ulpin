"""Topology / referential sanity checks over the built society structure."""

ELEVATION_TOLERANCE_M = 0.05


def validate_society(society: dict) -> list[dict]:
    violations = []
    seen_ulpins = {}

    for b in society["buildings"]:
        # duplicate ULPIN check (building level)
        _check_duplicate(b["ulpin"], f"building:{b['id']}", seen_ulpins, violations)

        floors_sorted = sorted(b["floors"], key=lambda f: f["elevation_base_m"])

        for i, f in enumerate(floors_sorted):
            _check_duplicate(f["ulpin"], f"floor:{b['id']}/{f['floor_label']}", seen_ulpins, violations)

            # elevation continuity: this floor's top should meet the next floor's base
            if i + 1 < len(floors_sorted):
                nxt = floors_sorted[i + 1]
                gap = nxt["elevation_base_m"] - f["elevation_top_m"]
                if abs(gap) > ELEVATION_TOLERANCE_M:
                    violations.append({
                        "type": "elevation_discontinuity",
                        "building_id": b["id"],
                        "floor": f["floor_label"],
                        "next_floor": nxt["floor_label"],
                        "gap_m": round(gap, 3),
                        "message": (
                            f"{b['id']} floor {f['floor_label']} top "
                            f"({f['elevation_top_m']}) does not meet floor "
                            f"{nxt['floor_label']} base ({nxt['elevation_base_m']})"
                        ),
                    })

            if f["elevation_base_m"] >= f["elevation_top_m"]:
                violations.append({
                    "type": "invalid_elevation_range",
                    "building_id": b["id"],
                    "floor": f["floor_label"],
                    "message": (
                        f"{b['id']} floor {f['floor_label']} base "
                        f"({f['elevation_base_m']}) is not below its top ({f['elevation_top_m']})"
                    ),
                })

            seen_units_on_floor = set()
            for u in f["units"]:
                _check_duplicate(
                    u["ulpin"], f"unit:{b['id']}/{f['floor_label']}/{u['unit']}", seen_ulpins, violations
                )
                # every unit belongs to exactly one floor within its building (guards against
                # accidental unit-number collisions introduced during generation)
                if u["unit"] in seen_units_on_floor:
                    violations.append({
                        "type": "duplicate_unit_number",
                        "building_id": b["id"],
                        "floor": f["floor_label"],
                        "unit": u["unit"],
                        "message": f"Unit number {u['unit']} appears twice on {b['id']} floor {f['floor_label']}",
                    })
                seen_units_on_floor.add(u["unit"])

    return violations


def _check_duplicate(value, source, seen, violations):
    if value in seen:
        violations.append({
            "type": "duplicate_ulpin",
            "ulpin": value,
            "first_seen": seen[value],
            "duplicate_at": source,
            "message": f"ULPIN {value} generated for both {seen[value]} and {source}",
        })
    else:
        seen[value] = source
