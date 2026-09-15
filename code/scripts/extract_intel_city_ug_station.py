"""Extract one station + one tunnel from the 5-station Sketchfab pack."""
from __future__ import annotations

import base64
import json
import struct
from pathlib import Path

SRC = Path(r"E:\sih3dplanner\cit_planner\code\app\static3d\intel_city\metro_assets\underground")
DST = SRC / "station5_tunnel2.glb"

# Best station (most geometry) + longest single tunnel + train cab.
KEEP_ROOTS = ("Station-5", "tunnel2", "cab1")


def _decode_buffer(buf: dict) -> bytes:
    uri = buf.get("uri") or ""
    if uri.startswith("data:"):
        return base64.b64decode(uri.split(",", 1)[1])
    if uri:
        return (SRC / uri).read_bytes()
    raise ValueError("empty buffer")


def _pad4(b: bytes) -> bytes:
    return b + (b" " * ((4 - (len(b) % 4)) % 4))


def _subtree(nodes, idx, out: set[int]):
    if idx in out:
        return
    out.add(idx)
    for c in nodes[idx].get("children") or []:
        _subtree(nodes, c, out)


def main():
    src = next(SRC.glob("0fb66d57b9e14d70828e799594fd668a.gltf"))
    data = json.loads(src.read_text(encoding="utf-8"))
    nodes = data["nodes"]
    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    keep: set[int] = set()
    for name in KEEP_ROOTS:
        _subtree(nodes, by_name[name], keep)

    # Keep FBX wrappers so cm→m scale stays intact.
    for wrap in ("RootNode", "866a2c7e55a7455abd1d80e00eb6ead7.fbx"):
        if wrap in by_name:
            keep.add(by_name[wrap])

    keep_meshes: set[int] = set()
    keep_mats: set[int] = set()
    keep_acc: set[int] = set()
    keep_views: set[int] = set()
    keep_bufs: set[int] = set()

    for i in keep:
        n = nodes[i]
        if "mesh" not in n:
            continue
        mi = n["mesh"]
        keep_meshes.add(mi)
        for prim in data["meshes"][mi].get("primitives") or []:
            if "material" in prim:
                keep_mats.add(prim["material"])
            if "indices" in prim:
                keep_acc.add(prim["indices"])
            for ai in (prim.get("attributes") or {}).values():
                keep_acc.add(ai)

    for ai in keep_acc:
        acc = data["accessors"][ai]
        keep_views.add(acc["bufferView"])
        if "sparse" in acc:
            raise SystemExit("sparse accessor not supported")
    for vi in keep_views:
        bv = data["bufferViews"][vi]
        keep_bufs.add(bv["buffer"])

    buf_map = {old: new for new, old in enumerate(sorted(keep_bufs))}
    view_map = {old: new for new, old in enumerate(sorted(keep_views))}
    acc_map = {old: new for new, old in enumerate(sorted(keep_acc))}
    mesh_map = {old: new for new, old in enumerate(sorted(keep_meshes))}
    mat_map = {old: new for new, old in enumerate(sorted(keep_mats))}
    node_map = {old: new for new, old in enumerate(sorted(keep))}

    packed = bytearray()
    new_views = []
    decoded = {i: _decode_buffer(data["buffers"][i]) for i in keep_bufs}

    for old_vi in sorted(keep_views):
        bv = dict(data["bufferViews"][old_vi])
        blob = decoded[bv["buffer"]]
        start = bv.get("byteOffset", 0)
        chunk = blob[start : start + bv["byteLength"]]
        while len(packed) % 4:
            packed.append(0)
        bv["byteOffset"] = len(packed)
        bv["buffer"] = 0
        packed.extend(chunk)
        new_views.append(bv)

    new_acc = []
    for old in sorted(keep_acc):
        acc = dict(data["accessors"][old])
        acc["bufferView"] = view_map[acc["bufferView"]]
        new_acc.append(acc)

    new_meshes = []
    for old in sorted(keep_meshes):
        mesh = json.loads(json.dumps(data["meshes"][old]))
        for prim in mesh.get("primitives") or []:
            if "material" in prim:
                prim["material"] = mat_map[prim["material"]]
            if "indices" in prim:
                prim["indices"] = acc_map[prim["indices"]]
            prim["attributes"] = {k: acc_map[v] for k, v in prim["attributes"].items()}
        new_meshes.append(mesh)

    new_nodes = []
    for old in sorted(keep):
        n = json.loads(json.dumps(nodes[old]))
        if "mesh" in n:
            n["mesh"] = mesh_map[n["mesh"]]
        if "children" in n:
            kids = [node_map[c] for c in n["children"] if c in node_map]
            if kids:
                n["children"] = kids
            else:
                n.pop("children", None)
        new_nodes.append(n)

    root_old = data["scenes"][data.get("scene", 0)]["nodes"][0]
    out = {
        "asset": data.get("asset") or {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [node_map[root_old]]}],
        "nodes": new_nodes,
        "meshes": new_meshes,
        "materials": [json.loads(json.dumps(data["materials"][i])) for i in sorted(keep_mats)],
        "accessors": new_acc,
        "bufferViews": new_views,
        "buffers": [{"byteLength": len(packed)}],
    }

    json_bytes = _pad4(json.dumps(out, separators=(",", ":")).encode("utf-8"))
    bin_bytes = packed if len(packed) % 4 == 0 else packed + bytes((4 - len(packed) % 4) % 4)
    glb = bytearray()
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    glb.extend(struct.pack("<4sII", b"glTF", 2, total))
    glb.extend(struct.pack("<I4s", len(json_bytes), b"JSON"))
    glb.extend(json_bytes)
    glb.extend(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
    glb.extend(bin_bytes)
    DST.write_bytes(glb)
    print(f"wrote {DST} ({len(glb)} bytes) nodes={len(new_nodes)} meshes={len(new_meshes)}")


if __name__ == "__main__":
    main()
