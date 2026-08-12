#!/usr/bin/env bash
set -euo pipefail
BIN="/Applications/Blender.app/Contents/MacOS/Blender"
exec env -i HOME="$HOME" USER="${USER:-wei}" TMPDIR="${TMPDIR:-/tmp}" PATH="/usr/bin:/bin:/usr/sbin:/sbin" "$BIN" "$@"
