"""
Blender batch export: optimized GLB for UniLive’s runtime.

Usage:
  blender --background assets-source/unilives-character/blender/MASTER.blend \
    --python tools/character-pipeline/blender/export-optimized-glb.py -- \
    --out artifacts/instacollab/public/unilives-assets/characters/unilives-mascot.glb

Masters stay under assets-source/. Runtime files go under public/unilives-assets/characters/.
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
    p.add_argument(
        "--out",
        required=True,
        help="Output .glb path under public/unilives-assets/characters/",
    )
    return p.parse_args(argv)


def main() -> None:
    args = parse_args(sys.argv)
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    # Prefer selected objects; otherwise export visible mesh/armature.
    bpy.ops.object.select_all(action="DESELECT")
    exported = 0
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "ARMATURE"} and obj.visible_get():
            obj.select_set(True)
            exported += 1

    if exported == 0:
        raise SystemExit("No visible MESH/ARMATURE objects to export")

    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_optimize_animation_size=True,
    )
    print(f"Exported optimized GLB → {out}")


if __name__ == "__main__":
    main()
