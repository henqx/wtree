import type { InitResult, ParsedArgs } from "../types.ts";
import { getWorktreeRoot } from "../git.ts";
import { detectConfig } from "../detect/index.ts";
import { RECIPES } from "../detect/recipes.ts";
import { color } from "../color.ts";
import { writeFile, access } from "fs/promises";
import { join } from "path";

/**
 * Init command - interactively generate .wtree.yaml
 */
export async function init(args: ParsedArgs): Promise<InitResult> {
  const root = await getWorktreeRoot();
  
  // Check if .wtree.yaml already exists
  const configPath = join(root, ".wtree.yaml");
  try {
    await access(configPath);
    return {
      success: true,
      created: false,
      path: configPath,
      message: "Configuration file already exists",
      suggestion: "Use `wtree analyze` to see current configuration",
    };
  } catch {
    // File doesn't exist, proceed
  }

  // Detect current configuration
  const detection = await detectConfig(root);
  
  // Build the config content
  let configContent: string;
  let recipeName: string | undefined;
  let customCache: string[] | undefined;

  if (detection.method === "recipe" && detection.recipe && detection.config) {
    // Single recipe detected - use extends
    recipeName = detection.recipe;
    configContent = generateExtendsConfig(detection.recipe, detection.config);
  } else if (detection.method === "mixed" && detection.recipes && detection.recipes.length > 0 && detection.config) {
    // Multiple recipes - use extends with the first one or custom
    recipeName = detection.recipes[0];
    configContent = generateExtendsConfig(detection.recipes[0], detection.config);
  } else if (detection.config && detection.config.cache.length > 0) {
    // Gitignore-based detection or custom - write explicit config
    customCache = detection.config.cache;
    configContent = generateExplicitConfig(detection.config.cache);
  } else {
    // No detection - create a minimal template
    configContent = generateTemplateConfig();
  }

  // Write the file
  await writeFile(configPath, configContent, "utf-8");

  return {
    success: true,
    created: true,
    path: configPath,
    recipe: recipeName,
    customCache,
    config: detection.config || { cache: [] },
  };
}

/**
 * Generate config that extends a recipe
 */
function generateExtendsConfig(recipeName: string, config: { cache: string[]; post_restore?: string }): string {
  const lines: string[] = [
    "# wtree configuration - extends built-in recipe",
    `extends: ${recipeName}`,
    "",
    "# Custom cache patterns (in addition to recipe defaults)",
    "cache:",
    "  # Add your custom patterns here",
    "  # - build/",
    "  # - dist/",
    "",
  ];

  if (config.post_restore) {
    lines.push(`# Command to run after restoring artifacts`);
    lines.push(`post_restore: "${config.post_restore}"`);
    lines.push("");
  } else {
    lines.push("# Optional: command to run after restoring artifacts");
    lines.push("# post_restore: npm install");
    lines.push("");
  }

  // Add recipe documentation
  const recipe = RECIPES.find(r => r.name === recipeName);
  if (recipe) {
    lines.push("# Recipe defaults:");
    lines.push("# ");
    for (const pattern of recipe.config.cache) {
      lines.push(`#   - ${pattern}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate explicit config with cache patterns
 */
function generateExplicitConfig(cache: string[]): string {
  const lines: string[] = [
    "# wtree configuration",
    "",
    "# Glob patterns for artifacts to cache and hardlink",
    "cache:",
  ];

  for (const pattern of cache) {
    lines.push(`  - ${pattern}`);
  }

  lines.push("");
  lines.push("# Optional: command to run after restoring artifacts");
  lines.push("# post_restore: npm install");
  lines.push("");
  lines.push("# Learn more: https://github.com/henqx/wtree#configuration");

  return lines.join("\n");
}

/**
 * Generate a template config when nothing is detected
 */
function generateTemplateConfig(): string {
  return `# wtree configuration
# 
# wtree automatically caches build artifacts when creating git worktrees,
# making parallel agent workflows much faster.
#
# This template was generated because no specific project type was detected.
# Uncomment and modify the patterns below for your project, or run:
#   wtree analyze
# to see what wtree would detect automatically.

# Glob patterns for artifacts to cache and hardlink
cache:
  # Node.js
  # - node_modules
  # - .turbo
  # - .next
  
  # Python
  # - .venv
  # - __pypackages__
  
  # Rust
  # - target
  
  # Go
  # - vendor
  
  # Generic build directories
  # - build/
  # - dist/
  # - out/

# Optional: command to run after restoring artifacts
# post_restore: npm install

# Or extend a built-in recipe instead:
# extends: pnpm
# 
# Available recipes:
${RECIPES.map(r => `#   - ${r.name} (${r.detect.join(", ")})`).join("\n")}

# Learn more: https://github.com/henqx/wtree#configuration
`;
}

/**
 * Format init result for human output
 */
export function formatInitResult(result: InitResult): string {
  const lines: string[] = [];

  if (result.created) {
    lines.push(color.bold(color.green("✓ Created .wtree.yaml")));
    lines.push("");
    lines.push(`${color.muted("Location:")} ${result.path}`);
    
    if (result.recipe) {
      lines.push(`${color.muted("Extends:")} ${color.cyan(result.recipe)} recipe`);
    } else if (result.customCache && result.customCache.length > 0) {
      lines.push(`${color.muted("Cache patterns:")}`);
      for (const pattern of result.customCache) {
        lines.push(`  ${color.green("•")} ${pattern}`);
      }
    }
    
    lines.push("");
    lines.push(color.muted("Edit this file to customize your cache patterns."));
    lines.push(color.muted("Run `wtree analyze` to verify your configuration."));
  } else {
    lines.push(color.yellow("⚠ Configuration file already exists"));
    lines.push("");
    lines.push(`${color.muted("Location:")} ${result.path}`);
    lines.push("");
    if (result.suggestion) {
      lines.push(result.suggestion);
    }
  }

  return lines.join("\n");
}
