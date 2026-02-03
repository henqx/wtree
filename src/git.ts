import type { Worktree } from "./types.ts";
import { WtreeError, ErrorCode } from "./types.ts";

/**
 * Execute a git command and return stdout
 */
export async function gitCommand(
  args: string[],
  cwd?: string
): Promise<string> {
  return exec(["git", ...args], { cwd });
}

/**
 * Execute a command and return stdout
 */
async function exec(
  cmd: string[],
  options?: { cwd?: string }
): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new WtreeError(
      `Command failed: ${cmd.join(" ")}\n${stderr.trim()}`,
      ErrorCode.GIT_ERROR
    );
  }

  return stdout;
}

/**
 * Get the root of the current git repository/worktree
 */
export async function getWorktreeRoot(cwd?: string): Promise<string> {
  const output = await exec(["git", "rev-parse", "--show-toplevel"], { cwd });
  return output.trim();
}

/**
 * Get the root of the main git directory (where .git is)
 */
export async function getGitDir(cwd?: string): Promise<string> {
  const output = await exec(["git", "rev-parse", "--git-dir"], { cwd });
  const gitDir = output.trim();
  // Resolve to absolute path if relative
  if (!gitDir.startsWith("/")) {
    const root = await getWorktreeRoot(cwd);
    return `${root}/${gitDir}`;
  }
  return gitDir;
}

/**
 * Parse the output of `git worktree list --porcelain`
 */
function parseWorktreeList(output: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const blocks = output.trim().split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split("\n");
    let path = "";
    let branch = "";
    let bare = false;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        path = line.slice(9);
      } else if (line.startsWith("branch refs/heads/")) {
        branch = line.slice(18);
      } else if (line.startsWith("HEAD ")) {
        // Detached HEAD - use the commit hash
        if (!branch) {
          branch = line.slice(5, 12); // Short hash
        }
      } else if (line === "bare") {
        bare = true;
      } else if (line === "detached") {
        // Already handled via HEAD
      }
    }

    if (path) {
      worktrees.push({ path, branch, bare });
    }
  }

  return worktrees;
}

/**
 * List all worktrees in the repository
 */
export async function listWorktrees(cwd?: string): Promise<Worktree[]> {
  const output = await exec(["git", "worktree", "list", "--porcelain"], {
    cwd,
  });
  return parseWorktreeList(output);
}

/**
 * Find a worktree by branch name
 */
export async function findWorktreeByBranch(
  branch: string,
  cwd?: string
): Promise<Worktree | undefined> {
  const worktrees = await listWorktrees(cwd);
  return worktrees.find((w) => w.branch === branch);
}

/**
 * Check if a worktree has populated cache (at least one cache directory exists with content)
 */
async function hasPopulatedCache(
  worktree: Worktree,
  cachePatterns: string[]
): Promise<boolean> {
  const { stat } = await import("fs/promises");
  const { join } = await import("path");

  for (const pattern of cachePatterns) {
    // Skip glob patterns for this check
    if (pattern.includes("*")) continue;

    try {
      const cachePath = join(worktree.path, pattern);
      const s = await stat(cachePath);
      if (s.isDirectory() && s.size > 0) {
        // Check if directory has contents (non-empty)
        const { readdir } = await import("fs/promises");
        const contents = await readdir(cachePath);
        if (contents.length > 0) {
          return true;
        }
      }
    } catch {
      // Directory doesn't exist or is empty, continue checking
      continue;
    }
  }

  return false;
}

/**
 * Find the best source worktree for restoring cache.
 * Best-guess priority:
 * 1. main branch with populated cache
 * 2. master branch with populated cache
 * 3. Any worktree with populated cache
 * 4. Current worktree (even if empty cache)
 * 5. First available worktree
 */
