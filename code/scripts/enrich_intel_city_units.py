"""Enrich intel_city_buildings.json floors with multi-unit houses.
skyscraper: 3 units/floor, midrise: 2, lowrise: 1. Owners max 2 properties each.
"""
from __future__ import annotations

import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "app" / "static3d" / "intel_city" / "intel_city_buildings.json"

FIRST = [
    "Aarav", "Aditi", "Ananya", "Arjun", "Aisha", "Kabir", "Diya", "Rohan", "Ishaan", "Meera",
    "Priya", "Dev", "Sneha", "Vikram", "Nisha", "Rahul", "Kavya", "Amit", "Pooja", "Sanjay",
    "Neha", "Karan", "Shruti", "Manish", "Ritu", "Harsh", "Anika", "Varun", "Tanvi", "Nikhil",
    "Isha", "Gaurav", "Sana", "Yash", "Riya", "Kunal", "Pari", "Sahil", "Mira", "Deepak",
    "Anjali", "Ravi", "Simran", "Abhay", "Lakshmi", "Farhan", "Zoya", "Imran", "Hina", "Omar",
    "Leela", "Suresh", "Geeta", "Pranav", "Nandini", "Ajay", "Bhavna", "Chetan", "Disha", "Eshan",
    "Falguni", "Gopal", "Heena", "Indira", "Jatin", "Kirti", "Lalit", "Madhav", "Naveen", "Ojas",
    "Pallavi", "Qadir", "Rajesh", "Shalini", "Tarun", "Uma", "Vivek", "Waseem", "Yamini", "Zain",
    "Bhavesh", "Chitra", "Darshan", "Ekta", "Feroz", "Gayatri", "Harish", "Ira", "Jaya", "Krish",
    "Lavanya", "Mohit", "Naina", "Omkar", "Parul", "Rehan", "Smita", "Trisha", "Uday", "Vani",
]
LAST = [
    "Sharma", "Patel", "Reddy", "Iyer", "Nair", "Menon", "Rao", "Gupta", "Joshi", "Singh",
    "Khan", "Ali", "Das", "Banerjee", "Mukherjee", "Chatterjee", "Pillai", "Nambiar", "Shetty", "Hegde",
    "Kulkarni", "Deshmukh", "Patil", "Jain", "Agarwal", "Bhat", "Kaul", "Malhotra", "Kapoor", "Mehta",
    "Saxena", "Verma", "Yadav", "Thakur", "Chopra", "Bansal", "Ghosh", "Sen", "Bose", "Dutta",
    "Naidu", "Rajan", "Krishnan", "Subramanian", "Venkatesh", "Prasad", "Mishra", "Tiwari", "Pandey", "Sinha",
]

STATUSES = ["registered", "mortgage", "under dispute", "leasehold"]


def units_per_floor(kind: str) -> int:
    if kind == "skyscraper":
        return 3
    if kind == "midrise":
        return 2
    if kind == "lowrise":
        return 1
    return 0


