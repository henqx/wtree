# Architecture

## Design Principles

1. **Zero config by default** - Works out of the box for common stacks
2. **Thin wrapper** - Shell out to system tools (`git`, `cp`) for heavy lifting
3. **Fast startup** - Bun compiled binary, minimal dependencies
4. **Source worktree = cache** - No separate cache directory to manage
5. **Match git semantics** - CLI mirrors `git worktree` patterns

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  Argument parsing, command dispatch, output formatting      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Command Handlers                        │
│  add, restore, analyze, remove                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────────────┐
│     Detector      │ │   Copier    │ │    Git Operations   │
│  Recipe matching  │ │  Hardlinks  │ │  worktree add/remove│
│  Gitignore parse  │ │  Glob expand│ │                     │
└───────────────────┘ └─────────────┘ └─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     System Commands                          │
│  git, cp -al/-Rl, sh -c (post_restore)                      │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
wtree/
├── src/
│   ├── index.ts          # Entry point, command dispatch
│   ├── cli.ts            # Argument parsing (Bun's parseArgs)
│   ├── commands/
│   │   ├── add.ts        # Main command: create worktree + restore
│   │   ├── restore.ts    # Restore artifacts to existing worktree
│   │   ├── analyze.ts    # Show detected config
│   │   └── remove.ts     # Remove worktree
│   ├── detect/
│   │   ├── index.ts      # Detection orchestrator (3-tier)
│   │   ├── recipes.ts    # Built-in recipe definitions
│   │   └── gitignore.ts  # .gitignore parser and inference
│   ├── copy.ts           # Hardlink copy, glob expansion
│   ├── git.ts            # Git command wrappers
│   ├── config.ts         # .wtree.yaml parsing
│   └── types.ts          # Shared type definitions
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── package.json
├── tsconfig.json
└── README.md
```

## Core Components

### Detection (`src/detect/`)

Three-tier detection priority:

1. **Explicit config** - `.wtree.yaml` in repo root
2. **Built-in recipes** - Match lockfiles/markers
3. **Gitignore inference** - Fallback for unknown stacks

```typescript
// src/detect/index.ts
export async function detectConfig(root: string): Promise<DetectionResult> {
  // Tier 1: Explicit .wtree.yaml
  if (await fileExists(join(root, ".wtree.yaml"))) {
    const config = await parseConfig(configPath);
    return { method: "explicit", config };
  }

  // Tier 2: Recipe matching
  for (const recipe of RECIPES) {
    for (const detectFile of recipe.detect) {
      if (await fileExists(join(root, detectFile))) {
        return { method: "recipe", config: recipe.config, recipe: recipe.name };
      }
    }
  }

  // Tier 3: Gitignore inference
  const config = await inferFromGitignore(root);
  if (config) {
    return { method: "gitignore", config };
  }

  return { method: "none", config: null };
}
```

### Recipes (`src/detect/recipes.ts`)

Simple objects mapping markers to cache config:

```typescript
interface Recipe {
  name: string;
  detect: string[];      // Files that trigger this recipe
  config: {
    cache: string[];     // Glob patterns to cache
    post_restore?: string;
  };
}

const RECIPES: Recipe[] = [
  {
    name: "pnpm",
    detect: ["pnpm-lock.yaml"],
    config: { cache: ["node_modules"] },
  },
  {
    name: "bun",
    detect: ["bun.lock", "bun.lockb"],
    config: { cache: ["node_modules"] },
  },
  {
    name: "turborepo",
    detect: ["turbo.json"],
    config: { cache: ["node_modules", ".turbo", "**/node_modules"] },
  },
  // ... more recipes
];
```

### Copy (`src/copy.ts`)

Hardlink copy using system `cp` with platform detection:

```typescript
export async function hardlinkCopy(src: string, dest: string): Promise<void> {
  // macOS: cp -Rl (recursive, hardlink)
  // Linux: cp -al (archive, hardlink)
  const isMacOS = process.platform === "darwin";
  const flags = isMacOS ? ["-Rl"] : ["-al"];

  await exec(["cp", ...flags, src, dest]);
}

