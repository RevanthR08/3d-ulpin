"""
Blender importer: WGS84 VERTICA site GeoJSON -> textured buildings + OSM roads -> GLB.

Expects features with:
  kind=site_boundary | building | road
  building: simulated_floors / height_m / typology
  road: LineString

Lon/lat projected to local meters around site centroid (equirectangular).
"""

from __future__ import annotations

import json
import math
import zlib
from pathlib import Path

import bpy
import bmesh

# --- paths (edit if needed) ---
GEOJSON_PATH = Path(r"E:\sih3dplanner\cit_planner\code\data\labeled_sites\chennai_tnagar_block_a.geojson")
OUT_GLB_PATH = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\chennai_tnagar.glb")
TEX_DIR = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\textures")

FLOOR_HEIGHT_M = 3.0
WALL_THICKNESS_M = 0.35
SLAB_THICKNESS_M = 0.22
PARAPET_H_M = 0.85
ROOM_WALL_T_M = 0.12
ROAD_WIDTH_M = 7.0
MAX_BUILDINGS = 120  # keep GLB size reasonable for viewer


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


class LonLatProjector:
    def __init__(self, lon0: float, lat0: float):
        self.lon0 = lon0
        self.lat0 = lat0
        self.m_per_deg_lat = 111_320.0
        self.m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))

    def xy(self, lon: float, lat: float) -> tuple[float, float]:
        return ((lon - self.lon0) * self.m_per_deg_lon, (lat - self.lat0) * self.m_per_deg_lat)


def _ring_pts_xy(ring: list, proj: LonLatProjector) -> list[tuple[float, float]]:
    pts = ring[:-1] if ring and ring[0] == ring[-1] else list(ring)
    return [proj.xy(float(p[0]), float(p[1])) for p in pts]


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
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts_local]
    top = [bm.verts.new((x, y, z1)) for x, y in pts_local]
    bm.verts.ensure_lookup_table()
    try:
        bm.faces.new(bot)
        bm.faces.new(list(reversed(top)))
    except ValueError:
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
    mod.offset = -1.0
    mod.use_even_offset = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception:
        pass
    obj.select_set(False)


def _add_floor_slab(name, pts_local, z, thickness, mat, parent, coll, inset=0.15):
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


