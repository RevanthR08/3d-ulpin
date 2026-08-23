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


def _is_frame_artifact(contour, w: int, h: int, margin: int = 3) -> bool:
    """True if a contour's bounding box hugs all 4 image edges - i.e. it's
    tracing the frame/border itself, not a real object. A tightly-cropped
    building can legitimately fill 90%+ of the frame, so area alone can't
    tell the two apart; touching every edge is the actual tell."""
    x, y, bw, bh = cv2.boundingRect(contour)
    return x <= margin and y <= margin and (x + bw) >= (w - margin) and (y + bh) >= (h - margin)


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
        candidates = [
            c for c in contours
            if cv2.contourArea(c) > img_area * min_area_frac and not _is_frame_artifact(c, w, h)
        ]
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


def extract_footprint_assisted(image_bytes: bytes, rect: tuple) -> dict:
    """Assisted mode: the caller draws a rough rectangle around the
    building (rect = (x, y, w, h) in image pixel coordinates); GrabCut
    (models foreground/background as color distributions, not edges) then
    refines that into an accurate outline. Much more robust than pure edge
    detection on busy/hazy real photos where the building doesn't stand
    out sharply from trees/ground - it only needs the rectangle to roughly
    contain the building, not a precise crop."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("could not decode image - is it a valid JPG/PNG?")
    h, w = img.shape[:2]
    img_area = w * h

    rx, ry, rw, rh = rect
    rx, ry = max(0, int(rx)), max(0, int(ry))
    rw, rh = min(int(rw), w - rx - 1), min(int(rh), h - ry - 1)
    if rw <= 10 or rh <= 10:
        raise ValueError("selection rectangle too small")

    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, (rx, ry, rw, rh), bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)

    fg = np.where((mask == 2) | (mask == 0), 0, 255).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))

    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"found": False, "polygon": [], "width": w, "height": h, "area_px": 0}

    best = max(contours, key=cv2.contourArea)
    perimeter = cv2.arcLength(best, True)
    approx = cv2.approxPolyDP(best, 0.01 * perimeter, True)
    polygon = [[int(p[0][0]), int(p[0][1])] for p in approx]

    return {
        "found": True,
        "polygon": polygon,
        "width": w,
        "height": h,
        "area_px": round(float(cv2.contourArea(best)), 1),
        "area_frac": round(float(cv2.contourArea(best)) / img_area, 4),
    }
