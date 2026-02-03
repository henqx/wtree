import type { AnalyzeResult, ParsedArgs } from "../types.ts";
import { getWorktreeRoot } from "../git.ts";
import { detectConfig } from "../detect/index.ts";

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

  lines.push("Detection Results");
  lines.push("=================");
  lines.push("");

  switch (result.detection.method) {
    case "explicit":
      lines.push("Method: Explicit configuration (.wtree.yaml)");
      break;
    case "recipe":
      lines.push(`Method: Built-in recipe (${result.detection.recipe})`);
      break;
    case "gitignore":
      lines.push("Method: Inferred from .gitignore");
      break;
    case "none":
      lines.push("Method: No configuration detected");
      break;
  }

  if (result.files?.detected) {
    lines.push(`Detected files: ${result.files.detected.join(", ")}`);
  }

  lines.push("");

  if (result.config) {
    lines.push("Configuration");
    lines.push("-------------");
    lines.push(`Cache patterns: ${result.config.cache.join(", ")}`);
    if (result.config.post_restore) {
      lines.push(`Post-restore: ${result.config.post_restore}`);
    }
  } else {
    lines.push("No artifacts would be cached.");
    lines.push("");
    lines.push("To configure caching, create a .wtree.yaml file or use a");
    lines.push("supported project structure (pnpm, npm, yarn, rust, etc.).");
  }

  return lines.join("\n");
}
