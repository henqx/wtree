# wtree

Fast git worktree creation with cached artifacts. Built for parallel agent workflows.

## The Problem

When you create a git worktree, you get a fresh working directory—but `node_modules`, build caches, and virtual environments need to be recreated from scratch. For parallel agent workflows (Cursor, Codex, Claude Code), this setup time dominates actual work time.

## The Solution

`wtree` hardlinks cached artifacts from your source worktree to new ones. Creating a worktree with a full `node_modules` takes seconds instead of minutes.

```bash
# Create a new worktree with cached node_modules
wtree add ../feature-branch

# That's it. Your new worktree is ready to use.
```

## Installation

### Homebrew (macOS/Linux)

```bash
brew install anthropics/wtree/wtree
```

### Curl installer

```bash
curl -fsSL https://raw.githubusercontent.com/anthropics/wtree/main/scripts/install.sh | bash
```

### Build from source (requires Bun)

```bash
git clone https://github.com/anthropics/wtree
cd wtree
bun install
bun run build
sudo mv wtree /usr/local/bin/
```

## Usage

```bash
# Create worktree (branch name inferred from path)
wtree add ../feature-branch

# Create worktree with explicit new branch name
wtree add -b my-feature ../feature-branch

# Checkout existing branch into new worktree
wtree add ../hotfix main

# Nested worktree pattern
wtree add .worktrees/feature-x

# Specify source worktree for artifacts
wtree add ../feature-branch --from develop

# Restore artifacts to an existing worktree
wtree restore ./path/to/worktree --from ../main

# List all worktrees with cache status
wtree list

# See what wtree detects in current directory
wtree analyze

# Remove worktree
wtree remove ../feature-branch

# Agent-friendly JSON output
wtree add ../feature-branch --json
```

## How It Works

1. **Detects your stack** from lockfiles and markers (`pnpm-lock.yaml`, `Cargo.lock`, etc.)
2. **Creates the worktree** via `git worktree add`
3. **Hardlinks artifacts** from source worktree (instant, saves disk space)
4. **Runs post-restore** command if needed (`pnpm install --prefer-offline`)

Hardlinks mean the files share disk space with the source—a 500MB `node_modules` costs ~0 extra bytes. If dependencies differ, the post-restore command reconciles them in seconds.

## Supported Stacks

Works out of the box with:

| Stack | Detected By | Cached Artifacts |
|-------|-------------|------------------|
| pnpm | `pnpm-lock.yaml` | `node_modules` |
| pnpm workspaces | `pnpm-workspace.yaml` | `node_modules`, `**/node_modules` |
| npm | `package-lock.json` | `node_modules` |
| yarn | `yarn.lock` | `node_modules`, `.yarn/cache` |
| Bun | `bun.lock`, `bun.lockb` | `node_modules` |
| Turborepo | `turbo.json` | `node_modules`, `.turbo`, `**/node_modules` |
| Nx | `nx.json` | `node_modules`, `.nx/cache`, `**/node_modules` |
| Rush | `rush.json` | `common/temp/node_modules`, `.rush/temp` |
| Lerna | `lerna.json` | `node_modules`, `**/node_modules` |
| Python (uv) | `uv.lock` | `.venv` |
| Python (Poetry) | `poetry.lock` | `.venv` |
| Python (PDM) | `pdm.lock` | `.venv`, `__pypackages__` |
| Python (pip) | `requirements.txt` | `.venv` |
| Rust | `Cargo.lock` | `target` |
| Go | `go.sum` | `vendor` |

Don't see your stack? `wtree` also infers cacheable directories from `.gitignore`.

## Configuration (Optional)

Most projects need zero configuration. For custom setups, create `.wtree.yaml`:

```yaml
# Extend a built-in recipe
extends: turborepo

# Add custom cache targets
cache:
  - node_modules
  - .turbo
  - packages/*/dist

# Override post-restore command
post_restore: pnpm install --prefer-offline && pnpm build:packages
```

## Agent Integration

`wtree` is designed for AI coding agents. Use `--json` for structured output:

```bash
wtree add ../feature-branch --json
```

```json
{
  "success": true,
  "worktree": {
    "path": "/path/to/feature-branch",
    "branch": "feature-branch"
  },
  "source": {
    "path": "/path/to/main",
    "branch": "main"
  },
  "artifacts": {
    "patterns": ["node_modules"],
    "copied": ["node_modules"]
  },
  "recipe": "bun"
}
```

## Requirements

- Git 2.5+ (for worktree support)
- macOS or Linux (Windows support planned)
- `cp` with hardlink support (standard on macOS/Linux)

## License

MIT
