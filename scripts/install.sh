#!/bin/bash
set -e

# wtree installer
# Usage: curl -fsSL https://raw.githubusercontent.com/anthropics/wtree/main/scripts/install.sh | bash

REPO="anthropics/wtree"
INSTALL_DIR="${WTREE_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="wtree"

# Detect OS and architecture
detect_platform() {
  local os arch

  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux)  os="linux" ;;
    Darwin) os="darwin" ;;
    *)
      echo "Error: Unsupported operating system: $os"
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      echo "Error: Unsupported architecture: $arch"
      exit 1
      ;;
  esac

  echo "${os}-${arch}"
}

# Get latest release version from GitHub
get_latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" |
    grep '"tag_name"' |
    sed -E 's/.*"([^"]+)".*/\1/'
}

# Download and install
install() {
  local platform version download_url tmp_dir

  platform="$(detect_platform)"
  version="${WTREE_VERSION:-$(get_latest_version)}"

  if [ -z "$version" ]; then
    echo "Error: Could not determine latest version"
    exit 1
  fi

  echo "Installing wtree ${version} for ${platform}..."

  download_url="https://github.com/${REPO}/releases/download/${version}/wtree-${platform}"
  tmp_dir="$(mktemp -d)"

  # Download binary
  if ! curl -fsSL "$download_url" -o "${tmp_dir}/${BINARY_NAME}"; then
    echo "Error: Failed to download wtree"
    echo "URL: $download_url"
    rm -rf "$tmp_dir"
    exit 1
  fi

  # Make executable
  chmod +x "${tmp_dir}/${BINARY_NAME}"

  # Install to target directory
  if [ -w "$INSTALL_DIR" ]; then
    mv "${tmp_dir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    echo "Installing to ${INSTALL_DIR} (requires sudo)..."
    sudo mv "${tmp_dir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
  fi

  rm -rf "$tmp_dir"

  echo "Successfully installed wtree to ${INSTALL_DIR}/${BINARY_NAME}"
  echo ""
  echo "Run 'wtree --help' to get started"
}

# Run installer
install
