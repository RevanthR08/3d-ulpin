"""
Build Blender-authored apartment interiors for Intel City residential buildings.

One fitted floorplate per building (same room types, scaled to footprint).
Export intel_city_interiors.glb + metadata JSON.

Run inside Blender (MCP or Scripting):
  import importlib.util
  path = r"E:\\sih3dplanner\\cit_planner\\code\\scripts\\build_intel_city_interiors.py"
  spec = importlib.util.spec_from_file_location("build_intel_city_interiors", path)
  mod = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(mod)
  mod.main()
"""
from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\intel_city")
BLDG_JSON = OUT_DIR / "intel_city_buildings.json"
GLB_PATH = OUT_DIR / "intel_city_interiors.glb"
META_PATH = OUT_DIR / "intel_city_interiors.json"
COLL_NAME = "ANN_Interiors"
KIT_COLL = "ANN_InteriorKit"

RESIDENTIAL = {"lowrise", "midrise", "skyscraper"}
PINCODE = "600001"
WALL_H = 14.0
WALL_T = 0.55
# Fill the real footprint. Soft caps only stop absurd tower mesh AABBs
# from becoming city-block apartments (not a tiny 3BHK stamp).
PLATE_BY_KIND = {
    "lowrise": {"fit": 0.90, "max": 160.0, "min": 36.0},
    "midrise": {"fit": 0.88, "max": 140.0, "min": 40.0},
    "skyscraper": {"fit": 0.85, "max": 110.0, "min": 48.0},
}

# UV partitions of the floorplate (same topology for every building)
ROOM_LAYOUT = [
    {"type": "balcony", "suffix": "BAL", "label": "Balcony", "uv": (0.00, 0.00, 0.52, 0.12), "color": (0.42, 0.72, 0.88, 1.0)},
    {"type": "living_room", "suffix": "LIV", "label": "Living Room", "uv": (0.00, 0.12, 0.52, 0.58), "color": (0.86, 0.74, 0.58, 1.0)},
    {"type": "kitchen", "suffix": "KIT", "label": "Kitchen", "uv": (0.00, 0.58, 0.28, 1.00), "color": (0.92, 0.84, 0.72, 1.0)},
    {"type": "dining", "suffix": "DIN", "label": "Dining", "uv": (0.28, 0.58, 0.52, 1.00), "color": (0.82, 0.70, 0.58, 1.0)},
    {"type": "hall", "suffix": "HAL", "label": "Hall", "uv": (0.52, 0.12, 0.64, 1.00), "color": (0.78, 0.76, 0.72, 1.0)},
    {"type": "master_bedroom", "suffix": "MBR", "label": "Master Bedroom", "uv": (0.64, 0.12, 1.00, 0.55), "color": (0.62, 0.72, 0.86, 1.0)},
    {"type": "bedroom", "suffix": "BR2", "label": "Bedroom", "uv": (0.64, 0.55, 1.00, 0.82), "color": (0.58, 0.78, 0.68, 1.0)},
    {"type": "bathroom", "suffix": "BATH1", "label": "Bathroom", "uv": (0.64, 0.82, 1.00, 1.00), "color": (0.55, 0.78, 0.82, 1.0)},
]


def round3(v: float) -> float:
    return round(float(v), 3)


