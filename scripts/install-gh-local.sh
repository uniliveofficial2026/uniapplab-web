#!/usr/bin/env bash
# Install gh CLI locally (no Homebrew) for GitHub auth: bash scripts/install-gh-local.sh
set -euo pipefail

tools_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.tools"
gh_dir="$tools_dir/gh"
gh_bin="$gh_dir/bin/gh"
version="${GH_VERSION:-2.75.0}"
arch="$(uname -m)"
case "$arch" in
  arm64|aarch64) asset="gh_${version}_macOS_arm64.zip" ;;
  x86_64) asset="gh_${version}_macOS_amd64.zip" ;;
  *) echo "Unsupported arch: $arch"; exit 1 ;;
esac

if [[ -x "$gh_bin" ]]; then
  echo "[install-gh] Already installed: $gh_bin"
  "$gh_bin" --version
  exit 0
fi

mkdir -p "$tools_dir"
zip_path="$tools_dir/$asset"
url="https://github.com/cli/cli/releases/download/v${version}/${asset}"

echo "[install-gh] Downloading $url …"
curl -fsSL "$url" -o "$zip_path"
rm -rf "$gh_dir"
unzip -q "$zip_path" -d "$tools_dir"
extracted="$(find "$tools_dir" -maxdepth 1 -type d -name 'gh_*' | head -1)"
if [[ -z "$extracted" || ! -x "$extracted/bin/gh" ]]; then
  echo "[install-gh] Extract failed — expected gh_*/bin/gh under $tools_dir"
  exit 1
fi
mv "$extracted" "$gh_dir"
rm -f "$zip_path"

echo "[install-gh] Installed: $gh_bin"
"$gh_bin" --version
echo ""
echo "Next:"
echo "  $gh_bin auth login"
echo "  bash scripts/github-push.sh"
