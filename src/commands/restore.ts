import { resolve } from "path";
import type { RestoreResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import { getWorktreeRoot, findWorktreeByBranch, listWorktrees } from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { copyArtifacts, runPostRestore } from "../copy.ts";
import { stat } from "fs/promises";
import { color } from "../color.ts";

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
 */
export async function restore(args: ParsedArgs): Promise<RestoreResult> {
  // Validate arguments
  if (args.positional.length === 0) {
    throw new WtreeError(
      "Missing target path. Usage: wtree restore <path> --from <branch>",
      ErrorCode.INVALID_ARGS
    );
  }

  if (!args.flags.from) {
    throw new WtreeError(
      "Missing --from flag. Usage: wtree restore <path> --from <branch>",
      ErrorCode.INVALID_ARGS
    );
  }

  const targetPath = resolve(args.positional[0]);
  const fromBranch = args.flags.from;

  // Validate target is a worktree
  if (!(await isWorktree(targetPath))) {
    throw new WtreeError(
      `Target path is not a valid worktree: ${targetPath}`,
      ErrorCode.WORKTREE_NOT_FOUND
    );
  }

  // Find source worktree
  const sourceWorktree = await findWorktreeByBranch(fromBranch);
  if (!sourceWorktree) {
    throw new WtreeError(
      `Source worktree not found: ${fromBranch}`,
      ErrorCode.WORKTREE_NOT_FOUND
    );
  }

  // Detect configuration from source
  const detection = await detectConfig(sourceWorktree.path);

  if (!detection.config) {
    throw new WtreeError(
      "No artifact configuration detected in source worktree",
      ErrorCode.DETECTION_FAILED
    );
  }

  // Copy artifacts
  const copiedArtifacts = await copyArtifacts(
    sourceWorktree.path,
    targetPath,
    detection.config.cache
  );

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
    },
    artifacts: {
      patterns: detection.config.cache,
      copied: copiedArtifacts,
    },
    recipe: detection.recipe,
  };
}

/**
 * Format restore result for human output
 */
export function formatRestoreResult(result: RestoreResult): string {
  const lines: string[] = [];

  lines.push(`${color.success("✓")} Restored artifacts to ${color.bold(result.target.path)}`);
  lines.push(`  ${color.muted("Source:")} ${result.source.path}`);

  if (result.recipe) {
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

  return lines.join("\n");
}
