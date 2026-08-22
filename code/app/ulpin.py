"""
ULPIN (Unique Land Parcel Identification Number) generation.

Pattern (matches the demo_ulpin values already present in the dataset,
e.g. "3D-IND-560012-A1-L5-502"):

    3D-IND-<pincode>-<blockcode><buildingnum>-L<floorlabel>-<unitnum>

- building level : 3D-IND-560012-A1
- floor level     : 3D-IND-560012-A1-L5
- unit level      : 3D-IND-560012-A1-L5-502
"""

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
