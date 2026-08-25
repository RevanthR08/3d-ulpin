"""
Blender importer: BHU GeoJSON (local XY) -> textured multi-storey buildings -> GLB.

Produces:
  - Grass site ground (PBR)
  - Per-building EMPTY root named BHU-3D-xxx (origin at base for raise animation)
  - Hollow shell with Solidify wall thickness
  - Floor slabs at each storey
  - Mock interior room partitions (ground floor + mid floor)
  - Roof slab + parapet
  - Semantic PBR: plaster/brick/concrete walls + roof + grass
"""

from __future__ import annotations

import json
import math
import zlib
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


GEOJSON_PATH = Path(r"E:\sih3dplanner\cit_planner\bhu-satya-polygons.geojson")
OUT_GLB_PATH = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\bhu_demo.glb")
TEX_DIR = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\textures")

FLOOR_HEIGHT_M = 3.2
WALL_THICKNESS_M = 0.35
SLAB_THICKNESS_M = 0.22
PARAPET_H_M = 0.85
ROOM_WALL_T_M = 0.12


def _ensure_collection(name: str) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll:
        return coll
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def _clear_collection(coll: bpy.types.Collection) -> None:
    for obj in list(coll.objects):
        try:
            coll.objects.unlink(obj)
        except Exception:
            pass
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass


def _link_object(obj: bpy.types.Object, coll: bpy.types.Collection) -> None:
    if obj.name not in coll.objects:
        coll.objects.link(obj)
    try:
        bpy.context.scene.collection.objects.unlink(obj)
    except Exception:
        pass


def _load_image(path: Path) -> bpy.types.Image | None:
    if not path.is_file():
        return None
    existing = bpy.data.images.get(path.name)
    if existing:
        return existing
    img = bpy.data.images.load(str(path))
    try:
        img.pack()
    except Exception:
        pass
    return img


