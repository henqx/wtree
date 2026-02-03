import type { Worktree } from "./types.ts";
import { WtreeError, ErrorCode } from "./types.ts";

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
