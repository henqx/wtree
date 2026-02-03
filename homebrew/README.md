# Homebrew Tap for wtree

This directory contains the Homebrew formula for wtree.

## Setting Up the Tap

To create a Homebrew tap, you need a separate GitHub repository:

1. Create a new repository named `homebrew-wtree` under the `henqx` organization
2. Copy the `wtree.rb` formula to the repository root (or `Formula/` directory)
3. Users can then install with:

```bash
brew tap henqx/wtree
brew install wtree
```

Or in one command:

```bash
brew install henqx/wtree/wtree
```

## Updating the Formula

After creating a new release:

1. Run the update script with the new version:
   ```bash
   ./scripts/update-homebrew.sh 0.2.0
   ```

2. This will:
   - Download each platform binary from GitHub releases
   - Compute SHA256 hashes
   - Update the formula with new hashes and version

3. Commit and push to the homebrew-wtree repository

## Repository Structure

The tap repository should have this structure:

```
homebrew-wtree/
├── Formula/
│   └── wtree.rb
└── README.md
```

Or simply:

```
homebrew-wtree/
├── wtree.rb
└── README.md
```

## Testing Locally

To test the formula before publishing:

```bash
# Test install
brew install --build-from-source ./homebrew/wtree.rb

# Test the formula
brew test wtree

# Audit the formula
brew audit --strict wtree
```

## CI Integration

The GitHub Actions CI already creates releases with binaries. To automate the tap update:

1. Add a workflow to the homebrew-wtree repository
2. Trigger it when a new release is created in the main wtree repository
3. The workflow can run `update-homebrew.sh` and commit the changes
