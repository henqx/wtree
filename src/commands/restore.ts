import { resolve } from "path";
import type { RestoreResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import {
  getWorktreeRoot,
  findWorktreeByBranch,
  listWorktrees,
  findBestSourceWorktree,
} from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { copyArtifacts, runPostRestore } from "../copy.ts";
import { stat } from "fs/promises";
import { color } from "../color.ts";
import { ProgressTracker, shouldShowProgress } from "../progress.ts";

/**
 * Check if a path is a valid worktree
 */
async function isWorktree(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    if (!s.isDirectory()) return false;
    // Check for .git file/directory
    await stat(`${path}/.git`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Restore command - restore artifacts to an existing worktree
 * Auto-detects source worktree if --from is not provided
 */
export async function restore(args: ParsedArgs): Promise<RestoreResult> {
  // Validate arguments
  if (args.positional.length === 0) {
    throw new WtreeError(
      "Missing target path. Usage: wtree restore <path> [--from <branch>]",
      ErrorCode.INVALID_ARGS
    );
  }

  const targetPath = resolve(args.positional[0]);

  // Validate target is a worktree
  if (!(await isWorktree(targetPath))) {
    throw new WtreeError(
      `Target path is not a valid worktree: ${targetPath}`,
      ErrorCode.WORKTREE_NOT_FOUND
    );
  }

  // Find source worktree
  let sourceWorktree;
  let autoDetectWarning: string | undefined;
  let fromBranch: string;

  if (args.flags.from) {
    // Explicit source specified
    fromBranch = args.flags.from;
    sourceWorktree = await findWorktreeByBranch(fromBranch);
    if (!sourceWorktree) {
      throw new WtreeError(
        `Source worktree not found: ${fromBranch}`,
        ErrorCode.WORKTREE_NOT_FOUND
      );
    }
  } else {
    // Auto-detect best source worktree
    const bestSource = await findBestSourceWorktree();
    sourceWorktree = bestSource.worktree;
    fromBranch = bestSource.source;
    autoDetectWarning = bestSource.warning;
  }

  // Detect configuration from source
  const detection = await detectConfig(sourceWorktree.path);

  if (!detection.config) {
    throw new WtreeError(
      "No artifact configuration detected in source worktree",
      ErrorCode.DETECTION_FAILED
    );
  }

  // Setup progress tracking
  const showProgress = shouldShowProgress(args);
  const progress = new ProgressTracker({
    enabled: showProgress,
    total: detection.config.cache.length,
    label: "copying artifacts",
  });

  // Copy artifacts
  const copiedArtifacts = await copyArtifacts(
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

  return {
    success: true,
    target: {
      path: targetPath,
    },
    source: {
      path: sourceWorktree.path,
      branch: sourceWorktree.branch,
    },
    artifacts: {
      patterns: detection.config.cache,
      copied: copiedArtifacts,
    },
    recipe: detection.recipe,
    recipes: detection.recipes,
    warning: autoDetectWarning,
  };
}

/**
 * Format restore result for human output
 */
export function formatRestoreResult(result: RestoreResult): string {
  const lines: string[] = [];

  lines.push(`${color.success("✓")} Restored artifacts to ${color.bold(result.target.path)}`);
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
  } else {
    lines.push(`  ${color.muted("No new artifacts to copy")}`);
  }

  if (result.warning) {
    lines.push("");
    lines.push(`${color.warning("⚠")} ${color.yellow(result.warning)}`);
  }

  return lines.join("\n");
}
