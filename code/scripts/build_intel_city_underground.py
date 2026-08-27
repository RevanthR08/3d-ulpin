"""
Build real tubular underground utilities in Blender (curves + bevel),
parking/basement volumes, export intel_city_underground.glb + metadata JSON.

Run inside Blender (MCP or Scripting):
  import importlib.util, sys
  path = r"E:\\sih3dplanner\\cit_planner\\code\\scripts\\build_intel_city_underground.py"
  ...
  mod.main()
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\intel_city")
BLDG_JSON = OUT_DIR / "intel_city_buildings.json"
GLB_PATH = OUT_DIR / "intel_city_underground.glb"
META_PATH = OUT_DIR / "intel_city_underground.json"
COLL_NAME = "ANN_Underground"

DEPTH_SCALE = 16.0
FLOOR_H = 3.2 * DEPTH_SCALE
# Minimum burial so pipe tops (+ bevel) stay under land — not visible from above.
COVER_MIN = 38.0
# Shared utility corridors (movie-like dense bundle spacing)
CORRIDOR_STEP = 220.0
PINCODE = "600001"

# Lane offsets within one corridor so all utilities sit side-by-side (visible together).
LAYERS = [
    {
        "type": "fiber_optic",
        "prefix": "UG-FIBER",
        "depth_m": 2.8,
        "bevel": 3.2,
        "color": (0.15, 0.85, 0.95, 1.0),
        "label": "Broadband / fiber",
        "lane": -24.0,
        "z_bias": 0.0,
        "twins": 2,
    },
    {
        "type": "electrical_cable",
        "prefix": "UG-ELEC",
        "depth_m": 4.2,
        "bevel": 4.0,
        "color": (0.95, 0.82, 0.12, 1.0),
        "label": "Electrical",
        "lane": -6.0,
        "z_bias": -14.0,
        "twins": 1,
    },
    {
        "type": "water_pipeline",
        "prefix": "UG-WATER",
        "depth_m": 5.8,
        "bevel": 5.0,
        "color": (0.25, 0.55, 0.98, 1.0),
        "label": "Water",
        "lane": 12.0,
        "z_bias": -28.0,
        "twins": 2,
    },
    {
        "type": "sewer",
        "prefix": "UG-SEWER",
        "depth_m": 7.5,
        "bevel": 5.0,
        "color": (0.95, 0.55, 0.15, 1.0),
        "label": "Sewage",
        "lane": 30.0,
        "z_bias": -48.0,
        "twins": 1,
    },
]

PARKING_KINDS = {"skyscraper", "midrise", "construction"}
BASEMENT_KINDS = {"lowrise"}


def round3(v: float) -> float:
    return round(float(v), 3)


def ensure_collection(name: str):
    # Remove previous generated collection + objects
    old = bpy.data.collections.get(name)
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def ensure_mat(name: str, rgba):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = rgba
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.45
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.35
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = rgba
    return m


def link_obj(coll, obj):
    # Unlink from scene root if auto-linked
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def set_prop(obj, key, value):
    obj[key] = value


def make_curve_pipe(name: str, points_xyz: list[tuple[float, float, float]], bevel: float, mat, coll):
    """Create a beveled POLY curve with sharp elbows. Mesh convert happens in batch later."""
    if len(points_xyz) < 2:
        raise ValueError(f"pipe {name} needs >=2 points")
    curve_data = bpy.data.curves.new(name=name + "_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 4
    curve_data.bevel_depth = bevel
    curve_data.bevel_resolution = 2
    curve_data.fill_mode = "FULL"
    curve_data.twist_mode = "Z_UP"
    # POLY = sharp 90° CAD elbows (movie look) + much faster than BEZIER convert
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points_xyz) - 1)
    for i, (x, y, z) in enumerate(points_xyz):
        spline.points[i].co = (x, y, z, 1.0)

    obj = bpy.data.objects.new(name, curve_data)
    link_obj(coll, obj)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def convert_curves_to_mesh(coll):
    """One-shot convert all curves in collection (avoids per-pipe bpy.ops thrash)."""
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    curves = [o for o in coll.objects if o.type == "CURVE"]
    if not curves:
        return 0
    for o in curves:
        o.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")
    # Keep names clean (convert may leave .001)
    for o in list(coll.objects):
        if o.type == "MESH" and o.name.endswith("_curve"):
            o.name = o.name.replace("_curve", "")
    return len(curves)


def elbow_xy(p0, p1, p2, steps=6):
    """Rounded corner polyline through p0→p1→p2 in 3D."""
    pts = [p0]
    for i in range(1, steps):
        t = i / steps
        # quadratic Bezier corner
        a = (1 - t) * (1 - t)
        b = 2 * (1 - t) * t
        c = t * t
        pts.append((
            a * p0[0] + b * p1[0] + c * p2[0],
            a * p0[1] + b * p1[1] + c * p2[1],
            a * p0[2] + b * p1[2] + c * p2[2],
        ))
    pts.append(p2)
    return pts


def register_util(meta_utils, name, layer, label_extra=""):
    meta_utils.append({
        "id": name,
        "type": layer["type"],
        "label": layer["label"] + label_extra,
        "depth_m": layer["depth_m"],
        "status": "active",
        "ulpin": f"3D-IND-{PINCODE}-{name}",
        "mesh_name": name,
    })


def tag_util(obj, layer, name, label_extra=""):
    set_prop(obj, "ug_type", layer["type"])
    set_prop(obj, "ug_kind", "utility")
    set_prop(obj, "depth_m", layer["depth_m"])
    set_prop(obj, "ulpin", f"3D-IND-{PINCODE}-{name}")
    set_prop(obj, "label", layer["label"] + label_extra)


def layer_z_stack(layer, ground_z):
    """
    Stacked depths under the slab — clear vertical separation like the movie.
    Highest pipe still below COVER_MIN so nothing shows from above.
    """
    bevel = float(layer["bevel"])
    cover = COVER_MIN + bevel * 1.5
    z_hi = ground_z - cover + float(layer.get("z_bias", 0.0))
    span = layer["depth_m"] * DEPTH_SCALE
    z_lo = z_hi - max(55.0, span * 0.85)
    z_mid = (z_hi + z_lo) * 0.5
    return z_lo, z_mid, z_hi, bevel


def zigzag_path_x(x0, x1, y, z_hi, z_mid, z_lo, phase=0):
    """Dense 90° elbows + vertical drops along X (movie corridor)."""
    pts = []
    x = x0
    seg = 280.0
    tier = 0
    zs = (z_hi, z_mid, z_lo)
    y_off = (55 if phase % 2 == 0 else -55)
    first = True
    while x < x1 - 40:
        z = zs[tier % 3]
        y_run = y if (tier % 2 == 0) else y + y_off
        if first:
            pts.append((x, y_run, z_hi))
            pts.append((x + 25, y_run, z_hi))
            pts.append((x + 25, y_run, z))  # vertical drop
            first = False
        else:
            pts.append((x, y_run, z))
        xn = min(x + seg, x1 - 40)
        pts.append((xn, y_run, z))
        # 90° lateral jog then drop/climb to next tier
        y_next = y if ((tier + 1) % 2 == 0) else y + y_off
        z_next = zs[(tier + 1) % 3]
        pts.append((xn, y_next, z))
        pts.append((xn, y_next, z_next))
        x = xn
        tier += 1
    pts.append((x1, pts[-1][1], pts[-1][2]))
    return pts


def zigzag_path_y(y0, y1, x, z_hi, z_mid, z_lo, phase=0):
    """Dense 90° elbows + vertical drops along Y."""
    pts = []
    y = y0
    seg = 260.0
    tier = 0
    zs = (z_hi, z_mid, z_lo)
    x_off = (50 if phase % 2 == 0 else -50)
    first = True
    while y < y1 - 40:
        z = zs[tier % 3]
        x_run = x if (tier % 2 == 0) else x + x_off
        if first:
            pts.append((x_run, y, z_hi))
            pts.append((x_run, y + 25, z_hi))
            pts.append((x_run, y + 25, z))
            first = False
        else:
            pts.append((x_run, y, z))
        yn = min(y + seg, y1 - 40)
        pts.append((x_run, yn, z))
        x_next = x if ((tier + 1) % 2 == 0) else x + x_off
        z_next = zs[(tier + 1) % 3]
        pts.append((x_next, yn, z))
        pts.append((x_next, yn, z_next))
        y = yn
        tier += 1
    pts.append((pts[-1][0], y1, pts[-1][2]))
    return pts


def build_dense_network(xmin, xmax, ymin, ymax, ground_z, coll, meta_utils):
    """
    Movie-style dense utility corridors: ALL utility colors run together in
    the same trench (parallel lanes + stacked depths + sharp elbows).
    """
    mats = {L["type"]: ensure_mat(f"MAT_{L['prefix']}", L["color"]) for L in LAYERS}
    idx = {L["type"]: 1 for L in LAYERS}
    junctions = []

    # --- East–West corridors (dense) ---
    y = ymin + 40
    corr_i = 0
    while y <= ymax - 40:
        for layer in LAYERS:
            z_lo, z_mid, z_hi, bevel = layer_z_stack(layer, ground_z)
            twins = int(layer.get("twins", 1))
            for t in range(twins):
                lane = layer["lane"] + t * 14.0
                name = f"{layer['prefix']}-M{idx[layer['type']]:03d}"
                pts = zigzag_path_x(
                    xmin + 30, xmax - 30, y + lane, z_hi, z_mid, z_lo, phase=corr_i + t
                )
                obj = make_curve_pipe(name, pts, bevel, mats[layer["type"]], coll)
                tag_util(obj, layer, name)
                register_util(meta_utils, name, layer)
                mid = pts[len(pts) // 2]
                junctions.append((Vector(mid), layer, bevel))
                idx[layer["type"]] += 1
        corr_i += 1
        y += CORRIDOR_STEP

    # --- North–South corridors ---
    x = xmin + 60
    corr_i = 0
    while x <= xmax - 60:
        for layer in LAYERS:
            z_lo, z_mid, z_hi, bevel = layer_z_stack(layer, ground_z)
            twins = int(layer.get("twins", 1))
            for t in range(twins):
                lane = layer["lane"] + t * 14.0
                name = f"{layer['prefix']}-F{idx[layer['type']]:03d}"
                pts = zigzag_path_y(
                    ymin + 30, ymax - 30, x + lane, z_hi, z_mid, z_lo, phase=corr_i + t
                )
                obj = make_curve_pipe(
                    name, pts, bevel * 0.92, mats[layer["type"]], coll
                )
                tag_util(obj, layer, name)
                register_util(meta_utils, name, layer)
                mid = pts[len(pts) // 2]
                junctions.append((Vector(mid), layer, bevel))
                idx[layer["type"]] += 1
        corr_i += 1
        x += CORRIDOR_STEP

    # --- Cross-links / T laterals (every 4th junction — keep dense, exportable) ---
    spur_i = 0
    for jloc, layer, bevel in junctions[::4]:
        spur_i += 1
        z_lo, z_mid, z_hi, _ = layer_z_stack(layer, ground_z)
        dx = 90 if spur_i % 2 else -90
        dy = 80 if spur_i % 3 else -80
        sname = f"{layer['prefix']}-S{spur_i:03d}"
        spur_pts = [
            (jloc.x, jloc.y, jloc.z),
            (jloc.x + dx * 0.4, jloc.y, jloc.z),
            (jloc.x + dx * 0.4, jloc.y, z_lo),
            (jloc.x + dx, jloc.y, z_lo),
            (jloc.x + dx, jloc.y + dy, z_lo),
            (jloc.x + dx, jloc.y + dy, z_mid),
            (jloc.x + dx + dy * 0.2, jloc.y + dy, z_mid),
        ]
        sobj = make_curve_pipe(
            sname, spur_pts, bevel * 0.75, mats[layer["type"]], coll
        )
        tag_util(sobj, layer, sname, " lateral")
        register_util(meta_utils, sname, layer, " lateral")

        jname = f"{layer['prefix']}-J{spur_i:03d}"
        jobj = make_junction(jname, jloc, bevel * 1.15, mats[layer["type"]], coll)
        tag_util(jobj, layer, jname, " junction")
        register_util(meta_utils, jname, layer, " junction")

        if spur_i % 2 == 0:
            vname = f"{layer['prefix']}-V{spur_i:03d}"
            vobj = make_curve_pipe(
                vname,
                [
                    (jloc.x + dx * 0.4, jloc.y, z_hi),
                    (jloc.x + dx * 0.4, jloc.y, z_mid),
                    (jloc.x + dx * 0.4, jloc.y, z_lo),
                ],
                bevel * 0.8,
                mats[layer["type"]],
                coll,
            )
            tag_util(vobj, layer, vname, " vertical")
            register_util(meta_utils, vname, layer, " vertical")

    n_curves = convert_curves_to_mesh(coll)
    print("CONVERTED_CURVES", n_curves)


def build_layer_network(layer, xmin, xmax, ymin, ymax, ground_z, coll, meta_utils):
    """Deprecated single-layer path — kept for import safety; use build_dense_network."""
    pass


def make_junction(name: str, loc: Vector, radius: float, mat, coll):
    # Low-poly sphere via mesh primitive (no heavy ops storm)
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius * 1.35, location=loc, segments=8, ring_count=6
    )
    obj = bpy.context.active_object
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def city_bounds(buildings):
    xs, ys, zs = [], [], []
    for b in buildings:
        aabb = b["aabb_blender"]
        xs += [aabb["min"][0], aabb["max"][0]]
        ys += [aabb["min"][1], aabb["max"][1]]
        zs.append(aabb["min"][2])
    pad = 180.0
    return min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad, min(zs)


def building_index(ulpin: str) -> str:
    if "-I" in ulpin:
        return ulpin.rsplit("-I", 1)[-1]
    return ulpin


def make_box(name, center, size, mat, coll):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def build_structures(buildings, ground_z, coll, meta_structs):
    mat_park = ensure_mat("MAT_UG_PARK", (0.55, 0.6, 0.68, 1.0))
    mat_base = ensure_mat("MAT_UG_BASE", (0.62, 0.58, 0.52, 1.0))
    for b in buildings:
        kind = b.get("kind") or "lowrise"
        if kind == "stadium":
            continue
        aabb = b["aabb_blender"]
        cx = (aabb["min"][0] + aabb["max"][0]) / 2
        cy = (aabb["min"][1] + aabb["max"][1]) / 2
        hx = min((aabb["max"][0] - aabb["min"][0]) * 0.36, 180.0)
        hy = min((aabb["max"][1] - aabb["min"][1]) * 0.36, 180.0)
        idx = building_index(b["ulpin"])

        if kind in PARKING_KINDS:
            levels = 2.0 if kind == "skyscraper" else 1.5
            # Just under building base — not flush with land surface
            top = ground_z - COVER_MIN * 0.55
            bottom = top - levels * FLOOR_H
            hz = (top - bottom)
            name = f"UG-PARK-{idx}"
            obj = make_box(
                name,
                Vector((cx, cy, (top + bottom) / 2)),
                (hx * 2, hy * 2, hz),
                mat_park,
                coll,
            )
            spaces = 80 if kind == "skyscraper" else (48 if kind == "midrise" else 24)
            set_prop(obj, "ug_type", "underground_parking")
            set_prop(obj, "ug_kind", "structure")
            set_prop(obj, "building_id", b["id"])
            set_prop(obj, "building_name", b["name"])
            set_prop(obj, "depth_m", levels * 3.2)
            set_prop(obj, "ulpin", f"{b['ulpin']}-UG-P")
            set_prop(obj, "label", f"Parking — {b['name']}")
            set_prop(obj, "spaces", spaces)
            meta_structs.append({
                "id": name,
                "type": "underground_parking",
                "label": f"Parking — {b['name']}",
                "building_id": b["id"],
                "building_name": b["name"],
                "building_kind": kind,
                "ulpin": f"{b['ulpin']}-UG-P",
                "spaces": spaces,
                "depth_m": round3(levels * 3.2),
                "status": "active",
                "mesh_name": name,
                "aabb_blender": {
                    "min": [round3(cx - hx), round3(cy - hy), round3(bottom)],
                    "max": [round3(cx + hx), round3(cy + hy), round3(top)],
                    "center": [round3(cx), round3(cy), round3((top + bottom) / 2)],
                },
            })
        elif kind in BASEMENT_KINDS:
            top = ground_z - COVER_MIN * 0.55
            bottom = top - FLOOR_H
            hz = top - bottom
            name = f"UG-BASE-{idx}"
            obj = make_box(
                name,
                Vector((cx, cy, (top + bottom) / 2)),
                (hx * 2 * 0.9, hy * 2 * 0.9, hz),
                mat_base,
                coll,
            )
            set_prop(obj, "ug_type", "basement")
            set_prop(obj, "ug_kind", "structure")
            set_prop(obj, "building_id", b["id"])
            set_prop(obj, "building_name", b["name"])
            set_prop(obj, "depth_m", 3.2)
            set_prop(obj, "ulpin", f"{b['ulpin']}-UG-B")
            set_prop(obj, "label", f"Basement — {b['name']}")
            meta_structs.append({
                "id": name,
                "type": "basement",
                "label": f"Basement — {b['name']}",
                "building_id": b["id"],
                "building_name": b["name"],
                "building_kind": kind,
                "ulpin": f"{b['ulpin']}-UG-B",
                "spaces": None,
                "depth_m": 3.2,
                "status": "active",
                "mesh_name": name,
                "aabb_blender": {
                    "min": [round3(cx - hx * 0.9), round3(cy - hy * 0.9), round3(bottom)],
                    "max": [round3(cx + hx * 0.9), round3(cy + hy * 0.9), round3(top)],
                    "center": [round3(cx), round3(cy), round3((top + bottom) / 2)],
                },
            })


def export_glb(coll):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in coll.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = coll.objects[0] if coll.objects else None
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_animations=False,
        export_extras=True,
    )


def main():
    with open(BLDG_JSON, encoding="utf-8") as f:
        reg = json.load(f)
    buildings = reg.get("buildings") or []
    if not buildings:
        raise RuntimeError("No buildings in registry")

    xmin, xmax, ymin, ymax, ground_z = city_bounds(buildings)
    print("BOUNDS", xmin, xmax, ymin, ymax, "GROUND_Z", ground_z)

    # Object mode
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    coll = ensure_collection(COLL_NAME)
    meta_utils = []
    meta_structs = []

    for layer in LAYERS:
        print("LAYER", layer["type"], "lane", layer["lane"])
    build_dense_network(xmin, xmax, ymin, ymax, ground_z, coll, meta_utils)

    build_structures(buildings, ground_z, coll, meta_structs)
    print("OBJECTS", len(coll.objects), "utils", len(meta_utils), "structs", len(meta_structs))

    export_glb(coll)
    print("GLB", GLB_PATH, "bytes", GLB_PATH.stat().st_size if GLB_PATH.exists() else 0)

    meta = {
        "meta": {
            "pincode": PINCODE,
            "coord_space": "blender_world_xyz_zup",
            "source": "blender_underground_v1",
            "glb": "intel_city_underground.glb",
            "depth_scale": DEPTH_SCALE,
            "cover_min": COVER_MIN,
            "ground_z_blender": round3(ground_z),
            "utility_count": len(meta_utils),
            "structure_count": len(meta_structs),
        },
        "utilities": meta_utils,
        "structures": meta_structs,
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("JSON", META_PATH)
    print("DONE")


if __name__ == "__main__":
    main()