export async function copyArtifacts(
  sourceRoot: string,
  destRoot: string,
  patterns: string[]
): Promise<string[]> {
  const copied: string[] = [];

  for (const pattern of patterns) {
    // Expand globs using Bun.Glob
    const matches = await expandGlob(pattern, sourceRoot);

    for (const match of deduplicatePaths(matches)) {
      const src = join(sourceRoot, match);
      const dest = join(destRoot, match);

      if (await exists(src) && !(await exists(dest))) {
        await hardlinkCopy(src, dest);
        copied.push(match);
      }
    }
  }

  return copied;
}
```

### Git Operations (`src/git.ts`)

Thin wrappers around git commands:

```typescript
export async function createWorktree(
  branch: string,
  targetPath: string,
  options?: { baseBranch?: string; createBranch?: boolean; cwd?: string }
): Promise<void> {
  const args = ["git", "worktree", "add"];

  if (options?.createBranch) {
    // Check if branch exists, create with -b if not
    const branchExists = await checkBranchExists(branch, options.cwd);
    if (!branchExists) {
      args.push("-b", branch, targetPath);
      if (options.baseBranch) args.push(options.baseBranch);
    } else {
      args.push(targetPath, branch);
    }
  } else {
    args.push(targetPath, branch);
  }

  await exec(args, { cwd: options?.cwd });
}

export async function isPathIgnored(path: string, cwd?: string): Promise<boolean> {
  try {
    await exec(["git", "check-ignore", "-q", path], { cwd });
    return true;
  } catch {
    return false;
  }
}
```

## Data Flow: `wtree add .worktrees/feature-x`

```
1. Parse CLI args
   └─> path: ".worktrees/feature-x", branch: "feature-x" (inferred)

2. Find source worktree
   └─> git worktree list -> current worktree

3. Detect config from source
   └─> Check .wtree.yaml || match recipes || infer from .gitignore
   └─> Result: { cache: ["node_modules"], recipe: "bun" }

4. Check if nested worktree
   └─> Path is inside repo -> check if gitignored
   └─> Not ignored -> set warning message

5. Create worktree
   └─> git worktree add -b feature-x .worktrees/feature-x main

6. Copy artifacts
   └─> cp -Rl source/node_modules .worktrees/feature-x/node_modules

7. Run post_restore (if defined)
   └─> sh -c "pnpm install --prefer-offline"

8. Output result
   └─> { success: true, worktree: {...}, artifacts: {...}, warning: "..." }
```

## Error Handling

Custom error class with codes for structured output:

```typescript
enum ErrorCode {
  GIT_ERROR = "GIT_ERROR",
  WORKTREE_EXISTS = "WORKTREE_EXISTS",
  WORKTREE_NOT_FOUND = "WORKTREE_NOT_FOUND",
  CONFIG_ERROR = "CONFIG_ERROR",
  COPY_ERROR = "COPY_ERROR",
  INVALID_ARGS = "INVALID_ARGS",
}

class WtreeError extends Error {
  constructor(message: string, public code: ErrorCode) {
    super(message);
  }
}
```

In JSON mode, errors are structured:

```json
{
  "error": true,
  "code": "WORKTREE_NOT_FOUND",
  "message": "Source worktree not found: develop"
}
```

## Build & Distribution

```bash
# Development
bun run src/index.ts add ../feature-branch

# Build single binary
bun build src/index.ts --compile --outfile wtree

# Build for multiple platforms
bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/wtree-linux-x64
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/wtree-darwin-arm64
```

## Future Considerations

- **Parallel copies**: For monorepos with many `node_modules`, parallelize hardlink operations
- **Copy-on-write**: On APFS/Btrfs, use `cp -c` for even faster copies
- **Lockfile diffing**: Skip post_restore if lockfiles match exactly
- **Remote caching**: Pull pre-built artifacts from CI cache
