"""
ULPIN generation.

Internal keys stay 3D-IND-… for the twin JSON. Public IDs are the DoLR
14-character Bhu-Aadhaar form:

    TN3304BBBBFFUU  Tamil Nadu · Chennai · T. Nagar · building · floor · unit
    KA2908BBBBFFUU  Karnataka society-block demo
"""

import re

DEFAULT_PINCODE = "560012"  # matches the pincode used in the dataset's demo_ulpin values


def block_code(block: str, building_num: int) -> str:
    return f"{block}{building_num}"


def building_ulpin(block: str, building_num: int, pincode: str = DEFAULT_PINCODE) -> str:
    return f"3D-IND-{pincode}-{block_code(block, building_num)}"


def floor_ulpin(block: str, building_num: int, floor_label: str, pincode: str = DEFAULT_PINCODE) -> str:
    return f"{building_ulpin(block, building_num, pincode)}-L{floor_label}"


def unit_ulpin(block: str, building_num: int, floor_label: str, unit_num: str, pincode: str = DEFAULT_PINCODE) -> str:
    return f"{floor_ulpin(block, building_num, floor_label, pincode)}-{unit_num}"


def building_number_from_id(building_id: str) -> int:
    """'BLDG-001' -> 1"""
    return int(building_id.split("-")[-1])


def to_public_ulpin(raw: str | None) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    if re.fullmatch(r"[A-Za-z]{2}\d{12}", s):
        return s.upper()
    m = re.fullmatch(r"3D-IND-600001-I(\d+)(?:-L(\d+))?(?:-U(\d+))?", s, re.I)
    if m:
        b = f"{int(m.group(1)):04d}"
        f = f"{int(m.group(2) or 0):02d}"
        u = f"{int(m.group(3) or 0):02d}"
        return f"TN3304{b}{f}{u}"
    m = re.fullmatch(r"3D-IND-560012-([A-Z])(\d+)(?:-L(\d+))?(?:-([A-Z]?\d+))?", s, re.I)
    if m:
        b = f"{int(m.group(2)):04d}"
        f = f"{int(m.group(3) or 0):02d}"
        unit_digits = re.sub(r"\D", "", m.group(4) or "0") or "0"
        u = f"{int(unit_digits[-2:]):02d}"
        return f"KA2908{b}{f}{u}"
    return s


def to_legacy_ulpin(raw: str | None) -> str:
    if not raw:
        return ""
    s = str(raw).strip().upper()
    m = re.fullmatch(r"TN3304(\d{4})(\d{2})(\d{2})", s)
    if m:
        b, f, u = int(m.group(1)), int(m.group(2)), int(m.group(3))
        out = f"3D-IND-600001-I{b}"
        if f:
            out += f"-L{f}"
        if u:
            out += f"-U{u}"
        return out
    m = re.fullmatch(r"KA2908(\d{4})(\d{2})(\d{2})", s)
    if m:
        b, f, u = int(m.group(1)), int(m.group(2)), int(m.group(3))
        out = f"3D-IND-560012-A{b}"
        if f:
            out += f"-L{f}"
        if u:
            out += f"-{f}{u:02d}"
        return out
    return s


def lookup_keys(raw: str) -> list[str]:
    """All ID spellings to try against the internal index."""
    s = (raw or "").strip()
    keys = [s]
    pub = to_public_ulpin(s)
    leg = to_legacy_ulpin(s)
    for extra in (pub, leg):
        if extra and extra not in keys:
            keys.append(extra)
    return keys
