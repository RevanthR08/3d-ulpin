"""
Flat-earth (equirectangular) projection from WGS84 lat/lon to local metres,
centered on the society's origin point. Good enough at this scale
(a ~500m x 500m site) - no need for a full map projection library.

+x = east, +y = north (matches how the footprint length_m/width_m and
site_boundary are laid out in the source data).
"""

import math

M_PER_DEG_LAT = 111_320.0


def make_projector(origin_lat: float, origin_lon: float):
    m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(origin_lat))

    def project(lat: float, lon: float):
        x = (lon - origin_lon) * m_per_deg_lon
        y = (lat - origin_lat) * M_PER_DEG_LAT
        return [round(x, 2), round(y, 2)]

    return project


def building_polygon(b: dict, project) -> list:
    """Real corners if the source gives them, else a rectangle built from
    the projected center + footprint length/width (axis-aligned - no
    rotation data exists in the source)."""
    coords = b.get("coordinates") or {}
    corners = coords.get("corners")
    if corners:
        return [project(lat, lon) for lat, lon in corners]

    center = coords.get("center")
    footprint = b.get("footprint") or {}
    if not center or "length_m" not in footprint or "width_m" not in footprint:
        return []

    cx, cy = project(center["latitude"], center["longitude"])
    half_l = footprint["length_m"] / 2
    half_w = footprint["width_m"] / 2
    return [
        [round(cx - half_l, 2), round(cy - half_w, 2)],
        [round(cx + half_l, 2), round(cy - half_w, 2)],
        [round(cx + half_l, 2), round(cy + half_w, 2)],
        [round(cx - half_l, 2), round(cy + half_w, 2)],
    ]
