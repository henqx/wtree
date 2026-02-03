import { resolve } from "path";
import type { RemoveResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import {
  findWorktreeByPath,
  findWorktreeByBranch,
  removeWorktree,
  getCurrentWorktree,
} from "../git.ts";

/**
 * Remove command - remove a worktree
 * Accepts either a path or branch name (tries path first, then branch)
 */
export async function remove(args: ParsedArgs): Promise<RemoveResult> {
  if (args.positional.length === 0) {
    throw new WtreeError(
      "Missing path. Usage: wtree remove <path>",
      ErrorCode.INVALID_ARGS
    );
  }

  const target = args.positional[0];

  // Try to find by path first, then by branch
  let worktree = await findWorktreeByPath(target);
  if (!worktree) {
    worktree = await findWorktreeByBranch(target);
  }

  if (!worktree) {
    throw new WtreeError(
      `Worktree not found: ${target}`,
      ErrorCode.WORKTREE_NOT_FOUND
    );
  }

  // Don't allow removing the current worktree
  const current = await getCurrentWorktree();
  if (worktree.path === current.path) {
    throw new WtreeError(
      "Cannot remove the current worktree. Switch to a different worktree first.",
      ErrorCode.GIT_ERROR
    );
  }

  // Remove the worktree
  await removeWorktree(worktree.path, { force: args.flags.force });

  return {
    success: true,
    removed: {
      path: worktree.path,
      branch: worktree.branch,
    },
  };
}

/**
 * Format remove result for human output
 */
export function formatRemoveResult(result: RemoveResult): string {
  return `Removed worktree at ${result.removed.path} (branch: ${result.removed.branch})`;
}