def ensure_collection(name: str, clear: bool = True):
    old = bpy.data.collections.get(name)
    if old and clear:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for ch in list(old.children):
            for obj in list(ch.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.collections.remove(ch)
        bpy.data.collections.remove(old)
        old = None
    if old is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
        return coll
    return old


def ensure_mat(name: str, rgba, rough=0.55, metal=0.05):
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
        bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = rgba
    return m


def link_obj(coll, obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def set_prop(obj, key, value):
    obj[key] = value


def make_box(name, center, size, mat, coll):
    """size = full extents (sx, sy, sz)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    link_obj(coll, obj)
    sx, sy, sz = size
    cx, cy, cz = center
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def plate_bounds(b):
    """Fill most of the building footprint; soft-cap only runaway tower AABBs."""
    poly = b.get("footprint_polygon") or []
    if len(poly) >= 3:
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
    else:
        aabb = b["aabb_blender"]
        xmin, ymin = aabb["min"][0], aabb["min"][1]
        xmax, ymax = aabb["max"][0], aabb["max"][1]
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    bw = max(1.0, xmax - xmin)
    bd = max(1.0, ymax - ymin)
    cfg = PLATE_BY_KIND.get(b.get("kind") or "midrise", PLATE_BY_KIND["midrise"])
    w = max(cfg["min"], min(cfg["max"], bw * cfg["fit"]))
    d = max(cfg["min"], min(cfg["max"], bd * cfg["fit"]))
    return cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2


def uv_rect(xmin, xmax, ymin, ymax, uv):
    u0, v0, u1, v1 = uv
    x0 = xmin + (xmax - xmin) * u0
    x1 = xmin + (xmax - xmin) * u1
    y0 = ymin + (ymax - ymin) * v0
    y1 = ymin + (ymax - ymin) * v1
    return x0, x1, y0, y1


def add_furniture(room_type, x0, x1, y0, y1, z0, coll, mats, name_prefix):
    """Light Blender furniture dressing scaled to room. Names must start with INT-{nnn} for viewer indexing."""
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    rw = max(4.0, x1 - x0)
    rd = max(4.0, y1 - y0)
    z = z0 + 0.05
    pieces = []

    if room_type == "living_room":
        pieces.append(("sofa", (cx, cy - rd * 0.28, z + 2.4), (rw * 0.55, rd * 0.18, 4.8), mats["fabric"]))
        pieces.append(("table", (cx, cy + rd * 0.05, z + 1.2), (rw * 0.28, rd * 0.22, 2.4), mats["wood"]))
        pieces.append(("tv", (cx, cy + rd * 0.38, z + 4.0), (rw * 0.35, 1.0, 5.5), mats["dark"]))
    elif room_type == "kitchen":
        pieces.append(("counter_l", (x0 + rw * 0.12, cy, z + 2.6), (rw * 0.16, rd * 0.72, 5.2), mats["counter"]))
        pieces.append(("counter_b", (cx, y1 - rd * 0.12, z + 2.6), (rw * 0.7, rd * 0.14, 5.2), mats["counter"]))
        pieces.append(("fridge", (x1 - rw * 0.12, y0 + rd * 0.18, z + 5.0), (rw * 0.14, rd * 0.16, 10.0), mats["metal"]))
    elif room_type == "dining":
        pieces.append(("dtable", (cx, cy, z + 2.0), (rw * 0.45, rd * 0.35, 4.0), mats["wood"]))
        pieces.append(("chair_a", (cx - rw * 0.28, cy, z + 1.6), (rw * 0.1, rd * 0.1, 3.2), mats["fabric"]))
        pieces.append(("chair_b", (cx + rw * 0.28, cy, z + 1.6), (rw * 0.1, rd * 0.1, 3.2), mats["fabric"]))
    elif room_type in ("master_bedroom", "bedroom"):
        pieces.append(("bed", (cx, cy, z + 1.8), (rw * 0.55, rd * 0.7, 3.6), mats["fabric"]))
        pieces.append(("side_l", (x0 + rw * 0.12, cy - rd * 0.25, z + 1.5), (rw * 0.12, rd * 0.12, 3.0), mats["wood"]))
        pieces.append(("wardrobe", (x1 - rw * 0.1, cy, z + 5.5), (rw * 0.12, rd * 0.55, 11.0), mats["wood"]))
    elif room_type == "bathroom":
        pieces.append(("vanity", (cx, y0 + rd * 0.15, z + 2.2), (rw * 0.55, rd * 0.14, 4.4), mats["counter"]))
        pieces.append(("tub", (cx, y1 - rd * 0.22, z + 1.5), (rw * 0.45, rd * 0.28, 3.0), mats["ceramic"]))
    elif room_type == "balcony":
        pieces.append(("rail", (cx, y0 + 0.8, z + 3.0), (rw * 0.9, 0.5, 6.0), mats["metal"]))
    elif room_type == "hall":
        pieces.append(("console", (cx, cy, z + 1.8), (rw * 0.55, rd * 0.2, 3.6), mats["wood"]))

    out = []
    for name, center, size, mat in pieces:
        obj = make_box(f"{name_prefix}-FURN-{name}", center, size, mat, coll)
        out.append(obj)
    return out


def build_kit_materials():
    return {
        "wall": ensure_mat("MAT_INT_WALL", (0.82, 0.80, 0.76, 1.0), 0.75, 0.0),
        "ceil": ensure_mat("MAT_INT_CEIL", (0.90, 0.90, 0.88, 1.0), 0.9, 0.0),
        "wood": ensure_mat("MAT_INT_WOOD", (0.48, 0.30, 0.16, 1.0), 0.45, 0.0),
        "fabric": ensure_mat("MAT_INT_FABRIC", (0.28, 0.42, 0.58, 1.0), 0.85, 0.0),
        "counter": ensure_mat("MAT_INT_COUNTER", (0.62, 0.64, 0.68, 1.0), 0.35, 0.2),
        "metal": ensure_mat("MAT_INT_METAL", (0.45, 0.48, 0.52, 1.0), 0.25, 0.75),
        "dark": ensure_mat("MAT_INT_DARK", (0.08, 0.08, 0.1, 1.0), 0.4, 0.25),
        "ceramic": ensure_mat("MAT_INT_CERAMIC", (0.78, 0.86, 0.90, 1.0), 0.25, 0.0),
    }


def build_building_interior(b, coll, mats, meta_buildings):
    bid = b["id"]
    idx = bid.split("-")[-1] if "-" in bid else bid
    xmin, xmax, ymin, ymax = plate_bounds(b)
    # Author at z≈0; viewer places at floor elevation
    z0 = 0.0
    rooms_meta = []
    group_empty = bpy.data.objects.new(f"INT-{bid}", None)
    link_obj(coll, group_empty)
    set_prop(group_empty, "building_id", bid)
    set_prop(group_empty, "interior_kind", "floorplate")

    for spec in ROOM_LAYOUT:
        x0, x1, y0, y1 = uv_rect(xmin, xmax, ymin, ymax, spec["uv"])
        rw = x1 - x0
        rd = y1 - y0
        if rw < 3 or rd < 3:
            continue
        rname = f"INT-{idx}-{spec['suffix']}"
        floor_mat = ensure_mat(f"MAT_INT_{spec['suffix']}", spec["color"], 0.65, 0.0)
        # Floor slab
        floor = make_box(
            rname,
            ((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.4),
            (rw - 0.4, rd - 0.4, 0.8),
            floor_mat,
            coll,
        )
        # Ceiling
        ceil = make_box(
            f"{rname}-CEIL",
            ((x0 + x1) / 2, (y0 + y1) / 2, z0 + WALL_H),
            (rw - 0.4, rd - 0.4, 0.5),
            mats["ceil"],
            coll,
        )
        # Four walls (openings omitted for solid demo rooms)
        walls = [
            ((x0 + x1) / 2, y0 + WALL_T / 2, z0 + WALL_H / 2, rw, WALL_T, WALL_H),
            ((x0 + x1) / 2, y1 - WALL_T / 2, z0 + WALL_H / 2, rw, WALL_T, WALL_H),
            (x0 + WALL_T / 2, (y0 + y1) / 2, z0 + WALL_H / 2, WALL_T, rd, WALL_H),
            (x1 - WALL_T / 2, (y0 + y1) / 2, z0 + WALL_H / 2, WALL_T, rd, WALL_H),
        ]
        wall_objs = []
        for i, (wx, wy, wz, sx, sy, sz) in enumerate(walls):
            wo = make_box(f"{rname}-W{i}", (wx, wy, wz), (sx, sy, sz), mats["wall"], coll)
            wall_objs.append(wo)

        furn = add_furniture(spec["type"], x0, x1, y0, y1, z0, coll, mats, rname)

        for obj in [floor, ceil, *wall_objs, *furn]:
            obj.parent = group_empty
            set_prop(obj, "building_id", bid)
            set_prop(obj, "room_type", spec["type"])
            set_prop(obj, "room_id", rname)
            set_prop(obj, "room_label", spec["label"])
            kind = "room" if obj == floor else ("ceiling" if obj == ceil else "detail")
            set_prop(obj, "interior_kind", kind)

        set_prop(floor, "interior_kind", "room")
        set_prop(floor, "ulpin", f"3D-IND-{PINCODE}-{idx}-{spec['suffix']}")

        rooms_meta.append({
            "id": rname,
            "type": spec["type"],
            "label": spec["label"],
            "mesh_name": rname,
            "building_id": bid,
            "building_name": b.get("name"),
            "ulpin": f"3D-IND-{PINCODE}-{idx}-{spec['suffix']}",
            "area_sq_m": round3((rw * rd) / 100.0),  # rough demo scale
            "aabb_blender": {
                "min": [round3(x0), round3(y0), round3(z0)],
                "max": [round3(x1), round3(y1), round3(z0 + WALL_H)],
                "center": [
                    round3((x0 + x1) / 2),
                    round3((y0 + y1) / 2),
                    round3(z0 + WALL_H / 2),
                ],
            },
        })

    meta_buildings.append({
        "id": bid,
        "building_id": bid,
        "building_name": b.get("name"),
        "kind": b.get("kind"),
        "ulpin": b.get("ulpin"),
        "group_name": f"INT-{bid}",
        "plate_blender": {
            "min": [round3(xmin), round3(ymin), 0.0],
            "max": [round3(xmax), round3(ymax), round3(WALL_H)],
            "center": [
                round3((xmin + xmax) / 2),
                round3((ymin + ymax) / 2),
                round3(WALL_H / 2),
            ],
        },
        "rooms": rooms_meta,
    })
    return len(rooms_meta)


def export_glb(coll):
    bpy.ops.object.select_all(action="DESELECT")
    # Select all objects in collection tree
    def sel(c):
        for o in c.objects:
            o.select_set(True)
        for ch in c.children:
            sel(ch)
    sel(coll)
    objs = [o for o in bpy.context.selected_objects]
    if not objs:
        raise RuntimeError("No interior objects to export")
    bpy.context.view_layer.objects.active = objs[0]
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
    buildings = [b for b in (reg.get("buildings") or []) if b.get("kind") in RESIDENTIAL]
    if not buildings:
        raise RuntimeError("No residential buildings in registry")

    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    ensure_collection(KIT_COLL, clear=True)
    coll = ensure_collection(COLL_NAME, clear=True)
    mats = build_kit_materials()
    meta_buildings = []
    total_rooms = 0
    for b in buildings:
        n = build_building_interior(b, coll, mats, meta_buildings)
        total_rooms += n
        print("INT", b["id"], b.get("kind"), "rooms", n)

    print("OBJECTS", len(coll.objects), "buildings", len(meta_buildings), "rooms", total_rooms)
    export_glb(coll)
    print("GLB", GLB_PATH, "bytes", GLB_PATH.stat().st_size if GLB_PATH.exists() else 0)

    meta = {
        "meta": {
            "pincode": PINCODE,
            "coord_space": "blender_world_xyz_zup",
            "source": "blender_interior_v1",
            "glb": "intel_city_interiors.glb",
            "wall_h": WALL_H,
            "disclaimer": "Demonstration interior geometry fitted to building footprints — not surveyed cadastral interiors.",
            "building_count": len(meta_buildings),
            "room_count": total_rooms,
            "room_types": [r["type"] for r in ROOM_LAYOUT],
        },
        "buildings": meta_buildings,
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("JSON", META_PATH)
    print("DONE")


if __name__ == "__main__":
    main()
