import type { AnalyzeResult, ParsedArgs } from "../types.ts";
import { getWorktreeRoot } from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { color } from "../color.ts";

/**
 * Analyze command - show detected configuration
 */
export async function analyze(args: ParsedArgs): Promise<AnalyzeResult> {
  const root = await getWorktreeRoot();
  const detection = await detectConfig(root);

  return {
    success: true,
    detection: {
      method: detection.method,
      recipe: detection.recipe,
      recipes: detection.recipes,
    },
    config: detection.config,
    files: detection.detectedFiles
      ? { detected: detection.detectedFiles }
      : undefined,
  };
}

/**
 * Format analyze result for human output
 */
export function formatAnalyzeResult(result: AnalyzeResult): string {
  const lines: string[] = [];

  lines.push(color.bold("Detection Results"));
  lines.push("");

  switch (result.detection.method) {
    case "explicit":
      lines.push(`${color.muted("Method:")} ${color.cyan("Explicit")} ${color.muted("(.wtree.yaml)")}`);
      break;
    case "recipe":
      lines.push(`${color.muted("Method:")} ${color.cyan("Recipe")} ${color.muted(`(${result.detection.recipe})`)}`);
      break;
    case "mixed":
      lines.push(`${color.muted("Method:")} ${color.cyan("Mixed")} ${color.muted(`(${result.detection.recipes?.join(", ")})`)}`);
      break;
    case "gitignore":
      lines.push(`${color.muted("Method:")} ${color.cyan("Inferred")} ${color.muted("(from .gitignore)")}`);
      break;
    case "none":
      lines.push(`${color.muted("Method:")} ${color.yellow("None detected")}`);
      break;
  }

  if (result.files?.detected) {
    lines.push(`${color.muted("Detected:")} ${result.files.detected.join(", ")}`);
  }

  lines.push("");

  if (result.config) {
    lines.push(color.bold("Cache Patterns"));
    for (const pattern of result.config.cache) {
      lines.push(`  ${color.green("•")} ${pattern}`);
    }
    if (result.config.post_restore) {
      lines.push("");
      lines.push(`${color.muted("Post-restore:")} ${result.config.post_restore}`);
    }
  } else {
    lines.push(color.yellow("No artifacts would be cached."));
    lines.push("");
    lines.push(color.muted("To configure caching, create a .wtree.yaml file or use a"));
    lines.push(color.muted("supported project structure (pnpm, npm, yarn, rust, etc.)."));
  }

  return lines.join("\n");
}