def name_pool(n: int) -> list[str]:
    demo_block = {
        "Dhruv Gupta",
        "Meera Iyer",
        "Harsh Vardhan",
        "Ananya Krishnan",
        "Rohan Patel",
        "Priya Nair",
        "Arjun Reddy",
        "Sneha Menon",
        "Kabir Joshi",
        "Divya Rao",
        "Farhan Ali",
    }
    names: list[str] = []
    for f in FIRST:
        for l in LAST:
            full = f"{f} {l}"
            if full not in demo_block:
                names.append(full)
    # ensure enough unique names for 2 props each → need ceil(n/2) people
    need = (n + 1) // 2 + 20
    if len(names) < need:
        raise SystemExit(f"name pool {len(names)} < need {need}")
    random.seed(42)
    random.shuffle(names)
    return names


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    buildings = data.get("buildings") or []

    total_units = 0
    for b in buildings:
        n_floors = len(b.get("floors") or [])
        total_units += n_floors * units_per_floor(b.get("kind") or "")

    pool = name_pool(total_units)
    owner_counts: Counter[str] = Counter()
    pool_i = 0

    def next_owner() -> str:
        nonlocal pool_i
        while pool_i < len(pool):
            name = pool[pool_i]
            pool_i += 1
            if owner_counts[name] < 2:
                owner_counts[name] += 1
                return name
        raise SystemExit("exhausted owner pool")

    unit_total = 0
    for b in buildings:
        kind = b.get("kind") or ""
        n_u = units_per_floor(kind)
        floors = b.get("floors") or []
        for fi, fl in enumerate(floors):
            if n_u <= 0:
                fl.pop("units", None)
                continue
            base_ulpin = fl.get("ulpin") or f"{b.get('ulpin')}-L{fl.get('floor_label')}"
            area = float(fl.get("area_sq_m") or 90)
            units = []
            for ui in range(n_u):
                owner = next_owner()
                unit_ulpin = f"{base_ulpin}-U{ui + 1}"
                share = round(area / n_u, 1)
                units.append(
                    {
                        "unit_label": chr(ord("A") + ui),
                        "unit_index": ui,
                        "ulpin": unit_ulpin,
                        "owner": owner,
                        "owner_id": f"AADHAAR-DEMO-****{(1000 + pool_i + ui) % 9000:04d}",
                        "legal_status": STATUSES[(fi + ui) % len(STATUSES)],
                        "area_sq_m": share,
                        "use": "Residential — 2BHK" if n_u >= 2 else fl.get("use") or "Residential",
                        "registered_on": fl.get("registered_on"),
                        "deed_no": f"DOC/{2010 + (fi % 14)}/CHN/{45000 + unit_total + ui}",
                    }
                )
            fl["units"] = units
            # Floor summary for twin / legacy: first unit owner + note
            fl["owner"] = units[0]["owner"] if n_u == 1 else f"{n_u} unit owners"
            fl["unit_count"] = n_u
            unit_total += n_u

    data.setdefault("meta", {})["unit_count"] = unit_total
    data["meta"]["ownership_note"] = "Each residential floor has 1–3 house units; owner names appear at most twice."

    # Pin dual-property demo holders (citizen logins) onto L1-U1 pairs
    DEMO_DUALS = [
        ("3D-IND-600001-I1-L1-U1", "3D-IND-600001-I19-L1-U1", "Dhruv Gupta"),
        ("3D-IND-600001-I2-L1-U1", "3D-IND-600001-I20-L1-U1", "Meera Iyer"),
        ("3D-IND-600001-I3-L1-U1", "3D-IND-600001-I16-L1-U1", "Harsh Vardhan"),
        ("3D-IND-600001-I4-L1-U1", "3D-IND-600001-I17-L1-U1", "Ananya Krishnan"),
        ("3D-IND-600001-I5-L1-U1", "3D-IND-600001-I18-L1-U1", "Rohan Patel"),
        ("3D-IND-600001-I6-L1-U1", "3D-IND-600001-I21-L1-U1", "Priya Nair"),
        ("3D-IND-600001-I7-L1-U1", "3D-IND-600001-I22-L1-U1", "Arjun Reddy"),
        ("3D-IND-600001-I8-L1-U1", "3D-IND-600001-I23-L1-U1", "Sneha Menon"),
        ("3D-IND-600001-I9-L1-U1", "3D-IND-600001-I10-L1-U1", "Kabir Joshi"),
        ("3D-IND-600001-I11-L1-U1", "3D-IND-600001-I12-L1-U1", "Divya Rao"),
        ("3D-IND-600001-I13-L1-U1", "3D-IND-600001-I14-L1-U1", "Farhan Ali"),
    ]
    by_ulpin: dict[str, dict] = {}
    for b in buildings:
        for fl in b.get("floors") or []:
            for u in fl.get("units") or []:
                by_ulpin[u["ulpin"]] = u

    for a, b_ulpin, owner in DEMO_DUALS:
        for u_ulpin in (a, b_ulpin):
            u = by_ulpin.get(u_ulpin)
            if u:
                u["owner"] = owner

    # Recompute floor summary owner after pins
    for b in buildings:
        for fl in b.get("floors") or []:
            units = fl.get("units") or []
            if len(units) == 1:
                fl["owner"] = units[0]["owner"]
            elif len(units) > 1:
                fl["owner"] = f"{len(units)} unit owners"

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {JSON_PATH}")
    # recount owners after pins
    oc: Counter[str] = Counter()
    for b in buildings:
        for fl in b.get("floors") or []:
            for u in fl.get("units") or []:
                oc[u["owner"]] += 1
    print(f"units={unit_total} unique_owners={len(oc)} max_per_owner={max(oc.values()) if oc else 0}")
    over = [n for n, c in oc.items() if c > 2]
    if over:
        print("WARN owners over 2:", over[:10])


if __name__ == "__main__":
    main()
