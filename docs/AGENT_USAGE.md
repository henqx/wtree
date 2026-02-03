# wtree Usage Examples for AI Agents

This guide shows how to integrate wtree into AI coding agent workflows (Cursor, Codex, Claude Code).

## Quick Start

```bash
# Check if wtree is available and properly configured
wtree doctor

# Analyze current project for caching configuration
wtree analyze

# Create .wtree.yaml if needed
wtree init
```

## Common Patterns

### Creating Parallel Worktrees

```bash
# Create a worktree for a new feature branch
wtree add ../feature-auth -b feature-auth

# Create a worktree for bug fix based on main
wtree add ../hotfix-t1234 main

# Nested worktree (recommended pattern for AI agents)
wtree add .worktrees/experiment-cache --from main
```

### Restoring Artifacts

```bash
# Restore artifacts to an existing worktree (auto-detects best source)
wtree restore ../feature-auth

# Explicitly restore from main worktree
wtree restore ../experiment --from main

# With JSON output for programmatic use
wtree restore ../worktree --from main --json
```

### Checking Worktree Status

```bash
# List all worktrees with cache status
wtree list

# Get structured output for automation
wtree list --json
```

## Agent Integration Patterns

### Pattern 1: Pre-flight Check

Before creating parallel tasks, verify wtree is ready:

```javascript
// Example agent integration
async function checkWtree() {
  const result = await exec("wtree doctor --json");
  const status = JSON.parse(result);
  
  if (!status.healthy) {
    throw new Error(`wtree issues: ${status.summary.errors} errors`);
  }
  
  return status;
}
```

### Pattern 2: Setup New Work Branch

```javascript
async function setupWorkBranch(branchName) {
  // 1. Check if worktree already exists
  const list = await exec("wtree list --json");
  const worktrees = JSON.parse(list);
  
  const existing = worktrees.worktrees.find(w => w.branch === branchName);
  if (existing) {
    return existing.path;
  }
  
  // 2. Create worktree with cached artifacts
  const result = await exec(`wtree add ../${branchName} -b ${branchName} --json`);
  const { worktree } = JSON.parse(result);
  
  return worktree.path;
}
```

### Pattern 3: Restore Missing Artifacts

```javascript
async function ensureArtifacts(worktreePath) {
  // Check if artifacts exist
  const result = await exec(`wtree restore ${worktreePath} --json`);
  const status = JSON.parse(result);
  
  if (status.artifacts.copied.length === 0) {
    console.log("All artifacts already present");
  } else {
    console.log(`Restored ${status.artifacts.copied.length} artifacts`);
  }
}
```

### Pattern 4: Parallel Task Runner

```javascript
async function runParallelTasks(tasks) {
  const worktrees = [];
  
  try {
    // Create worktrees for each task
    for (const task of tasks) {
      const path = await setupWorkBranch(task.branch);
      worktrees.push({ path, task });
    }
    
    // Run tasks in parallel
    await Promise.all(worktrees.map(async ({ path, task }) => {
      await runTaskInWorktree(path, task);
    }));
    
  } finally {
    // Cleanup: remove worktrees
    for (const { path } of worktrees) {
      await exec(`wtree remove ${path} --force`);
    }
  }
}
```

## JSON Output Schema

All commands support `--json` for structured output:

### `wtree add` Output

```json
{
  "success": true,
  "worktree": {
    "path": "/Users/dev/work/feature-x",
    "branch": "feature-x"
  },
  "source": {
    "path": "/Users/dev/project",
    "branch": "main"
  },
  "artifacts": {
    "patterns": ["node_modules"],
    "copied": ["node_modules"]
  },
  "recipe": "bun",
  "warning": "Add \".worktrees/\" to .gitignore to avoid committing worktree contents"
}
```

### `wtree list` Output

```json
{
  "success": true,
  "worktrees": [
    {
      "path": "/Users/dev/project",
      "branch": "main",
      "current": true,
      "recipe": "bun",
      "artifacts": [
        { "pattern": "node_modules", "exists": true }
      ]
    }
  ]
}
```

### `wtree doctor` Output

```json
{
  "success": true,
  "healthy": true,
  "checks": [
    {
      "name": "Git repository",
      "status": "ok",
      "message": "Found git repository at /Users/dev/project"
    }
  ],
  "summary": {
    "total": 7,
    "ok": 7,
    "warnings": 0,
    "errors": 0
  }
}
```

## Configuration Examples

### For Node.js Projects

```yaml
# .wtree.yaml
extends: pnpm
cache:
  - .turbo
  - dist
  - build
post_restore: pnpm install --frozen-lockfile
```

### For Python Projects

```yaml
# .wtree.yaml
extends: python-uv
cache:
  - .venv
  - __pypackages__
  - .pytest_cache
post_restore: uv sync
```

### For Monorepos

```yaml
# .wtree.yaml
extends: turborepo
cache:
  - node_modules
  - .turbo
  - "**/node_modules"
  - "**/dist"
```

## Best Practices for AI Agents

1. **Always use --json** for reliable parsing
2. **Check doctor status** before parallel operations
3. **Use nested worktrees** (`.worktrees/`) for better isolation
4. **Run init first** to ensure consistent configuration
5. **Handle warnings** from add/restore commands (especially gitignore)
6. **Clean up worktrees** after use to avoid disk space issues

## Error Handling

All errors return JSON with this structure:

```json
{
  "error": true,
  "code": "WORKTREE_EXISTS",
  "message": "Worktree already exists for branch 'feature-x' at /Users/dev/work/feature-x"
}
```

Common error codes:
- `WORKTREE_EXISTS`: Worktree already exists for this branch
- `WORKTREE_NOT_FOUND`: Source or target worktree not found
- `CONFIG_ERROR`: Invalid .wtree.yaml configuration
- `GIT_ERROR`: Git operation failed
- `COPY_ERROR`: Failed to copy artifacts
