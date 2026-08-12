"""
Import Meshy review GLB into UniLive’s editable Blender master.

Usage:
  blender --background --python tools/character-pipeline/blender/import-meshy-to-master.py -- \
    --glb assets-source/unilives-character/references/meshy-reviews/unilives-mascot-v1-refine.glb \
    --blend assets-source/unilives-character/blender/MASTER.blend
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--character-name", default="UniLivesMascot")
    return p.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ensure_collection(name: str):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def move_to_collection(obj, col) -> None:
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def import_glb(path: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def create_basic_humanoid_armature(name: str = "UniLivesRig"):
    """Simple A-pose-friendly armature for first-pass skinning."""
    arm_data = bpy.data.armatures.new(name)
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    bones = arm_data.edit_bones

    def add_bone(bname, head, tail, parent=None):
        b = bones.new(bname)
        b.head = head
        b.tail = tail
        if parent is not None:
            b.parent = parent
        return b

    root = add_bone("root", (0, 0, 0), (0, 0, 0.1))
    hips = add_bone("hips", (0, 0, 0.9), (0, 0, 1.05), root)
    spine = add_bone("spine", (0, 0, 1.05), (0, 0, 1.25), hips)
    chest = add_bone("chest", (0, 0, 1.25), (0, 0, 1.45), spine)
    neck = add_bone("neck", (0, 0, 1.45), (0, 0, 1.55), chest)
    head = add_bone("head", (0, 0, 1.55), (0, 0, 1.75), neck)

    shoulder_l = add_bone("shoulder_L", (0.05, 0, 1.42), (0.18, 0, 1.42), chest)
    upper_arm_l = add_bone("upper_arm_L", (0.18, 0, 1.42), (0.42, 0, 1.25), shoulder_l)
    forearm_l = add_bone("forearm_L", (0.42, 0, 1.25), (0.62, 0, 1.05), upper_arm_l)
    hand_l = add_bone("hand_L", (0.62, 0, 1.05), (0.72, 0, 1.0), forearm_l)

    shoulder_r = add_bone("shoulder_R", (-0.05, 0, 1.42), (-0.18, 0, 1.42), chest)
    upper_arm_r = add_bone("upper_arm_R", (-0.18, 0, 1.42), (-0.42, 0, 1.25), shoulder_r)
    forearm_r = add_bone("forearm_R", (-0.42, 0, 1.25), (-0.62, 0, 1.05), upper_arm_r)
    hand_r = add_bone("hand_R", (-0.62, 0, 1.05), (-0.72, 0, 1.0), forearm_r)

    thigh_l = add_bone("thigh_L", (0.1, 0, 0.9), (0.12, 0, 0.5), hips)
    shin_l = add_bone("shin_L", (0.12, 0, 0.5), (0.12, 0, 0.1), thigh_l)
    foot_l = add_bone("foot_L", (0.12, 0, 0.1), (0.12, -0.15, 0.02), shin_l)

    thigh_r = add_bone("thigh_R", (-0.1, 0, 0.9), (-0.12, 0, 0.5), hips)
    shin_r = add_bone("shin_R", (-0.12, 0, 0.5), (-0.12, 0, 0.1), thigh_r)
    foot_r = add_bone("foot_R", (-0.12, 0, 0.1), (-0.12, -0.15, 0.02), shin_r)

    # keep refs used so linters/tools know intentional creation
    _ = (head, hand_l, hand_r, foot_l, foot_r)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def scale_armature_to_mesh(arm_obj, mesh_objs) -> None:
    from mathutils import Vector

    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for obj in mesh_objs:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    height = max(maxs.z - mins.z, 0.001)
    # Rig authored around ~1.75m; scale to mesh height.
    scale = height / 1.75
    arm_obj.scale = (scale, scale, scale)
    # Place hips near mesh bottom + 50% height approx by aligning root to mesh min z
    arm_obj.location = ((mins.x + maxs.x) * 0.5, (mins.y + maxs.y) * 0.5, mins.z)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def parent_with_automatic_weights(arm_obj, mesh_objs) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objs:
        obj.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        print("Automatic weights: OK")
    except Exception as exc:  # noqa: BLE001
        print(f"Automatic weights failed ({exc}); parenting without weights")
        bpy.ops.object.parent_set(type="ARMATURE")


def main() -> None:
    args = parse_args(sys.argv)
    glb = Path(args.glb).resolve()
    blend = Path(args.blend).resolve()
    if not glb.exists():
        raise SystemExit(f"GLB not found: {glb}")

    reset_scene()
    char_col = ensure_collection("01_Character")
    rig_col = ensure_collection("02_Rig")
    ref_col = ensure_collection("03_References")

    imported = import_glb(glb)
    mesh_objs = [o for o in imported if o.type == "MESH"]
    other_objs = [o for o in imported if o.type != "MESH"]

    for obj in mesh_objs:
        obj.name = f"{args.character_name}_{obj.name}"[:60]
        move_to_collection(obj, char_col)
        # Light cleanup
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.0001)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)

    for obj in other_objs:
        move_to_collection(obj, ref_col)

    if not mesh_objs:
        raise SystemExit("No mesh objects imported from GLB")

    arm = create_basic_humanoid_armature("UniLivesRig")
    move_to_collection(arm, rig_col)
    scale_armature_to_mesh(arm, mesh_objs)
    parent_with_automatic_weights(arm, mesh_objs)

    # Marker empty for pipeline metadata
    meta = bpy.data.objects.new("UniLives_PipelineMeta", None)
    meta.empty_display_type = "PLAIN_AXES"
    meta["brand"] = "UniLive’s"
    meta["source_glb"] = str(glb)
    meta["stage"] = "blender-master-rig-v1"
    move_to_collection(meta, ref_col)

    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    print(f"Saved master: {blend}")
    print(f"Meshes: {len(mesh_objs)} | Rig: {arm.name}")


if __name__ == "__main__":
    main()
