"""
Building footprint extraction from a top-down (drone/satellite) image -
PS Stage 3A: "Drone image / point cloud -> Detect building outline
(OpenCV contours) -> 2D footprint polygon."

Pipeline: grayscale -> blur -> auto-thresholded Canny edges -> close small
gaps -> find external contours -> keep the largest contour whose area is
plausible for "the building" (not noise, not the whole frame) -> simplify
to a clean polygon with approxPolyDP.

Works best on an image cropped reasonably tightly around one building
with decent contrast against its surroundings (e.g. a Google Earth
screenshot centered on the building) - like any edge-detection approach,
it can be thrown off by shadows, trees, or several buildings of similar
size in frame. The `sigma` and `min_area_frac` params exist so a bad
result can be retried with different sensitivity without re-uploading.
"""

import cv2
import numpy as np


def _auto_canny_thresholds(gray: np.ndarray, sigma: float) -> tuple:
    v = float(np.median(gray))
    lower = int(max(0, (1.0 - sigma) * v))
    upper = int(min(255, (1.0 + sigma) * v))
    return lower, upper


def extract_footprint(image_bytes: bytes, sigma: float = 0.33, min_area_frac: float = 0.015) -> dict:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("could not decode image - is it a valid JPG/PNG?")
    h, w = img.shape[:2]
    img_area = w * h

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    # the median-intensity auto-Canny heuristic assumes reasonable overall
    # contrast; low-contrast scenes (a pale rooftop on light pavement, a
    # hazy photo) can give thresholds too high to catch a real but subtle
    # edge, so if that finds nothing, retry with a fixed low-sensitivity
    # pass rather than just reporting failure.
    candidates = []
    for lower, upper in [_auto_canny_thresholds(blur, sigma), (20, 70), (10, 40)]:
        edges = cv2.Canny(blur, lower, upper)
        edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = [c for c in contours if img_area * min_area_frac < cv2.contourArea(c) < img_area * 0.9]
        if candidates:
            break

    if not candidates:
        return {"found": False, "polygon": [], "width": w, "height": h, "area_px": 0, "candidate_count": 0}

    best = max(candidates, key=cv2.contourArea)
    perimeter = cv2.arcLength(best, True)
    approx = cv2.approxPolyDP(best, 0.015 * perimeter, True)
    polygon = [[int(p[0][0]), int(p[0][1])] for p in approx]

    return {
        "found": True,
        "polygon": polygon,
        "width": w,
        "height": h,
        "area_px": round(float(cv2.contourArea(best)), 1),
        "area_frac": round(float(cv2.contourArea(best)) / img_area, 4),
        "candidate_count": len(candidates),
    }
