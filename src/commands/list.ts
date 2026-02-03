import { stat } from "fs/promises";
import { join } from "path";
import type { ListResult, ParsedArgs } from "../types.ts";
import { listWorktrees, getCurrentWorktree } from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { color } from "../color.ts";

interface WorktreeInfo {
  path: string;
  branch: string;
  current: boolean;
  recipe?: string;
  artifacts: {
    pattern: string;
    exists: boolean;
  }[];
}

/**
 * Check if a path exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List command - show all worktrees with cache status
 */
export async function list(args: ParsedArgs): Promise<ListResult> {
  const worktrees = await listWorktrees();
  const current = await getCurrentWorktree();

  const worktreeInfos: WorktreeInfo[] = [];

  for (const wt of worktrees) {
    // Skip bare repos
    if (wt.bare) continue;

    const detection = await detectConfig(wt.path);
    const artifacts: { pattern: string; exists: boolean }[] = [];

    if (detection.config) {
      for (const pattern of detection.config.cache) {
        // For simple patterns (not globs), check if they exist
        if (!pattern.includes("*")) {
          const artifactPath = join(wt.path, pattern);
          artifacts.push({
            pattern,
            exists: await exists(artifactPath),
          });
        } else {
          // For glob patterns, just note them without checking
          artifacts.push({
            pattern,
            exists: false, // Can't easily check globs
          });
        }
      }
    }

    worktreeInfos.push({
      path: wt.path,
      branch: wt.branch,
      current: wt.path === current.path,
      recipe: detection.recipe,
      artifacts,
    });
  }

  return {
    success: true,
    worktrees: worktreeInfos,
  };
}

/**
 * Format list result for human output
 */
export function formatListResult(result: ListResult): string {
  const lines: string[] = [];

  if (result.worktrees.length === 0) {
    return color.muted("No worktrees found.");
  }

  for (const wt of result.worktrees) {
    const marker = wt.current ? color.green("* ") : "  ";
    const branch = wt.branch || "(detached)";
    const branchDisplay = wt.current ? color.bold(color.green(branch)) : branch;
    lines.push(`${marker}${branchDisplay}`);
    lines.push(`    ${color.muted(wt.path)}`);

    if (wt.recipe) {
      lines.push(`    ${color.muted("Recipe:")} ${wt.recipe}`);
    }

    if (wt.artifacts.length > 0) {
      const cached = wt.artifacts.filter((a) => a.exists);
      const missing = wt.artifacts.filter((a) => !a.exists && !a.pattern.includes("*"));

      if (cached.length > 0) {
        lines.push(`    ${color.green("Cached:")} ${cached.map((a) => a.pattern).join(", ")}`);
      }
      if (missing.length > 0) {
        lines.push(`    ${color.yellow("Missing:")} ${missing.map((a) => a.pattern).join(", ")}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
