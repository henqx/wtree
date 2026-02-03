import type { CleanResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import { color } from "../color.ts";
import { getWorktreeRoot, listWorktrees, pruneWorktrees } from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { readdir, stat, rmdir, unlink } from "fs/promises";
import { join } from "path";

interface CleanupItem {
  type: "file" | "directory" | "worktree";
  path: string;
  size?: number;
  reason: string;
}

/**
 * Clean command - remove orphaned cache artifacts and stale references
 */
export async function clean(args: ParsedArgs): Promise<CleanResult> {
  const dryRun = args.flags.dryRun ?? false;
  const force = args.flags.force ?? false;

  const root = await getWorktreeRoot();
  const worktrees = await listWorktrees();
  const nonBareWorktrees = worktrees.filter(w => !w.bare);

  const itemsToClean: CleanupItem[] = [];

  // Check each worktree for orphaned artifacts
  for (const worktree of nonBareWorktrees) {
    const detection = await detectConfig(worktree.path);
    if (!detection.config) continue;

    for (const pattern of detection.config.cache) {
      // Skip glob patterns for safety
      if (pattern.includes("*")) continue;

      const artifactPath = join(worktree.path, pattern);
      
      try {
        const s = await stat(artifactPath);
        if (s.isDirectory()) {
          // Check if directory is empty or contains only other worktrees
          const contents = await readdir(artifactPath);
          const isOrphaned = contents.length === 0 || 
            contents.every(item => {
              // Check if item is a worktree
              const itemPath = join(artifactPath, item);
              return nonBareWorktrees.some(w => w.path === itemPath);
            });

          if (isOrphaned) {
            itemsToClean.push({
              type: "directory",
              path: artifactPath,
              reason: "Empty or contains only worktrees",
            });
          }
        }
      } catch {
        // Path doesn't exist, skip
      }
    }
  }

  // Prune stale worktree references
  let prunedWorktrees = 0;
  try {
    // Get list before prune
    const before = await listWorktrees();
    await pruneWorktrees();
    const after = await listWorktrees();
    prunedWorktrees = before.length - after.length;
  } catch {
    // Prune failed, continue
  }

  // Calculate total size
  let totalSize = 0;
  for (const item of itemsToClean) {
    if (item.type === "directory") {
      try {
        totalSize += await calculateDirSize(item.path);
      } catch {
        // Ignore errors
      }
    }
  }

  // Execute cleanup if not dry run
  let cleanedCount = 0;
  if (!dryRun && itemsToClean.length > 0) {
    if (!force) {
      // Would normally prompt here, but for now just proceed
      // In a real implementation, we'd use a prompt library
    }

    for (const item of itemsToClean) {
      try {
        if (item.type === "directory") {
          await rmdir(item.path, { recursive: true });
        } else if (item.type === "file") {
          await unlink(item.path);
        }
        cleanedCount++;
      } catch {
        // Ignore individual failures
      }
    }
  }

  return {
    success: true,
    dryRun,
    items: itemsToClean.map(item => ({
      type: item.type,
      path: item.path,
      reason: item.reason,
    })),
    summary: {
      total: itemsToClean.length,
      cleaned: dryRun ? 0 : cleanedCount,
      pruned: prunedWorktrees,
      size: totalSize,
    },
  };
}

/**
 * Calculate directory size recursively
 */
async function calculateDirSize(dirPath: string): Promise<number> {
  let size = 0;
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await calculateDirSize(fullPath);
      } else if (entry.isFile()) {
        const s = await stat(fullPath);
        size += s.size;
      }
    }
  } catch {
    // Ignore errors
  }
  
  return size;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format clean result for human output
 */
export function formatCleanResult(result: CleanResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push(color.bold(color.yellow("⚠ Dry run - no changes made")));
    lines.push("");
  }

  if (result.items.length === 0 && result.summary.pruned === 0) {
    lines.push(color.green("✓ Nothing to clean"));
    return lines.join("\n");
  }

  lines.push(color.bold("Cleanup Summary"));
  lines.push("");

  if (result.items.length > 0) {
    lines.push(`${color.muted("Items found:")} ${result.items.length}`);
    if (result.summary.size > 0) {
      lines.push(`${color.muted("Total size:")} ${formatBytes(result.summary.size)}`);
    }
    lines.push("");

    for (const item of result.items.slice(0, 10)) {
      const icon = item.type === "directory" ? "📁" : "📄";
      lines.push(`  ${icon} ${color.dim(item.path.replace(process.cwd(), "."))}`);
      lines.push(`     ${color.muted(item.reason)}`);
    }

    if (result.items.length > 10) {
      lines.push(`  ${color.muted(`... and ${result.items.length - 10} more`)}`);
    }

    lines.push("");
  }

  if (result.summary.pruned > 0) {
    lines.push(`${color.green("✓")} Pruned ${result.summary.pruned} stale worktree reference(s)`);
  }

  if (!result.dryRun && result.summary.cleaned > 0) {
    lines.push(`${color.green("✓")} Cleaned ${result.summary.cleaned} item(s)`);
  } else if (result.dryRun && result.items.length > 0) {
    lines.push(color.cyan("→ Run without --dry-run to clean these items"));
  }

  return lines.join("\n");
}
