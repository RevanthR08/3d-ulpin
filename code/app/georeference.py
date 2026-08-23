"""
Converts a pixel-space footprint polygon into a real-world [lat, lon]
polygon + true area (m^2) - PS Input #5: "GNSS/CORS-based coordinates -
real-world geolocation anchor." A satellite screenshot carries no
geographic metadata on its own, so this needs 2 reference points (pixel
coordinate + known real lat/lon, e.g. from right-clicking the same spot
in Google Maps) to fit a similarity transform (uniform scale + rotation +
translation - exactly determined by 2 point correspondences, no least-
squares needed).
"""

import math

M_PER_DEG_LAT = 111320.0


def georeference_polygon(polygon_px: list, ref_points: list) -> dict:
    """ref_points: exactly 2 of [{"px": x, "py": y, "lat": lat, "lon": lon}]"""
    if len(ref_points) != 2:
        raise ValueError("exactly 2 reference points are required")

    r1, r2 = ref_points
    origin_lat = (r1["lat"] + r2["lat"]) / 2
    origin_lon = (r1["lon"] + r2["lon"]) / 2
    m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(origin_lat))

    def to_local(lat, lon):
        return complex((lon - origin_lon) * m_per_deg_lon, (lat - origin_lat) * M_PER_DEG_LAT)

    def to_pixel_complex(px, py):
        return complex(px, -py)  # flip y: pixel-down -> math-up, to match north-positive local y

    q1, q2 = to_local(r1["lat"], r1["lon"]), to_local(r2["lat"], r2["lon"])
    p1, p2 = to_pixel_complex(r1["px"], r1["py"]), to_pixel_complex(r2["px"], r2["py"])

    if p2 == p1:
        raise ValueError("the two reference points must be at different pixel locations")

    a = (q2 - q1) / (p2 - p1)
    b = q1 - a * p1

    def pixel_to_local(px, py):
        q = a * to_pixel_complex(px, py) + b
        return q.real, q.imag

    def local_to_latlon(x, y):
        return [round(origin_lat + y / M_PER_DEG_LAT, 7), round(origin_lon + x / m_per_deg_lon, 7)]

    local_pts = [pixel_to_local(x, y) for x, y in polygon_px]
    latlon_polygon = [local_to_latlon(x, y) for x, y in local_pts]

    area_m2 = _shoelace_area(local_pts)

    return {
        "polygon_latlon": latlon_polygon,
        "area_m2": round(area_m2, 1),
        "area_acres": round(area_m2 / 4046.8564224, 4),
        "area_sqft": round(area_m2 * 10.76391042, 1),
        "scale_m_per_px": round(abs(a), 5),
        "rotation_deg": round(math.degrees(math.atan2(a.imag, a.real)), 2),
        "origin": {"latitude": round(origin_lat, 7), "longitude": round(origin_lon, 7)},
    }


def _shoelace_area(points: list) -> float:
    n = len(points)
    s = 0.0
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2
