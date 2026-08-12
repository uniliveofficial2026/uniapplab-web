"""
Add a gentle idle animation to UniLivesRig and bake it into the .blend.

Usage:
  ./tools/character-pipeline/blender/run-blender.sh --background \
    assets-source/unilives-character/blender/MASTER.blend \
    --python tools/character-pipeline/blender/add-idle-animation.py
"""

from __future__ import annotations

import bpy


def get_rig():
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE" and "UniLives" in obj.name:
            return obj
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    raise SystemExit("No armature found")


def ensure_action(arm):
    if arm.animation_data is None:
        arm.animation_data_create()
    action = bpy.data.actions.get("UniLivesIdle")
    if action is None:
        action = bpy.data.actions.new("UniLivesIdle")
    arm.animation_data.action = action
    return action


def clear_action_curves(action) -> None:
    """Blender 5.x actions use layered channelbags; 3.x/4.x expose action.fcurves."""
    fcurves = getattr(action, "fcurves", None)
    if fcurves is not None:
        while fcurves:
            fcurves.remove(fcurves[0])
        return
    # Blender 5 layered action API
    try:
        for layer in getattr(action, "layers", []) or []:
            for strip in getattr(layer, "strips", []) or []:
                for slot in getattr(action, "slots", []) or []:
                    bag = strip.channelbag(slot, ensure=False)
                    if bag is None:
                        continue
                    while bag.fcurves:
                        bag.fcurves.remove(bag.fcurves[0])
    except Exception as exc:  # noqa: BLE001
        print(f"clear_action_curves soft-fail: {exc}")


def main() -> None:
    arm = get_rig()
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")

    action = ensure_action(arm)
    clear_action_curves(action)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 60
    scene.render.fps = 30

    # Pose-mode soft sway on spine / chest / head / arms
    targets = {
        "spine": {"rotation_euler": [(0.0, 0.02, 0.0), (0.0, -0.02, 0.0), (0.0, 0.02, 0.0)]},
        "chest": {"rotation_euler": [(0.015, 0.0, 0.0), (-0.015, 0.0, 0.0), (0.015, 0.0, 0.0)]},
        "head": {"rotation_euler": [(0.0, 0.0, 0.03), (0.0, 0.0, -0.03), (0.0, 0.0, 0.03)]},
        "upper_arm_L": {"rotation_euler": [(0.0, 0.0, 0.02), (0.0, 0.0, -0.01), (0.0, 0.0, 0.02)]},
        "upper_arm_R": {"rotation_euler": [(0.0, 0.0, -0.02), (0.0, 0.0, 0.01), (0.0, 0.0, -0.02)]},
    }

    frames = [1, 30, 60]
    for bone_name, channels in targets.items():
        pb = arm.pose.bones.get(bone_name)
        if pb is None:
            continue
        for prop, values in channels.items():
            for frame, vec in zip(frames, values):
                pb.rotation_mode = "XYZ"
                setattr(pb, prop, vec)
                pb.keyframe_insert(data_path=prop, frame=frame)

    # Keep action reference live for export
    _ = action

    # Soft mouthOpen pulse for lip-sync scaffolding demo (shape key on mesh)
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]
    for mesh in meshes:
        keys = mesh.data.shape_keys
        block = keys.key_blocks.get("mouthOpen")
        if block is None:
            continue
        if keys.animation_data is None:
            keys.animation_data_create()
        block.value = 0.0
        block.keyframe_insert(data_path="value", frame=1)
        block.value = 0.18
        block.keyframe_insert(data_path="value", frame=30)
        block.value = 0.0
        block.keyframe_insert(data_path="value", frame=60)

    bpy.ops.object.mode_set(mode="OBJECT")
    if bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
    print("Idle action UniLivesIdle written (60 frames @ 30fps)")


if __name__ == "__main__":
    main()