def _road_ribbon(coords_xy: list[tuple[float, float]], half_w: float) -> list[tuple[float, float]] | None:
    if len(coords_xy) < 2:
        return None
    left: list[tuple[float, float]] = []
    right: list[tuple[float, float]] = []
    for i in range(len(coords_xy) - 1):
        x0, y0 = coords_xy[i]
        x1, y1 = coords_xy[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        left.append((x0 + nx * half_w, y0 + ny * half_w))
        right.append((x0 - nx * half_w, y0 - ny * half_w))
        if i == len(coords_xy) - 2:
            left.append((x1 + nx * half_w, y1 + ny * half_w))
            right.append((x1 - nx * half_w, y1 - ny * half_w))
    ring = left + list(reversed(right))
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring[:-1]


def _build_building(bid, pts_xy, floors, typology, mats, coll):
    cx, cy = _centroid(pts_xy)
    pts_local = [(x - cx, y - cy) for x, y in pts_xy]
    height_m = max(FLOOR_HEIGHT_M, floors * FLOOR_HEIGHT_M)

    root = bpy.data.objects.new(bid, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 1.0
    root.location = (cx, cy, 0.0)
    root["building_id"] = bid
    root["floors"] = floors
    root["height_m"] = height_m
    root["typology"] = typology
    _link_object(root, coll)

    shell_mesh = _extruded_prism(f"{bid}_SHELL_MESH", pts_local, 0.0, height_m)
    shell = _mesh_object(f"{bid}_SHELL", shell_mesh, (0, 0, 0), coll, parent=root)

    h = zlib.adler32(bid.encode("utf-8")) % 3
    if typology == "highrise" or floors >= 9:
        wall_mat = [mats["brick"], mats["plaster"], mats["concrete"]][h]
    elif typology == "apartment" or floors >= 3:
        wall_mat = [mats["plaster"], mats["brick"], mats["plaster"]][h]
    else:
        wall_mat = [mats["concrete"], mats["plaster"], mats["concrete"]][h]

    shell.data.materials.append(wall_mat)
    shell.data.materials.append(mats["roof"])
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
    _solidify_shell(shell, WALL_THICKNESS_M)
    _ensure_uvs(shell.data, tex_scale_m=2.8)

    for fi in range(min(floors, 12) + 1):  # cap slabs for heavy towers
        z = fi * FLOOR_HEIGHT_M
        if fi == min(floors, 12):
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

    parapet_mesh = _extruded_prism(f"{bid}_PARAPET_MESH", pts_local, height_m, height_m + PARAPET_H_M)
    parapet = _mesh_object(f"{bid}_PARAPET", parapet_mesh, (0, 0, 0), coll, parent=root)
    parapet.data.materials.append(wall_mat)
    _ensure_uvs(parapet.data, tex_scale_m=2.5)
    _solidify_shell(parapet, 0.18)
    return root


def main() -> None:
    if not GEOJSON_PATH.is_file():
        raise SystemExit(f"GeoJSON not found: {GEOJSON_PATH}")

    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = data.get("features", [])
    meta = data.get("metadata") or {}
    bbox = meta.get("bbox")
    if bbox and len(bbox) == 4:
        lon0 = (bbox[0] + bbox[2]) / 2
        lat0 = (bbox[1] + bbox[3]) / 2
    else:
        # fallback: site boundary centroid
        site = next((f for f in features if f.get("properties", {}).get("kind") == "site_boundary"), None)
        ring = site["geometry"]["coordinates"][0]
        lon0 = sum(p[0] for p in ring[:-1]) / (len(ring) - 1)
        lat0 = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)

    proj = LonLatProjector(lon0, lat0)
    coll = _ensure_collection("CHENNAI_TNAGAR")
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
            "MAT_GRASS", TEX_DIR / "grass_diff.jpg", TEX_DIR / "grass_nor.jpg", None, roughness=0.95
        ),
        "asphalt": _make_pbr_material(
            "MAT_ASPHALT", TEX_DIR / "asphalt_diff.jpg", TEX_DIR / "asphalt_nor.jpg", None, roughness=0.92
        ),
    }

    site = next((f for f in features if f.get("properties", {}).get("kind") == "site_boundary"), None)
    if site:
        pts = _ring_pts_xy(site["geometry"]["coordinates"][0], proj)
        cx, cy = _centroid(pts)
        pts_local = [(x - cx, y - cy) for x, y in pts]
        gmesh = _extruded_prism("SITE_GROUND_MESH", pts_local, -0.05, 0.02)
        ground = _mesh_object("SITE_GROUND", gmesh, (cx, cy, 0.0), coll)
        ground.data.materials.append(mats["grass"])
        _ensure_uvs(ground.data, tex_scale_m=28.0)

    roads = [f for f in features if f.get("properties", {}).get("kind") == "road"]
    for i, feat in enumerate(roads):
        coords = feat["geometry"]["coordinates"]
        xy = [proj.xy(float(p[0]), float(p[1])) for p in coords]
        ring = _road_ribbon(xy, ROAD_WIDTH_M / 2)
        if not ring or len(ring) < 4:
            continue
        hw = feat.get("properties", {}).get("highway")
        half = 5.5 if hw in {"primary", "secondary"} else 3.5 if hw == "service" else ROAD_WIDTH_M / 2
        ring = _road_ribbon(xy, half) or ring
        mesh = _extruded_prism(f"ROAD_{i}_MESH", ring, 0.02, 0.09)
        obj = _mesh_object(f"ROAD_{i}", mesh, (0, 0, 0), coll)
        obj.data.materials.append(mats["asphalt"])
        _ensure_uvs(obj.data, tex_scale_m=12.0)

    buildings = [f for f in features if f.get("properties", {}).get("kind") == "building"]
    # Prefer mix: keep all highrise, sample apartments/villas
    hi = [f for f in buildings if (f.get("properties") or {}).get("typology") == "highrise"]
    mid = [f for f in buildings if (f.get("properties") or {}).get("typology") == "apartment"]
    low = [f for f in buildings if (f.get("properties") or {}).get("typology") == "villa"]
    selected = hi[:40] + mid[:50] + low[:30]
    if len(selected) > MAX_BUILDINGS:
        selected = selected[:MAX_BUILDINGS]

    for feat in selected:
        props = feat.get("properties") or {}
        bid = str(props.get("id", "BUILDING")).strip()
        floors = int(props.get("simulated_floors") or 3)
        typology = str(props.get("typology") or "apartment")
        pts = _ring_pts_xy(feat["geometry"]["coordinates"][0], proj)
        if len(pts) < 3:
            continue
        try:
            _build_building(bid, pts, floors, typology, mats, coll)
        except Exception as e:  # noqa: BLE001
            print(f"[skip] {bid}: {e}")

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
    print(f"[ok] Exported {OUT_GLB_PATH} buildings={len(selected)} roads={len(roads)}")


if __name__ == "__main__":
    main()
