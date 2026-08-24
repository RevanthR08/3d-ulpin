"""
Blender import script for the 3D ULPIN Registry.

Fetches GET /blender-export from the running API and generates every
building automatically - real footprint polygons (local metres, +x=east,
+y=north) at their real, road-verified positions, extruded per floor to
each floor's REAL base/top elevation from the source dataset. Nothing in
here is manually placed or eyeballed; every number comes straight from
the API.

HOW TO RUN
  1. Start the API first (from the `code/` folder):
       python -m uvicorn app.main:app --port 8000
  2. In Blender: Scripting tab -> Open -> this file -> Run Script (Alt+P).
     Or headless: blender --background --python blender_import.py
  3. If Blender can't reach the API (e.g. running on a different
     machine), save the JSON from http://127.0.0.1:8000/blender-export
     to blender_export.json next to this script - it's used as a
     fallback automatically.

WHAT IT BUILDS
  One Blender collection per building, one mesh object per floor inside
  it (so floors can be selected/hidden/colored independently, same as
  the web 3D viewer). Each floor object gets custom properties:
    ulpin, building_id, floor_label, units (JSON string: unit/ulpin/
    type/owner/legal_status for every unit on that floor) - so "which
    ULPIN is this mesh" and "who's on this floor" travel with the
    geometry instead of living in a separate spreadsheet.

Must be run from inside Blender (needs the `bpy` module) - it will not
work as a plain `python blender_import.py` outside Blender.
"""

import json
import os
import urllib.request

import bpy
import bmesh

API_URL = "http://127.0.0.1:8000/blender-export"
LOCAL_FALLBACK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blender_export.json")

TYPE_COLORS = {
    "residential_tower": (0.09, 0.70, 0.64, 1.0),
    "residential_midrise": (0.09, 0.70, 0.64, 1.0),
    "low_rise_residential": (0.09, 0.70, 0.64, 1.0),
    "community_facility": (0.49, 0.36, 0.83, 1.0),
    "utility_facility": (0.88, 0.54, 0.17, 1.0),
}
DEFAULT_COLOR = (0.6, 0.6, 0.6, 1.0)


def load_data():
    try:
        with urllib.request.urlopen(API_URL, timeout=5) as resp:
            print(f"Loaded data from {API_URL}")
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Could not reach {API_URL} ({e}); trying {LOCAL_FALLBACK}")
        with open(LOCAL_FALLBACK, "r", encoding="utf-8") as f:
            return json.load(f)


def get_material(name, color):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    if mat.use_nodes:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = color
    return mat


def make_floor_mesh(name, footprint_xy, base_z, top_z):
    """Extrudes the (already-real, already-correctly-ordered) footprint
    polygon from base_z to top_z - a solid prism matching that floor's
    exact real elevation range."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, base_z)) for x, y in footprint_xy]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    result = bmesh.ops.extrude_face_region(bm, geom=[face])
    extruded_verts = [g for g in result["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=extruded_verts, vec=(0.0, 0.0, top_z - base_z))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def run():
    data = load_data()

    root = bpy.data.collections.get("3D ULPIN Registry") or bpy.data.collections.new("3D ULPIN Registry")
    if root.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(root)

    floor_count = 0
    for b in data["buildings"]:
        b_collection = bpy.data.collections.new(f"{b['block']} - {b['name']}")
        root.children.link(b_collection)

        color = TYPE_COLORS.get(b["type"], DEFAULT_COLOR)
        mat = get_material(f"mat_{b['type']}", color)

        for floor in b["floors"]:
            mesh = make_floor_mesh(floor["ulpin"], b["footprint_m"], floor["base_elevation_m"], floor["top_elevation_m"])
            obj = bpy.data.objects.new(floor["ulpin"], mesh)
            obj.data.materials.append(mat)
            obj["ulpin"] = floor["ulpin"]
            obj["building_id"] = b["id"]
            obj["building_name"] = b["name"]
            obj["floor_label"] = floor["label"]
            obj["units"] = json.dumps(floor["units"])
            b_collection.objects.link(obj)
            floor_count += 1

    print(f"Generated {len(data['buildings'])} buildings, {floor_count} floors.")


if __name__ == "__main__":
    run()
