import { resolve, basename, relative, dirname } from "path";
import { realpath } from "fs/promises";
import type { AddResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import { color } from "../color.ts";
import {
  getWorktreeRoot,
  findWorktreeByBranch,
  createWorktree,
  getCurrentWorktree,
  isPathIgnored,
} from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { copyArtifacts, runPostRestore } from "../copy.ts";
import { ProgressTracker, shouldShowProgress } from "../progress.ts";

/**
 * Resolve path with symlinks, handling non-existent paths by walking up to first existing ancestor
 */
async function resolveRealPath(path: string): Promise<string> {
  const resolved = resolve(path);
  const parts: string[] = [];

  let current = resolved;
  while (current !== "/") {
    try {
      const real = await realpath(current);
      // Found an existing path, append any remaining parts
      return parts.length > 0 ? `${real}/${parts.reverse().join("/")}` : real;
    } catch {
      // Path doesn't exist, save the basename and move up
      parts.push(basename(current));
      current = dirname(current);
    }
  }

  // Reached root, return original resolved path
  return resolved;
}

/**
 * Add command - create a new worktree with cached artifacts
 * Follows git worktree add semantics: wtree add <path> [branch]
 */
export async function add(args: ParsedArgs): Promise<AddResult> {
  if (args.positional.length === 0) {
    throw new WtreeError(
      "Missing path. Usage: wtree add <path> [branch] or wtree add -b <new-branch> <path>",
      ErrorCode.INVALID_ARGS
    );
  }

  const targetPath = resolve(args.positional[0]);
  const existingBranch = args.positional[1]; // optional: checkout existing branch
  const newBranch = args.flags.branch; // -b flag: create new branch

  // Determine branch name
  let branch: string;
  let createNewBranch: boolean;

  if (newBranch) {
    // -b flag: create new branch
    branch = newBranch;
    createNewBranch = true;
  } else if (existingBranch) {
    // Second positional: checkout existing branch
    branch = existingBranch;
    createNewBranch = false;
  } else {
    // Infer branch name from path basename
    branch = basename(targetPath);
    createNewBranch = true;
  }

  // Find source worktree
  let sourceWorktree;
  if (args.flags.from) {
    sourceWorktree = await findWorktreeByBranch(args.flags.from);
    if (!sourceWorktree) {
      throw new WtreeError(
        `Source worktree not found: ${args.flags.from}`,
        ErrorCode.WORKTREE_NOT_FOUND
      );
    }
  } else {
    sourceWorktree = await getCurrentWorktree();
  }

  // Check if target branch already has a worktree
  const existingWorktree = await findWorktreeByBranch(branch);
  if (existingWorktree) {
    throw new WtreeError(
      `Worktree already exists for branch '${branch}' at ${existingWorktree.path}`,
      ErrorCode.WORKTREE_EXISTS
    );
  }

  // Detect configuration from source
  const detection = await detectConfig(sourceWorktree.path);

  // Check if this is a nested worktree (inside the repo)
  // Resolve symlinks to ensure consistent path comparison (e.g., /tmp vs /private/tmp on macOS)
  const repoRoot = await getWorktreeRoot(sourceWorktree.path);
  const resolvedTargetPath = await resolveRealPath(targetPath);
  const relativePath = relative(repoRoot, resolvedTargetPath);
  const isNested = !relativePath.startsWith("..");

  let gitignoreWarning: string | undefined;
  if (isNested) {
    // Check if path is gitignored
    const ignored = await isPathIgnored(relativePath, repoRoot);
    if (!ignored) {
      const dirToIgnore = relativePath.split("/")[0];
      gitignoreWarning = `Add "${dirToIgnore}/" to .gitignore to avoid committing worktree contents`;
    }
  }

  // Create the worktree
  await createWorktree(branch, targetPath, {
    baseBranch: createNewBranch ? sourceWorktree.branch : undefined,
    createBranch: createNewBranch,
    cwd: sourceWorktree.path,
  });

  // Copy artifacts if config was detected
  let copiedArtifacts: string[] = [];
  if (detection.config) {
    // Setup progress tracking
    const showProgress = shouldShowProgress(args);
    const progress = new ProgressTracker({
      enabled: showProgress,
      total: detection.config.cache.length,
      label: "copying artifacts",
    });

    copiedArtifacts = await copyArtifacts(
      sourceWorktree.path,
      targetPath,
      detection.config.cache,
      (current, total, path) => {
        progress.update(current, path);
      },
      { useReflink: !args.flags.noReflinks }
    );
    progress.finish(`${copiedArtifacts.length} artifacts`);

    // Run post_restore if defined
    if (detection.config.post_restore) {
      await runPostRestore(detection.config.post_restore, targetPath);
    }
  }

  return {
    success: true,
    worktree: {
      path: targetPath,
      branch,
    },
    source: {
      path: sourceWorktree.path,
      branch: sourceWorktree.branch,
    },
    artifacts: {
      patterns: detection.config?.cache ?? [],
      copied: copiedArtifacts,
    },
    recipe: detection.recipe,
    recipes: detection.recipes,
    warning: gitignoreWarning,
  };
}

/**
 * Format add result for human output
 */
export function formatAddResult(result: AddResult): string {
  const lines: string[] = [];

  lines.push(`${color.success("✓")} Created worktree at ${color.bold(result.worktree.path)}`);
  lines.push(`  ${color.muted("Branch:")} ${result.worktree.branch}`);
  lines.push(`  ${color.muted("Source:")} ${result.source.path} (${result.source.branch})`);

  if (result.recipes && result.recipes.length > 1) {
    lines.push(`  ${color.muted("Recipes:")} ${result.recipes.join(", ")}`);
  } else if (result.recipe) {
    lines.push(`  ${color.muted("Recipe:")} ${result.recipe}`);
  }

  if (result.artifacts.copied.length > 0) {
    lines.push(`  ${color.muted("Artifacts:")} ${color.success(String(result.artifacts.copied.length))} copied`);
    for (const artifact of result.artifacts.copied.slice(0, 5)) {
      lines.push(`    ${color.green("+")} ${artifact}`);
    }
    if (result.artifacts.copied.length > 5) {
      lines.push(`    ${color.muted(`... and ${result.artifacts.copied.length - 5} more`)}`);
    }
  } else if (result.artifacts.patterns.length > 0) {
    lines.push(`  ${color.muted("No artifacts found to copy")}`);
  } else {
    lines.push(`  ${color.muted("No artifact caching configured")}`);
  }

  if (result.warning) {
    lines.push("");
    lines.push(`${color.warning("⚠")} ${color.yellow(result.warning)}`);
  }

  return lines.join("\n");
}
