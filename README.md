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

### Curl installer

```bash
curl -fsSL https://raw.githubusercontent.com/henqx/wtree/main/scripts/install.sh | bash
```

### Build from source (requires Bun)

```bash
git clone https://github.com/henqx/wtree
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

# Restore artifacts to an existing worktree (auto-detects best source)
wtree restore ./path/to/worktree

# Or specify the source explicitly
wtree restore ./path/to/worktree --from main

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
| Rush | `rush.json` | `common/temp/node_modules`, `.rush/temp`, `common/temp/build-cache` |
| Lerna | `lerna.json` | `node_modules`, `**/node_modules` |
| Python (uv) | `uv.lock` | `.venv` |
| Python (Poetry) | `poetry.lock` | `.venv` |
| Python (PDM) | `pdm.lock` | `.venv`, `__pypackages__` |
| Python (pip) | `requirements.txt` | `.venv` |
| Rust | `Cargo.lock` | `target` |
| Go | `go.sum` | `vendor` |

Don't see your stack? `wtree` also infers cacheable directories from `.gitignore`.

## Mixed Stacks

Projects using multiple technologies are automatically detected and merged. For example, a Rust project with Node.js bindings:

```bash
$ wtree analyze
Method: Mixed (rust, npm)
Detected: Cargo.lock, package-lock.json
Cache Patterns:
  • target
  • node_modules
```

Cache patterns from all detected recipes are merged (with duplicates removed). For mixed stacks, post-restore commands are skipped—define custom commands in `.wtree.yaml` if needed.

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

`wtree` is designed for AI coding agents running parallel workflows. When agents like Cursor, Claude Code, or Codex work on multiple tasks simultaneously, each task benefits from its own isolated worktree—but recreating `node_modules` or build caches for each one is slow and wasteful. `wtree` solves this by hardlinking artifacts, making worktree creation nearly instant with zero additional disk space.

### Recommended Workflow

**One worktree per task.** Each agent task gets an isolated environment:

```bash
# Agent starting a new task
wtree add .worktrees/fix-auth-bug
cd .worktrees/fix-auth-bug
# ... work on the task ...

# When done, clean up
wtree remove .worktrees/fix-auth-bug
```

The `.worktrees/` directory pattern keeps worktrees organized within your repo (add `.worktrees` to `.gitignore`).

### Configuring Your Agent

Add wtree to your agent's instructions so it uses worktrees automatically.

**Claude Code** (`.claude.md` or `CLAUDE.md`):

```markdown
## Parallel Work

When working on tasks that benefit from isolation, use wtree to create worktrees:

- Create: `wtree add .worktrees/<branch-name>`
- Remove when done: `wtree remove .worktrees/<branch-name>`
- Use `--json` flag for structured output
```

**Cursor** (`.cursorrules`):

```
When working on isolated tasks or experiments, create a git worktree:
- Run: wtree add .worktrees/<descriptive-name>
- Work in the new worktree directory
- Clean up with: wtree remove .worktrees/<descriptive-name>
```

**Codex** (agent instructions):

```
For parallel task execution, use wtree to create isolated worktrees:
wtree add .worktrees/<task-name> --json
This preserves node_modules and build caches via hardlinks.
```

### JSON Output

Use `--json` for structured output that agents can parse:

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

### Why Hardlinks Matter for Agents

Traditional worktree setup requires reinstalling dependencies for each worktree. With 10 parallel agent tasks on a project with 500MB of `node_modules`, that's potentially 5GB of disk space and minutes of install time per task.

With `wtree`:
- **Instant creation**: Hardlinking is O(1) regardless of artifact size
- **Zero disk overhead**: All worktrees share the same physical bytes
- **Automatic reconciliation**: If dependencies differ, `post_restore` commands sync them in seconds

## Requirements

- Git 2.5+ (for worktree support)
- macOS or Linux (Windows support planned)
- `cp` with hardlink support (standard on macOS/Linux)

## License

MIT