def _make_pbr_material(
    name: str,
    base_color_path: Path,
    normal_path: Path | None = None,
    roughness_path: Path | None = None,
    roughness: float = 0.82,
) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat:
        return mat

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    for n in list(nodes):
        nodes.remove(n)

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (560, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (280, 0)
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex = nodes.new("ShaderNodeTexImage")
    tex.location = (0, 40)
    img = _load_image(base_color_path)
    if img:
        img.colorspace_settings.name = "sRGB"
        tex.image = img
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    if normal_path:
        nimg = _load_image(normal_path)
        if nimg:
            nimg.colorspace_settings.name = "Non-Color"
            ntex = nodes.new("ShaderNodeTexImage")
            ntex.location = (0, -180)
            ntex.image = nimg
            nmap = nodes.new("ShaderNodeNormalMap")
            nmap.location = (280, -180)
            links.new(ntex.outputs["Color"], nmap.inputs["Color"])
            links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    if roughness_path:
        rimg = _load_image(roughness_path)
        if rimg:
            rimg.colorspace_settings.name = "Non-Color"
            rtex = nodes.new("ShaderNodeTexImage")
            rtex.location = (0, -360)
            rtex.image = rimg
            links.new(rtex.outputs["Color"], bsdf.inputs["Roughness"])
        else:
            bsdf.inputs["Roughness"].default_value = roughness
    else:
        bsdf.inputs["Roughness"].default_value = roughness

    bsdf.inputs["Metallic"].default_value = 0.02
    return mat


def _make_flat_material(name: str, rgba: tuple[float, float, float, float], roughness: float = 0.7) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def _ensure_uvs(mesh: bpy.types.Mesh, tex_scale_m: float = 3.0) -> None:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    uv_layer = bm.loops.layers.uv.verify()
    s = float(tex_scale_m) if tex_scale_m else 3.0
    for face in bm.faces:
        n = face.normal
        nz = abs(n.z)
        nx = abs(n.x)
        ny = abs(n.y)
        for loop in face.loops:
            v = loop.vert.co
            if nz > 0.7:
                uv = (v.x / s, v.y / s)
            elif nx >= ny:
                uv = (v.y / s, v.z / s)
            else:
                uv = (v.x / s, v.z / s)
            loop[uv_layer].uv = uv
    bm.to_mesh(mesh)
    bm.free()


def _ring_pts(ring_xy: list) -> list[tuple[float, float]]:
    pts = ring_xy[:-1] if ring_xy and ring_xy[0] == ring_xy[-1] else list(ring_xy)
    out = []
    for p in pts:
        out.append((float(p[0]), float(p[1])))
    return out


def _centroid(pts: list[tuple[float, float]]) -> tuple[float, float]:
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def _bounds(pts: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def _mesh_object(name: str, mesh: bpy.types.Mesh, location, coll, parent=None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    _link_object(obj, coll)
    if parent is not None:
        obj.parent = parent
    return obj


def _extruded_prism(name: str, pts_local: list[tuple[float, float]], z0: float, z1: float) -> bpy.types.Mesh:
    """Create a solid prism from a 2D ring between z0 and z1 (local XY)."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts_local]
    top = [bm.verts.new((x, y, z1)) for x, y in pts_local]
    bm.verts.ensure_lookup_table()
    try:
        bm.faces.new(bot)
        bm.faces.new(list(reversed(top)))
    except ValueError:
        # non-planar / bad winding — try reverse
        try:
            bm.faces.new(list(reversed(bot)))
            bm.faces.new(top)
        except ValueError:
            bm.free()
            raise ValueError(f"{name}: cannot create faces")
    n = len(pts_local)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((bot[i], bot[j], top[j], top[i]))
        except ValueError:
            pass
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def _solidify_shell(obj: bpy.types.Object, thickness: float) -> None:
    mod = obj.modifiers.new(name="WallSolidify", type="SOLIDIFY")
    mod.thickness = thickness
    mod.offset = -1.0  # inward
    mod.use_even_offset = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception:
        pass
    obj.select_set(False)


def _add_floor_slab(
    name: str,
    pts_local: list[tuple[float, float]],
    z: float,
    thickness: float,
    mat: bpy.types.Material,
    parent: bpy.types.Object,
    coll: bpy.types.Collection,
    inset: float = 0.15,
) -> bpy.types.Object:
    # inset polygon slightly so slab sits inside walls
    cx = sum(p[0] for p in pts_local) / len(pts_local)
    cy = sum(p[1] for p in pts_local) / len(pts_local)
    inset_pts = []
    for x, y in pts_local:
        dx, dy = x - cx, y - cy
        L = math.hypot(dx, dy) or 1.0
        inset_pts.append((x - dx / L * inset, y - dy / L * inset))
    mesh = _extruded_prism(name + "_MESH", inset_pts, z, z + thickness)
    obj = _mesh_object(name, mesh, (0, 0, 0), coll, parent=parent)
    obj.data.materials.append(mat)
    _ensure_uvs(obj.data, tex_scale_m=4.0)
    return obj


def _add_partition_walls(
    name_prefix: str,
    pts_local: list[tuple[float, float]],
    z0: float,
    z1: float,
    mat: bpy.types.Material,
    parent: bpy.types.Object,
    coll: bpy.types.Collection,
    seed: int,
) -> None:
    """Simple mock rooms: axis-aligned partition grid inside bounding box."""
    minx, miny, maxx, maxy = _bounds(pts_local)
    w = maxx - minx
    d = maxy - miny
    if w < 8 or d < 8:
        return

    # 2x2 or 2x3 rooms depending on size
    nx = 2 if w < 25 else 3
    ny = 2 if d < 25 else 3
    # jitter room count with seed for variety
    if seed % 2 == 0 and nx > 2:
        nx -= 1

    t = ROOM_WALL_T_M
    # vertical partitions (constant X)
    for i in range(1, nx):
        x = minx + (w * i / nx)
        # wall along Y
        wall_pts = [
            (x - t / 2, miny + 0.4),
            (x + t / 2, miny + 0.4),
            (x + t / 2, maxy - 0.4),
            (x - t / 2, maxy - 0.4),
        ]
        mesh = _extruded_prism(f"{name_prefix}_VX{i}_MESH", wall_pts, z0, z1)
        obj = _mesh_object(f"{name_prefix}_VX{i}", mesh, (0, 0, 0), coll, parent=parent)
        obj.data.materials.append(mat)
        _ensure_uvs(obj.data, tex_scale_m=2.5)

    # horizontal partitions (constant Y)
    for j in range(1, ny):
        y = miny + (d * j / ny)
        wall_pts = [
            (minx + 0.4, y - t / 2),
            (maxx - 0.4, y - t / 2),
            (maxx - 0.4, y + t / 2),
            (minx + 0.4, y + t / 2),
        ]
        mesh = _extruded_prism(f"{name_prefix}_HY{j}_MESH", wall_pts, z0, z1)
        obj = _mesh_object(f"{name_prefix}_HY{j}", mesh, (0, 0, 0), coll, parent=parent)
        obj.data.materials.append(mat)
        _ensure_uvs(obj.data, tex_scale_m=2.5)


def _add_window_bands(
    name: str,
    pts_local: list[tuple[float, float]],
    floors: int,
    floor_h: float,
    mat: bpy.types.Material,
    parent: bpy.types.Object,
    coll: bpy.types.Collection,
) -> None:
    """Push thin glass strips on each facade edge as floor window bands."""
    n = len(pts_local)
    glass_t = 0.06
    for fi in range(floors):
        z0 = fi * floor_h + 0.9
        z1 = z0 + 1.4
        if z1 >= floors * floor_h - 0.3:
            continue
        for i in range(n):
            x0, y0 = pts_local[i]
            x1, y1 = pts_local[(i + 1) % n]
            edge_len = math.hypot(x1 - x0, y1 - y0)
            if edge_len < 4.0:
                continue
            # outward normal (approx)
            dx, dy = x1 - x0, y1 - y0
            nx, ny = -dy / edge_len, dx / edge_len
            # offset slightly outward
            ox, oy = nx * 0.02, ny * 0.02
            # inset from corners
            inset = min(1.2, edge_len * 0.08)
            ux, uy = dx / edge_len, dy / edge_len
            ax, ay = x0 + ux * inset + ox, y0 + uy * inset + oy
            bx, by = x1 - ux * inset + ox, y1 - uy * inset + oy
            # thin box along edge
            px, py = -ny * glass_t, nx * glass_t  # perpendicular thickness
            wall_pts = [
                (ax, ay),
                (bx, by),
                (bx + px, by + py),
                (ax + px, ay + py),
            ]
            mesh = _extruded_prism(f"{name}_W{fi}_{i}_MESH", wall_pts, z0, z1)
            obj = _mesh_object(f"{name}_W{fi}_{i}", mesh, (0, 0, 0), coll, parent=parent)
            obj.data.materials.append(mat)


def _build_building(
    bid: str,
    ring_xy: list,
    floors: int,
    mats: dict,
    coll: bpy.types.Collection,
) -> bpy.types.Object:
    pts = _ring_pts(ring_xy)
    cx, cy = _centroid(pts)
    pts_local = [(x - cx, y - cy) for x, y in pts]
    height_m = max(FLOOR_HEIGHT_M, floors * FLOOR_HEIGHT_M)

    # Parent empty at world centroid / base — raise scales this
    root = bpy.data.objects.new(bid, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 1.0
    root.location = (cx, cy, 0.0)
    root["building_id"] = bid
    root["floors"] = floors
    root["height_m"] = height_m
    _link_object(root, coll)

    # Outer shell prism
    shell_mesh = _extruded_prism(f"{bid}_SHELL_MESH", pts_local, 0.0, height_m)
    shell = _mesh_object(f"{bid}_SHELL", shell_mesh, (0, 0, 0), coll, parent=root)

    # Material by floors + id
    h = zlib.adler32(bid.encode("utf-8")) % 3
    if floors >= 6:
        wall_mat = [mats["brick"], mats["plaster"], mats["brick"]][h]
    elif floors >= 4:
        wall_mat = [mats["plaster"], mats["brick"], mats["plaster"]][h]
    else:
        wall_mat = [mats["concrete"], mats["plaster"], mats["concrete"]][h]
    shell.data.materials.append(wall_mat)
    shell.data.materials.append(mats["roof"])
    # assign roof faces before solidify
    bm = bmesh.new()
    bm.from_mesh(shell.data)
    for face in bm.faces:
        if face.normal.z > 0.7:
            z_avg = sum(v.co.z for v in face.verts) / max(1, len(face.verts))
            if z_avg >= height_m * 0.9:
                face.material_index = 1
    bm.to_mesh(shell.data)
    bm.free()
    _ensure_uvs(shell.data, tex_scale_m=2.8)

    # Hollow the shell
    _solidify_shell(shell, WALL_THICKNESS_M)
    _ensure_uvs(shell.data, tex_scale_m=2.8)

    # Floor slabs (including ground + intermediate + roof deck underside)
    for fi in range(floors + 1):
        z = fi * FLOOR_HEIGHT_M
        if fi == floors:
            z = height_m - SLAB_THICKNESS_M
        slab_mat = mats["concrete"] if fi < floors else mats["roof"]
        _add_floor_slab(
            f"{bid}_FLOOR_{fi}",
            pts_local,
            z,
            SLAB_THICKNESS_M,
            slab_mat,
            root,
            coll,
            inset=WALL_THICKNESS_M + 0.05,
        )

    # Parapet ring on roof
    parapet_pts = pts_local
    parapet_mesh = _extruded_prism(
        f"{bid}_PARAPET_MESH",
        parapet_pts,
        height_m,
        height_m + PARAPET_H_M,
    )
    parapet = _mesh_object(f"{bid}_PARAPET", parapet_mesh, (0, 0, 0), coll, parent=root)
    parapet.data.materials.append(wall_mat)
    _ensure_uvs(parapet.data, tex_scale_m=2.5)
    # thin parapet via solidify
    _solidify_shell(parapet, 0.18)

    # Mock interior rooms on floor 0 and a mid floor
    interior_floors = [0]
    if floors >= 3:
        interior_floors.append(floors // 2)
    seed = zlib.adler32(bid.encode("utf-8"))
    for fi in interior_floors:
        z0 = fi * FLOOR_HEIGHT_M + SLAB_THICKNESS_M
        z1 = (fi + 1) * FLOOR_HEIGHT_M - 0.05
        _add_partition_walls(
            f"{bid}_ROOM_F{fi}",
            pts_local,
            z0,
            z1,
            mats["interior"],
            root,
            coll,
            seed + fi,
        )

    # Window bands for floor readability
    _add_window_bands(bid, pts_local, floors, FLOOR_HEIGHT_M, mats["glass"], root, coll)

    return root


def main() -> None:
    if not GEOJSON_PATH.is_file():
        raise SystemExit(f"GeoJSON not found: {GEOJSON_PATH}")

    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = data.get("features", [])

    coll = _ensure_collection("BHU_DEMO")
    _clear_collection(coll)

    mats = {
        "plaster": _make_pbr_material(
            "MAT_PLASTER",
            TEX_DIR / "plaster_diff.jpg",
            TEX_DIR / "plaster_nor.jpg",
            TEX_DIR / "plaster_rough.jpg",
            roughness=0.78,
        ),
        "brick": _make_pbr_material("MAT_BRICK", TEX_DIR / "brick_diff.jpg", None, None, roughness=0.85),
        "concrete": _make_pbr_material("MAT_CONCRETE", TEX_DIR / "concrete_diff.jpg", None, None, roughness=0.9),
        "roof": _make_pbr_material("MAT_ROOF", TEX_DIR / "roof_diff.jpg", None, None, roughness=0.88),
        "grass": _make_pbr_material(
            "MAT_GRASS",
            TEX_DIR / "grass_diff.jpg",
            TEX_DIR / "grass_nor.jpg",
            None,
            roughness=0.95,
        ),
        "asphalt": _make_pbr_material(
            "MAT_ASPHALT",
            TEX_DIR / "asphalt_diff.jpg",
            TEX_DIR / "asphalt_nor.jpg",
            None,
            roughness=0.92,
        ),
        "interior": _make_flat_material("MAT_INTERIOR", (0.92, 0.90, 0.86, 1.0), roughness=0.75),
        "glass": _make_flat_material("MAT_GLASS", (0.55, 0.75, 0.88, 0.55), roughness=0.15),
    }
    mats["glass"].blend_method = "BLEND"
    try:
        mats["glass"].shadow_method = "NONE"
    except Exception:
        pass

    # Ground from site_boundary — thin grass pad
    site = next((f for f in features if f.get("properties", {}).get("kind") == "site_boundary"), None)
    if site:
        ring = site["geometry"]["coordinates"][0]
        pts = _ring_pts(ring)
        cx, cy = _centroid(pts)
        pts_local = [(x - cx, y - cy) for x, y in pts]
        gmesh = _extruded_prism("SITE_GROUND_MESH", pts_local, -0.05, 0.02)
        ground = _mesh_object("SITE_GROUND", gmesh, (cx, cy, 0.0), coll)
        ground.data.materials.append(mats["grass"])
        # large UV scale so grass doesn't look like fabric weave
        _ensure_uvs(ground.data, tex_scale_m=28.0)

        # simple asphalt path strip through site center (visual interest)
        minx, miny, maxx, maxy = _bounds(pts_local)
        road_w = 8.0
        road_pts = [
            (minx + 20, -road_w / 2),
            (maxx - 20, -road_w / 2),
            (maxx - 20, road_w / 2),
            (minx + 20, road_w / 2),
        ]
        rmesh = _extruded_prism("SITE_ROAD_MESH", road_pts, 0.02, 0.08)
        road = _mesh_object("SITE_ROAD", rmesh, (cx, cy, 0.0), coll)
        road.data.materials.append(mats["asphalt"])
        _ensure_uvs(road.data, tex_scale_m=12.0)

    buildings = [f for f in features if f.get("properties", {}).get("kind") == "building"]
    for feat in buildings:
        props = feat.get("properties", {})
        bid = str(props.get("id", "BUILDING")).strip()
        floors = int(props.get("simulated_floors") or 3)
        ring = feat["geometry"]["coordinates"][0]
        _build_building(bid, ring, floors, mats, coll)

    # Pack all images before export
    for img in bpy.data.images:
        try:
            if img.filepath:
                img.pack()
        except Exception:
            pass

    OUT_GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in coll.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(coll.objects), None)

    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB_PATH),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        use_selection=True,
    )
    print(f"[ok] Exported {OUT_GLB_PATH}  buildings={len(buildings)}")


if __name__ == "__main__":
    main()
