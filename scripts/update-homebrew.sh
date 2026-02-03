#!/usr/bin/env bash
# Update Homebrew formula with SHA256 hashes from a release

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.1.0"
    exit 1
fi

REPO="anthropics/wtree"
FORMULA="homebrew/wtree.rb"

echo "Updating formula for version $VERSION..."

# Download and compute SHA256 for each platform
platforms=("darwin-arm64" "darwin-x64" "linux-arm64" "linux-x64")

for platform in "${platforms[@]}"; do
    url="https://github.com/${REPO}/releases/download/v${VERSION}/wtree-${platform}"
    echo "Fetching $url..."

    sha256=$(curl -fsSL "$url" | shasum -a 256 | cut -d' ' -f1)
    if [ -z "$sha256" ]; then
        echo "Error: Failed to download wtree-${platform}"
        exit 1
    fi

    # Update the placeholder in the formula
    placeholder="PLACEHOLDER_SHA256_${platform^^}"
    placeholder="${placeholder//-/_}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/${placeholder}/${sha256}/g" "$FORMULA"
    else
        sed -i "s/${placeholder}/${sha256}/g" "$FORMULA"
    fi

    echo "  $platform: $sha256"
done

# Update version
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/version \"[^\"]*\"/version \"${VERSION}\"/g" "$FORMULA"
else
    sed -i "s/version \"[^\"]*\"/version \"${VERSION}\"/g" "$FORMULA"
fi

echo ""
echo "Formula updated successfully!"
echo "Next steps:"
echo "  1. Review changes: git diff $FORMULA"
echo "  2. Commit and push to homebrew-wtree repository"
