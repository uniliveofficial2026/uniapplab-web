"""
Add simple facial expression shape keys (placeholders) on the primary mesh.

Usage (after MASTER.blend exists):
  blender --background assets-source/unilives-character/blender/MASTER.blend \
    --python tools/character-pipeline/blender/add-expression-shapekeys.py
"""

from __future__ import annotations

import bpy


EXPRESSION_NAMES = [
    "basis",  # created automatically as first key
    "mouthOpen",
    "mouthSmile",
    "browUp",
    "eyeBlink_L",
    "eyeBlink_R",
    "viseme_AA",
    "viseme_E",
    "viseme_I",
    "viseme_O",
    "viseme_U",
    "viseme_M",
]


def primary_mesh():
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("No mesh found")
    # Prefer largest mesh by vertex count
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    return meshes[0]


def main() -> None:
    obj = primary_mesh()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)

    existing = {k.name for k in obj.data.shape_keys.key_blocks}
    created = []
    for name in EXPRESSION_NAMES:
        if name == "basis":
            continue
        if name in existing:
            continue
        # Placeholder keys — artist sculpts deltas later in Blender.
        kb = obj.shape_key_add(name=name, from_mix=False)
        kb.value = 0.0
        created.append(name)

    blend = bpy.data.filepath
    if blend:
        bpy.ops.wm.save_mainfile()
    print(f"Target mesh: {obj.name}")
    print(f"Created shape keys: {created or 'none (already present)'}")


if __name__ == "__main__":
    main()