export async function findBestSourceWorktree(
  cwd?: string
): Promise<{ worktree: Worktree; source: string; warning?: string }> {
  const { detectConfig } = await import("./detect/index.ts");
  const worktrees = await listWorktrees(cwd);
  const nonBareWorktrees = worktrees.filter((w) => !w.bare);

  if (nonBareWorktrees.length === 0) {
    throw new WtreeError(
      "No worktrees found to copy cache from",
      ErrorCode.WORKTREE_NOT_FOUND
    );
  }

  // Check each worktree for cache and track the best candidates
  const candidates: Array<{
    worktree: Worktree;
    hasCache: boolean;
    isMain: boolean;
    isMaster: boolean;
  }> = [];

  for (const wt of nonBareWorktrees) {
    const detection = await detectConfig(wt.path);
    const cachePatterns = detection.config?.cache ?? [];
    const hasCache =
      cachePatterns.length > 0 && (await hasPopulatedCache(wt, cachePatterns));

    candidates.push({
      worktree: wt,
      hasCache,
      isMain: wt.branch === "main",
      isMaster: wt.branch === "master",
    });
  }

  // Priority 1: main with cache
  const mainWithCache = candidates.find((c) => c.isMain && c.hasCache);
  if (mainWithCache) {
    return { worktree: mainWithCache.worktree, source: "main" };
  }

  // Priority 2: master with cache
  const masterWithCache = candidates.find((c) => c.isMaster && c.hasCache);
  if (masterWithCache) {
    return { worktree: masterWithCache.worktree, source: "master" };
  }

  // Priority 3: Any worktree with cache
  const anyWithCache = candidates.find((c) => c.hasCache);
  if (anyWithCache) {
    return {
      worktree: anyWithCache.worktree,
      source: anyWithCache.worktree.branch,
      warning: `Auto-detected source: ${anyWithCache.worktree.branch} (has cache)`,
    };
  }

  // Priority 4: Current worktree
  try {
    const current = await getCurrentWorktree(cwd);
    return {
      worktree: current,
      source: current.branch,
      warning: `No cached worktrees found. Using current: ${current.branch}`,
    };
  } catch {
    // Priority 5: First available
    return {
      worktree: nonBareWorktrees[0],
      source: nonBareWorktrees[0].branch,
      warning: `No cached worktrees found. Using: ${nonBareWorktrees[0].branch}`,
    };
  }
}

/**
 * Get the current worktree
 */
export async function getCurrentWorktree(cwd?: string): Promise<Worktree> {
  const root = await getWorktreeRoot(cwd);
  const worktrees = await listWorktrees(cwd);
  const current = worktrees.find((w) => w.path === root);

  if (!current) {
    throw new WtreeError(
      "Could not determine current worktree",
      ErrorCode.GIT_ERROR
    );
  }

  return current;
}

/**
 * Create a new git worktree
 */
export async function createWorktree(
  branch: string,
  targetPath: string,
  options?: { baseBranch?: string; createBranch?: boolean; cwd?: string }
): Promise<void> {
  const args = ["git", "worktree", "add"];

  if (options?.createBranch) {
    // Check if branch already exists
    try {
      await exec(["git", "rev-parse", "--verify", `refs/heads/${branch}`], {
        cwd: options?.cwd,
      });
      // Branch exists, just check it out
      args.push(targetPath, branch);
    } catch {
      // Branch doesn't exist, create it
      args.push("-b", branch, targetPath);
      if (options?.baseBranch) {
        args.push(options.baseBranch);
      }
    }
  } else {
    // Checkout existing branch
    args.push(targetPath, branch);
  }

  await exec(args, { cwd: options?.cwd });
}

/**
 * Check if a path is ignored by git
 */
export async function isPathIgnored(
  path: string,
  cwd?: string
): Promise<boolean> {
  try {
    await exec(["git", "check-ignore", "-q", path], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(
  path: string,
  options?: { force?: boolean; cwd?: string }
): Promise<void> {
  const args = ["git", "worktree", "remove"];
  if (options?.force) {
    args.push("--force");
  }
  args.push(path);

  await exec(args, { cwd: options?.cwd });
}

/**
 * Prune stale worktree references
 */
export async function pruneWorktrees(cwd?: string): Promise<void> {
  await exec(["git", "worktree", "prune"], { cwd });
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  try {
    const output = await exec(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
    });
    return output.trim();
  } catch {
    // Detached HEAD - return short hash
    const output = await exec(["git", "rev-parse", "--short", "HEAD"], { cwd });
    return output.trim();
  }
}

/**
 * Check if we're inside a git repository
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
  try {
    await exec(["git", "rev-parse", "--git-dir"], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a worktree by path (resolves symlinks for comparison)
 */
export async function findWorktreeByPath(
  targetPath: string,
  cwd?: string
): Promise<Worktree | undefined> {
  const { resolve } = await import("path");
  const { realpath } = await import("fs/promises");

  let absolutePath: string;
  try {
    // Resolve symlinks (e.g., /tmp -> /private/tmp on macOS)
    absolutePath = await realpath(resolve(targetPath));
  } catch {
    // Path doesn't exist yet, use resolved path
    absolutePath = resolve(targetPath);
  }

  const worktrees = await listWorktrees(cwd);
  return worktrees.find((w) => w.path === absolutePath);
}
