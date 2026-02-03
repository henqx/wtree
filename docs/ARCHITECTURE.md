# Architecture

## Design Principles

1. **Zero config by default** - Works out of the box for common stacks
2. **Thin wrapper** - Shell out to system tools (`git`, `cp`) for heavy lifting
3. **Fast startup** - Bun compiled binary, minimal dependencies
4. **Source worktree = cache** - No separate cache directory to manage

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
│  create, restore, analyze, remove                           │
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
│  git, cp -al, pnpm/npm/cargo/etc                            │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
wtree/
├── src/
│   ├── index.ts          # Entry point, CLI setup
│   ├── cli.ts            # Argument parsing (minimal, use parseArgs)
│   ├── commands/
│   │   ├── create.ts     # Main command: create worktree + restore
│   │   ├── restore.ts    # Restore artifacts to existing worktree
│   │   ├── analyze.ts    # Show detected config
│   │   └── remove.ts     # Remove worktree
│   ├── detect/
│   │   ├── index.ts      # Main detection orchestrator
│   │   ├── recipes.ts    # Built-in recipe definitions
│   │   └── gitignore.ts  # .gitignore parser and inference
│   ├── copy.ts           # Hardlink copy implementation
│   ├── git.ts            # Git command wrappers
│   ├── config.ts         # .wtree.yaml parsing
│   └── types.ts          # Shared type definitions
├── scripts/
│   └── install.sh        # curl installer script
├── package.json
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
└── ROADMAP.md
```

## Core Components

### Detection (`src/detect/`)

Detection runs on every command but is fast (~5ms) because it only reads top-level files.

**Priority order:**
1. `.wtree.yaml` - Explicit config, skip detection
2. Built-in recipes - Match against lockfiles/markers
3. `.gitignore` inference - Fallback for unknown stacks

```typescript
// src/detect/index.ts
export async function detectConfig(root: string): Promise<Config> {
  // 1. Check for explicit config
  const configPath = path.join(root, ".wtree.yaml");
  if (await exists(configPath)) {
    return parseConfig(configPath);
  }

  // 2. Try built-in recipes
  const files = await readdir(root);
  for (const recipe of RECIPES) {
    if (recipe.detect(files)) {
      return recipe.config;
    }
  }

  // 3. Infer from .gitignore
  return inferFromGitignore(root);
}
```

### Recipes (`src/detect/recipes.ts`)

Recipes are simple objects matching markers to cache config:

```typescript
interface Recipe {
  name: string;
  detect: (files: string[]) => boolean;
  config: Config;
}

interface Config {
  cache: string[];           // Glob patterns to cache
  post_restore?: string;      // Command to run after restore
}

const RECIPES: Recipe[] = [
  {
    name: "pnpm",
    detect: (files) => files.includes("pnpm-lock.yaml"),
    config: {
      cache: ["node_modules"],
      post_restore: "pnpm install --prefer-offline --frozen-lockfile",
    },
  },
  {
    name: "turborepo",
    detect: (files) => files.includes("turbo.json"),
    config: {
      cache: ["node_modules", ".turbo", "**/node_modules"],
      post_restore: "pnpm install --prefer-offline",
    },
  },
  // ... more recipes
];
```

### Gitignore Inference (`src/detect/gitignore.ts`)

Maps common gitignore patterns to cacheable directories:

```typescript
const GITIGNORE_HINTS: Record<string, CacheHint> = {
  "node_modules": { cache: "node_modules", stack: "node" },
  ".next": { cache: ".next/cache", stack: "nextjs" },
  ".turbo": { cache: ".turbo", stack: "turborepo" },
  ".venv": { cache: ".venv", stack: "python" },
  "target": { cache: "target", stack: "rust" },
  "__pycache__": { cache: "__pycache__", stack: "python" },
  "vendor": { cache: "vendor", stack: "go" },
};

