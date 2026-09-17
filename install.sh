#!/bin/sh
# Installs the skill-router-mcp binary on Linux or macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/Mane087/skill-router/main/install.sh | sh
#
# Environment:
#   SKILL_ROUTER_VERSION      release tag to install, exactly as it appears on
#                             the release, such as 0.1.0 (default: latest)
#   SKILL_ROUTER_INSTALL_DIR  where to put the binary (default: ~/.local/bin)

set -eu

REPO="Mane087/skill-router"
BINARY="skill-router-mcp"
INSTALL_DIR="${SKILL_ROUTER_INSTALL_DIR:-$HOME/.local/bin}"

main() {
  need curl
  need uname

  asset="$BINARY-$(detect_os)-$(detect_arch)"
  version="${SKILL_ROUTER_VERSION:-$(latest_version)}"

  say "Installing $BINARY $version ($asset)"

  workspace="$(mktemp -d)"
  trap 'rm -rf "$workspace"' EXIT

  base="https://github.com/$REPO/releases/download/$version"

  download "$base/$asset" "$workspace/$asset"
  download "$base/SHA256SUMS" "$workspace/SHA256SUMS"
  verify "$workspace" "$asset"

  mkdir -p "$INSTALL_DIR"
  chmod +x "$workspace/$asset"
  mv "$workspace/$asset" "$INSTALL_DIR/$BINARY"

  say "Installed to $INSTALL_DIR/$BINARY"
  check_path
}

detect_os() {
  case "$(uname -s)" in
    Linux) echo linux ;;
    Darwin) echo darwin ;;
    *) die "Unsupported operating system: $(uname -s). Windows has install.ps1." ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo x64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) die "Unsupported architecture: $(uname -m)." ;;
  esac
}

# Read from the redirect rather than the API: no token, no rate limit that
# matters, and nothing to parse out of JSON without jq.
latest_version() {
  location="$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
    "https://github.com/$REPO/releases/latest")" ||
    die "Could not reach GitHub to resolve the latest version."

  version="${location##*/}"

  # Whatever the tag is called is what the download URL needs, so this only
  # rejects the shapes that mean the redirect did not land on a release:
  # an empty segment, or "latest" still sitting there because nothing was
  # published yet.
  case "$version" in
    '' | latest | releases)
      die "Could not resolve the latest release; got \"$version\"."
      ;;
    *) echo "$version" ;;
  esac
}

download() {
  curl -fsSL --retry 3 --proto '=https' --tlsv1.2 -o "$2" "$1" ||
    die "Download failed: $1"
}

# A published checksum is the only thing standing between a proxy and a binary
# that will run with the user's permissions, so a missing checksum tool is an
# error rather than a reason to skip the check.
verify() {
  workspace="$1"
  asset="$2"

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$workspace/$asset" | cut -d' ' -f1)"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$workspace/$asset" | cut -d' ' -f1)"
  else
    die "Neither sha256sum nor shasum is available; cannot verify the download."
  fi

  expected="$(grep " $asset\$" "$workspace/SHA256SUMS" | cut -d' ' -f1)" ||
    die "SHA256SUMS does not list $asset."

  if [ -z "$expected" ]; then
    die "SHA256SUMS does not list $asset."
  fi

  if [ "$actual" != "$expected" ]; then
    die "Checksum mismatch for $asset.
  expected $expected
  actual   $actual"
  fi

  say "Checksum verified"
}

check_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
      say ""
      say "$INSTALL_DIR is not on your PATH. Add it with:"
      say "  export PATH=\"$INSTALL_DIR:\$PATH\""
      ;;
  esac
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "This installer needs $1."
}

say() {
  echo "$1"
}

die() {
  echo "$1" >&2
  exit 1
}

main "$@"
