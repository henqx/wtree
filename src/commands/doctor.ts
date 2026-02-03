import type { DoctorResult, ParsedArgs } from "../types.ts";
import { WtreeError, ErrorCode } from "../types.ts";
import { color } from "../color.ts";
import { parseConfig } from "../config.ts";
import { detectConfig } from "../detect/index.ts";
import { getWorktreeRoot, listWorktrees, gitCommand } from "../git.ts";
import { access, readFile } from "fs/promises";
import { join } from "path";

interface Check {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  suggestion?: string;
}

/**
 * Doctor command - diagnose common wtree issues
 */
export async function doctor(args: ParsedArgs): Promise<DoctorResult> {
  const checks: Check[] = [];
  let hasErrors = false;
  let hasWarnings = false;

  // Check 1: Git repository
  try {
    const root = await getWorktreeRoot();
    checks.push({
      name: "Git repository",
      status: "ok",
      message: `Found git repository at ${root}`,
    });
  } catch {
    checks.push({
      name: "Git repository",
      status: "error",
      message: "Not in a git repository",
      suggestion: "Run wtree from within a git repository",
    });
    hasErrors = true;
  }

  if (!hasErrors) {
    const root = await getWorktreeRoot();

    // Check 2: Git worktree support
    try {
      await gitCommand(["worktree", "list"], root);
      checks.push({
        name: "Git worktree support",
        status: "ok",
        message: "Git worktree command available",
      });
    } catch {
      checks.push({
        name: "Git worktree support",
        status: "error",
        message: "Git worktree command failed",
        suggestion: "Update git to version 2.5+ which supports worktrees",
      });
      hasErrors = true;
    }

    // Check 3: .wtree.yaml validity
    const configPath = join(root, ".wtree.yaml");
    try {
      await access(configPath);
      try {
        await parseConfig(configPath);
        checks.push({
          name: "Configuration file",
          status: "ok",
          message: ".wtree.yaml is valid",
        });
      } catch (error) {
        checks.push({
          name: "Configuration file",
          status: "error",
          message: `.wtree.yaml has errors: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: "Fix the YAML syntax or configuration values",
        });
        hasErrors = true;
      }
    } catch {
      // No config file - check if detection works
      const detection = await detectConfig(root);
      if (detection.method === "none") {
        checks.push({
          name: "Configuration file",
          status: "warning",
          message: "No .wtree.yaml found and no project type detected",
          suggestion: "Run `wtree init` to generate a configuration file",
        });
        hasWarnings = true;
      } else {
        checks.push({
          name: "Configuration file",
          status: "ok",
          message: `No .wtree.yaml found, but auto-detect works (${detection.method})`,
          suggestion: "Run `wtree init` to create explicit configuration",
        });
      }
    }

    // Check 4: Worktree write permissions
    try {
      const worktrees = await listWorktrees();
      const currentWorktree = worktrees.find((w: import("../types.ts").Worktree) => w.path === root);
      if (currentWorktree) {
        // Try to create a test file
        const testFile = join(currentWorktree.path, ".wtree_test_" + Date.now());
        try {
          await Bun.write(testFile, "test");
          await Bun.file(testFile).delete();
          checks.push({
            name: "Worktree permissions",
            status: "ok",
            message: "Can write to current worktree",
          });
        } catch {
          checks.push({
            name: "Worktree permissions",
            status: "error",
            message: "Cannot write to current worktree directory",
            suggestion: "Check directory permissions or run from a writable location",
          });
          hasErrors = true;
        }
      }
    } catch {
      checks.push({
        name: "Worktree permissions",
        status: "warning",
        message: "Could not check worktree permissions",
      });
      hasWarnings = true;
    }

    // Check 5: Nested worktree .gitignore warning
    try {
      const gitignorePath = join(root, ".gitignore");
      let gitignoreContent = "";
      try {
        gitignoreContent = await readFile(gitignorePath, "utf-8");
      } catch {
        // No .gitignore
      }

      const worktrees = await listWorktrees();
      const nestedWorktrees = worktrees.filter((w: import("../types.ts").Worktree) => {
        const relativePath = w.path.replace(root, "").replace(/^\//, "");
        return relativePath.includes("/") && !relativePath.startsWith("..") && !w.bare;
      });

      if (nestedWorktrees.length > 0) {
        const hasWorktreeIgnore = gitignoreContent.includes(".worktrees/") || 
                                   gitignoreContent.includes("worktrees/");
        if (!hasWorktreeIgnore) {
          checks.push({
            name: "Nested worktrees",
            status: "warning",
            message: `${nestedWorktrees.length} nested worktree(s) found without .gitignore entry`,
            suggestion: "Add '.worktrees/' to .gitignore to avoid nested repository issues",
          });
          hasWarnings = true;
        } else {
          checks.push({
            name: "Nested worktrees",
            status: "ok",
            message: `${nestedWorktrees.length} nested worktree(s) properly ignored`,
          });
        }
      } else {
        checks.push({
          name: "Nested worktrees",
          status: "ok",
          message: "No nested worktrees found",
        });
      }
    } catch {
      checks.push({
        name: "Nested worktrees",
        status: "warning",
        message: "Could not check for nested worktrees",
      });
      hasWarnings = true;
    }

    // Check 6: Platform compatibility
    const platform = process.platform;
    if (platform === "darwin" || platform === "linux") {
      checks.push({
        name: "Platform support",
        status: "ok",
        message: `${platform} is fully supported`,
      });
    } else if (platform === "win32") {
      checks.push({
        name: "Platform support",
        status: "warning",
        message: "Windows support is experimental",
        suggestion: "Use WSL for better compatibility",
      });
      hasWarnings = true;
    } else {
      checks.push({
        name: "Platform support",
        status: "warning",
        message: `Platform '${platform}' compatibility unknown`,
      });
      hasWarnings = true;
    }

    // Check 7: Cache pattern validity
    try {
      const detection = await detectConfig(root);
      if (detection.config && detection.config.cache.length > 0) {
        checks.push({
          name: "Cache patterns",
          status: "ok",
          message: `${detection.config.cache.length} pattern(s) configured`,
        });
      } else {
        checks.push({
          name: "Cache patterns",
          status: "warning",
          message: "No cache patterns configured",
          suggestion: "Add cache patterns to .wtree.yaml or use a recipe",
        });
        hasWarnings = true;
      }
    } catch {
      checks.push({
        name: "Cache patterns",
        status: "warning",
        message: "Could not check cache patterns",
      });
      hasWarnings = true;
    }
  }

  return {
    success: true,
    healthy: !hasErrors,
    checks,
    summary: {
      total: checks.length,
      ok: checks.filter(c => c.status === "ok").length,
      warnings: checks.filter(c => c.status === "warning").length,
      errors: checks.filter(c => c.status === "error").length,
    },
  };
}

/**
 * Format doctor result for human output
 */
export function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];

  if (result.healthy) {
    if (result.summary.warnings === 0) {
      lines.push(color.bold(color.green("✓ All checks passed")));
    } else {
      lines.push(color.bold(color.yellow("⚠ Healthy with warnings")));
    }
  } else {
    lines.push(color.bold(color.red("✗ Issues found")));
  }

  lines.push("");

  // Summary line
  lines.push(`${color.green("✓")} ${result.summary.ok} passed  ${color.yellow("⚠")} ${result.summary.warnings} warnings  ${color.red("✗")} ${result.summary.errors} errors`);
  lines.push("");

  // Individual checks
  for (const check of result.checks) {
    const icon = check.status === "ok" ? color.green("✓") : 
                 check.status === "warning" ? color.yellow("⚠") : 
                 color.red("✗");
    
    lines.push(`${icon} ${color.bold(check.name)}`);
    lines.push(`  ${check.message}`);
    
    if (check.suggestion) {
      lines.push(`  ${color.cyan("→")} ${check.suggestion}`);
    }
    
    lines.push("");
  }

  return lines.join("\n");
}
