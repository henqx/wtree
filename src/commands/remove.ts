import type { RemoveResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import {
  findWorktreeByBranch,
  removeWorktree,
  getCurrentWorktree,
} from "../git.ts";

/**
 * Remove command - remove a worktree
 */
export async function remove(args: ParsedArgs): Promise<RemoveResult> {
  // Validate arguments
  if (args.positional.length === 0) {
    throw new WtreeError(
      "Missing branch name. Usage: wtree remove <branch>",
      ErrorCode.INVALID_ARGS
    );
  }

  const branch = args.positional[0];

  // Find worktree by branch
  const worktree = await findWorktreeByBranch(branch);
  if (!worktree) {
    throw new WtreeError(
      `Worktree not found for branch: ${branch}`,
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