export function inferFromGitignore(root: string): Config {
  const gitignore = readFileSync(path.join(root, ".gitignore"), "utf-8");
  const lines = gitignore.split("\n").map((l) => l.trim().replace(/\/$/, ""));
  
  const cache: string[] = [];
  for (const line of lines) {
    const hint = GITIGNORE_HINTS[line];
    if (hint) cache.push(hint.cache);
  }
  
  return { cache, post_restore: undefined };
}
```

### Copy (`src/copy.ts`)

Hardlink copy using system `cp`:

```typescript
export async function hardlinkCopy(src: string, dest: string): Promise<void> {
  const proc = Bun.spawn(["cp", "-al", src, dest], {
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Failed to copy ${src} to ${dest}`);
  }
}

export async function copyArtifacts(
  sourceRoot: string,
  destRoot: string,
  patterns: string[]
): Promise<string[]> {
  const copied: string[] = [];
  
  for (const pattern of patterns) {
    if (pattern.includes("**")) {
      // Glob pattern - expand and copy each match
      const matches = await glob(pattern, { cwd: sourceRoot });
      for (const match of matches) {
        await hardlinkCopy(
          path.join(sourceRoot, match),
          path.join(destRoot, match)
        );
        copied.push(match);
      }
    } else {
      // Direct path
      const src = path.join(sourceRoot, pattern);
      if (await exists(src)) {
        await hardlinkCopy(src, path.join(destRoot, pattern));
        copied.push(pattern);
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
  targetPath: string
): Promise<void> {
  await exec(["git", "worktree", "add", targetPath, "-b", branch]);
}

export async function removeWorktree(targetPath: string): Promise<void> {
  await exec(["git", "worktree", "remove", targetPath]);
}

export async function getWorktreeRoot(): Promise<string> {
  const result = await exec(["git", "rev-parse", "--show-toplevel"]);
  return result.stdout.trim();
}

export async function listWorktrees(): Promise<Worktree[]> {
  const result = await exec(["git", "worktree", "list", "--porcelain"]);
  // Parse porcelain output
  return parseWorktreeList(result.stdout);
}
```

### CLI (`src/cli.ts`)

Uses Bun's built-in `parseArgs` for simplicity:

```typescript
import { parseArgs } from "util";

export function parse(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      from: { type: "string", short: "f" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
  });

  const [command, ...rest] = positionals;
  return { command, args: rest, flags: values };
}
```

## Data Flow: `wtree create feature-branch`

```
1. Parse CLI args
   └─> command: "create", branch: "feature-branch", from: undefined

2. Find source worktree
   └─> git worktree list -> find main/current worktree path

3. Detect config from source
   └─> Check .wtree.yaml || match recipes || infer from .gitignore
   └─> Result: { cache: ["node_modules", ".turbo"], post_restore: "pnpm install..." }

4. Determine target path
   └─> Default: ../repo-feature-branch (sibling directory)

5. Create worktree
   └─> git worktree add ../repo-feature-branch -b feature-branch

6. Copy artifacts
   └─> For each pattern in config.cache:
       └─> cp -al source/node_modules target/node_modules
       └─> cp -al source/.turbo target/.turbo

7. Run post_restore
   └─> cd target && pnpm install --prefer-offline --frozen-lockfile

8. Output result
   └─> { worktree: "/path/to/repo-feature-branch", cached: [...], ready: true }
```

## Error Handling

Keep it simple—fail fast with clear messages:

```typescript
class WtreeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// Usage
if (!await exists(sourceWorktree)) {
  throw new WtreeError(
    `Source worktree not found: ${sourceWorktree}`,
    "SOURCE_NOT_FOUND"
  );
}
```

In JSON mode, errors are structured:

```json
{
  "error": true,
  "code": "SOURCE_NOT_FOUND",
  "message": "Source worktree not found: /path/to/main"
}
```

## Testing Strategy

1. **Unit tests** for detection logic (recipe matching, gitignore parsing)
2. **Integration tests** using real git repos in temp directories
3. **Snapshot tests** for CLI output formatting

```typescript
// Example test
test("detects pnpm project", async () => {
  const tmp = await createTempRepo({
    "pnpm-lock.yaml": "",
    "package.json": "{}",
  });
  
  const config = await detectConfig(tmp);
  
  expect(config.cache).toContain("node_modules");
  expect(config.post_restore).toContain("pnpm");
});
```

## Build & Distribution

```bash
# Development
bun run src/index.ts create feature-branch

# Build single binary
bun build src/index.ts --compile --outfile wtree

# Build for multiple platforms (CI)
bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/wtree-linux-x64
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/wtree-darwin-arm64
```

## Future Considerations

- **Parallel copies**: For monorepos with many `node_modules`, parallelize the hardlink operations
- **Copy-on-write**: On APFS/Btrfs, use `cp -c` for even faster copies
- **Lockfile diffing**: Skip post_restore if lockfiles match exactly
- **Remote caching**: Pull pre-built artifacts from CI cache (like Turborepo)
