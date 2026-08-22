"""Room generation for units that don't carry an explicit `rooms` list in the
source YAML. Reproduces the exact naming convention used by the fully
detailed BLDG-001 rooms (LIV, MBR, BR2, BR3, KIT, DIN, BATH1, BATH2, BAL),
driven off the `apartment_templates` block in the dataset.
"""


def generate_rooms(unit_num: str, unit_type: str, apartment_templates: dict) -> list[dict]:
    template = apartment_templates.get(unit_type)
    if not template:
        return []

    rooms = []
    bedroom_n = 1   # the master bedroom occupies slot 1, extra bedrooms start at 2
    bathroom_n = 0  # bathrooms are always suffixed, even a single one (BATH1)

    for r in template["rooms"]:
        rtype = r["type"]
        if rtype == "living_room":
            rid = f"{unit_num}-LIV"
        elif rtype == "master_bedroom":
            rid = f"{unit_num}-MBR"
        elif rtype == "bedroom":
            bedroom_n += 1
            rid = f"{unit_num}-BR{bedroom_n}"
        elif rtype == "kitchen":
            rid = f"{unit_num}-KIT"
        elif rtype == "dining":
            rid = f"{unit_num}-DIN"
        elif rtype == "bathroom":
            bathroom_n += 1
            rid = f"{unit_num}-BATH{bathroom_n}"
        elif rtype == "balcony":
            rid = f"{unit_num}-BAL"
        else:
            rid = f"{unit_num}-{rtype[:3].upper()}"

        rooms.append({"id": rid, "type": rtype, "area_sq_m": r["area_sq_m"]})

    return rooms
