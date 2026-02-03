# wtree

Fast git worktree creation with cached artifacts. Built for parallel agent workflows.

## The Problem

When you create a git worktree, you get a fresh working directory—but `node_modules`, build caches, and virtual environments need to be recreated from scratch. For parallel agent workflows (Cursor, Codex, Claude Code), this setup time dominates actual work time.

## The Solution

`wtree` hardlinks cached artifacts from your source worktree to new ones. Creating a worktree with a full `node_modules` takes seconds instead of minutes.

```bash
# Create a new worktree with cached node_modules, .turbo, etc.
wtree create feature-branch

# That's it. Your new worktree is ready to use.
```

## Installation

```bash
# curl (recommended)
curl -fsSL https://wtree.dev/install.sh | bash

# npm
npm i -g wtree

# bun
bun i -g wtree

# homebrew
brew install wtree
```

## Usage

```bash
# Create worktree with cached artifacts (auto-detects source)
wtree create feature-branch

# Create from specific source branch/worktree
wtree create feature-branch --from develop

# Restore artifacts to an existing worktree
wtree restore ./path/to/worktree --from ../main

# See what wtree detects in current directory
wtree analyze

# Remove worktree and clean up
wtree remove feature-branch

# Agent-friendly JSON output
wtree create feature-branch --json
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
| npm | `package-lock.json` | `node_modules` |
| yarn | `yarn.lock` | `node_modules`, `.yarn/cache` |
| Turborepo | `turbo.json` | `node_modules`, `.turbo` |
| Nx | `nx.json` | `node_modules`, `.nx/cache` |
| Python (uv) | `uv.lock` | `.venv` |
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
wtree create feature-branch --json
```

```json
{
  "worktree": "/path/to/repo-feature-branch",
  "cached": ["node_modules", ".turbo"],
  "post_restore": { "ran": true, "exit_code": 0 },
  "ready": true
}
```

For agent configs, a simple fallback pattern:

```bash
command -v wtree && wtree create $BRANCH || git worktree add ../$BRANCH
```

## Requirements

- Git 2.5+ (for worktree support)
- macOS or Linux (Windows support planned)
- `cp` with hardlink support (standard on macOS/Linux)

## License

MIT
