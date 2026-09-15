"""
Import downloaded metro bridge / tunnel meshes into Intel City and export
intel_city_metro.glb for the twin.

Drop files in:
  E:\\sih3dplanner\\cit_planner\\code\\app\\static3d\\intel_city\\metro_assets\\
Name hints: *bridge* / *viaduct*  → elevated deck
            *tunnel* / *subway*   → underground tube

Run in Blender (MCP or Scripting):
  import importlib.util
  path = r"E:\\sih3dplanner\\cit_planner\\code\\scripts\\place_intel_city_metro.py"
  spec = importlib.util.spec_from_file_location("place_metro", path)
  mod = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(mod)
  mod.main()
"""
from __future__ import annotations

import os
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\intel_city")
DROP = ROOT / "metro_assets"
GLB_PATH = ROOT / "intel_city_metro.glb"
COLL_NAME = "ANN_Metro"

# Existing rail corridor (Blender Z-up).
TRACK_Y = -2024.0
VIADUCT_X = -150.0
VIADUCT_Z = 18.0
VIADUCT_TARGET_LEN = 1100.0
TUNNEL_X = 1117.0
TUNNEL_Z = -42.0
TUNNEL_TARGET_LEN = 1600.0


def _ensure_coll():
    coll = bpy.data.collections.get(COLL_NAME)
    if coll:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return coll
    coll = bpy.data.collections.new(COLL_NAME)
    bpy.context.scene.collection.children.link(coll)
    return coll


def _world_size(obj):
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [v.x for v in bb]
    ys = [v.y for v in bb]
    zs = [v.z for v in bb]
    return max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)


def _import_file(path: Path):
    before = set(bpy.data.objects)
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        return []
    return [o for o in bpy.data.objects if o not in before]


def _link(coll, obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def _place_as(kind: str, roots: list, coll):
    if not roots:
        return
    # Prefer the largest mesh as the body.
    meshes = [o for o in roots if o.type == "MESH"] or roots
    body = max(meshes, key=lambda o: (o.dimensions.x * o.dimensions.y * o.dimensions.z))
    sx, sy, sz = _world_size(body)
    long_axis = max(sx, sy, sz) or 1.0
    target = VIADUCT_TARGET_LEN if kind == "viaduct" else TUNNEL_TARGET_LEN
    scale = target / long_axis
    # Parent empties: scale the imported root if present.
    tops = [o for o in roots if o.parent is None]
    for o in tops:
        o.scale *= scale
        bpy.context.view_layer.update()
        if kind == "viaduct":
            o.location = (VIADUCT_X, TRACK_Y, VIADUCT_Z)
        else:
            o.location = (TUNNEL_X, TRACK_Y, TUNNEL_Z)
        o.name = f"METRO-{'VIADUCT' if kind == 'viaduct' else 'TUNNEL'}-ASSET"
        _link(coll, o)
        for ch in o.children_recursive:
            _link(coll, ch)


def main():
    coll = _ensure_coll()
    DROP.mkdir(parents=True, exist_ok=True)
    files = [
        p
        for p in DROP.iterdir()
        if p.suffix.lower() in {".glb", ".gltf", ".fbx", ".obj"} and p.is_file()
    ]
    if not files:
        print(f"[metro] no assets in {DROP} — drop bridge/tunnel GLB/FBX then re-run")
        return

    bridges, tunnels, other = [], [], []
    for p in files:
        n = p.stem.lower()
        imported = _import_file(p)
        print(f"[metro] imported {p.name} → {len(imported)} objects")
        if any(k in n for k in ("bridge", "viaduct", "overpass", "flyover")):
            bridges.append(imported)
        elif any(k in n for k in ("tunnel", "subway", "metro_ug", "bore")):
            tunnels.append(imported)
        else:
            other.append(imported)

    for batch in bridges:
        _place_as("viaduct", batch, coll)
    for batch in tunnels:
        _place_as("tunnel", batch, coll)
    # Unnamed leftovers: first → viaduct, second → tunnel
    if other and not bridges:
        _place_as("viaduct", other[0], coll)
        other = other[1:]
    if other and not tunnels:
        _place_as("tunnel", other[0], coll)

    bpy.context.view_layer.update()
    # Export only the metro collection
    for obj in bpy.data.objects:
        obj.select_set(obj.name.startswith("METRO-") or obj.name in {o.name for o in coll.objects})
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        use_selection=True,
        export_format="GLB",
        export_apply=True,
    )
    print(f"[metro] exported {GLB_PATH}")


if __name__ == "__main__":
    main()
