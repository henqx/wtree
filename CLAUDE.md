# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wtree is a CLI tool that accelerates git worktree creation by caching and hardlinking build artifacts. It's designed for AI coding agents (Cursor, Codex, Claude Code) to reduce parallel workflow setup time.

## Technology Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Platforms:** macOS, Linux (Windows planned for v1.0)

## Build Commands

```bash
# Development - run from source
bun run src/index.ts <command>

# Build single binary
bun build src/index.ts --compile --outfile wtree

# Build for specific platforms
bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/wtree-linux-x64
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/wtree-darwin-arm64
```

## Architecture

### Source Structure

```
src/
├── index.ts          # Entry point, command dispatch
├── cli.ts            # Argument parsing (Bun's parseArgs)
├── commands/         # Command implementations
│   ├── add.ts        # Create worktree + restore artifacts
│   ├── restore.ts    # Restore to existing worktree
│   ├── analyze.ts    # Show detected config
│   └── remove.ts     # Remove worktree
├── detect/           # Detection layer
│   ├── index.ts      # Detection orchestrator (3-tier)
│   ├── recipes.ts    # Built-in recipe definitions
│   └── gitignore.ts  # .gitignore parser & inference
├── copy.ts           # Hardlink copy via cp -al/-Rl
├── git.ts            # Git command wrappers
├── config.ts         # .wtree.yaml parsing
└── types.ts          # Shared type definitions
```

### Core Design Patterns

1. **Three-tier detection priority:** explicit `.wtree.yaml` → built-in recipes → `.gitignore` inference
2. **Hardlink-based copying:** Uses system `cp -al` (Linux) or `cp -Rl` (macOS) for zero additional disk space
3. **Source worktree as cache:** No separate cache directory needed
4. **Thin wrapper philosophy:** Shell out to system tools (git, cp)
5. **Match git semantics:** CLI mirrors `git worktree add` patterns

### Data Flow (add command)

1. Parse CLI args (path, optional branch)
2. Infer branch name from path if not specified
3. Find source worktree via `git worktree list`
4. Detect config from source (recipe or .wtree.yaml)
5. Check if nested worktree needs .gitignore warning
6. Create git worktree
7. Hardlink copy artifacts
8. Run post_restore command if defined
9. Output result (human or JSON)

## CLI Commands

```bash
# Create worktree (branch inferred from path)
wtree add ../feature-branch

# Create with explicit new branch
wtree add -b my-feature ../feature-branch

# Checkout existing branch
wtree add ../hotfix main

# Nested worktree pattern
wtree add .worktrees/feature-x

# Specify source for artifacts
wtree add ../feature-branch --from develop

# Other commands
wtree restore ./path/to/worktree --from ../main
wtree analyze [--json]
wtree remove ../feature-branch [--force]
```

All commands support `--json` flag for agent integration with structured output.

## Supported Recipes

| Stack | Detection File | Cached Artifacts |
|-------|----------------|------------------|
| pnpm | `pnpm-lock.yaml` | `node_modules` |
| npm | `package-lock.json` | `node_modules` |
| yarn | `yarn.lock` | `node_modules`, `.yarn/cache` |
| Bun | `bun.lock`, `bun.lockb` | `node_modules` |
| Turborepo | `turbo.json` | `node_modules`, `.turbo`, `**/node_modules` |
| Nx | `nx.json` | `node_modules`, `.nx/cache`, `**/node_modules` |
| Python (uv) | `uv.lock` | `.venv` |
| Python (pip) | `requirements.txt` | `.venv` |
| Rust | `Cargo.lock` | `target` |
| Go | `go.sum` | `vendor` |

## Error Handling

- Custom `WtreeError` class with error codes
- Structured JSON error output in agent mode (`--json`)
- Fail-fast approach with clear error messages
