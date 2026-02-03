import { stat } from "fs/promises";
import { join } from "path";
import type { Config, DetectionResult, Recipe } from "../types.ts";
import { RECIPES } from "./recipes.ts";
import { inferFromGitignore } from "./gitignore.ts";
import { parseConfig } from "../config.ts";

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Merge multiple recipe configs into one
 * - Cache patterns are deduplicated
 * - Post-restore is undefined (skipped for mixed stacks)
 */
function mergeRecipeConfigs(recipes: Recipe[]): Config {
  // Collect all cache patterns and deduplicate
  const allCachePatterns = recipes.flatMap((r) => r.config.cache);
  const uniqueCachePatterns = [...new Set(allCachePatterns)];

  // For mixed stacks, we skip post_restore - user should define in .wtree.yaml
  return {
    cache: uniqueCachePatterns,
    post_restore: undefined,
  };
}

/**
 * Detect configuration for a worktree using three-tier detection:
 * 1. Explicit .wtree.yaml configuration
 * 2. Built-in recipe matching
 * 3. .gitignore inference
 */
export async function detectConfig(root: string): Promise<DetectionResult> {
  // Tier 1: Check for explicit .wtree.yaml
  const configPath = join(root, ".wtree.yaml");
  if (await fileExists(configPath)) {
    const config = await parseConfig(configPath);
    return {
      method: "explicit",
      config,
      recipe: config.recipe,
    };
  }

  // Tier 2: Try to match ALL recipes (support mixed stacks)
  const matchedRecipes: Recipe[] = [];
  const allDetectedFiles: string[] = [];

  for (const recipe of RECIPES) {
    const detectedFiles: string[] = [];

    for (const detectFile of recipe.detect) {
      const filePath = join(root, detectFile);
      if (await fileExists(filePath)) {
        detectedFiles.push(detectFile);
      }
    }

    if (detectedFiles.length > 0) {
      matchedRecipes.push(recipe);
      allDetectedFiles.push(...detectedFiles);
    }
  }

  if (matchedRecipes.length === 1) {
    // Single recipe - standard behavior
    const recipe = matchedRecipes[0];
    return {
      method: "recipe",
      config: { ...recipe.config, recipe: recipe.name },
      recipe: recipe.name,
      detectedFiles: allDetectedFiles,
    };
  } else if (matchedRecipes.length > 1) {
    // Mixed stack - merge recipes
    const mergedConfig = mergeRecipeConfigs(matchedRecipes);
    return {
      method: "mixed",
      config: mergedConfig,
      recipe: matchedRecipes[0].name,
      recipes: matchedRecipes.map((r) => r.name),
      detectedFiles: allDetectedFiles,
    };
  }

  // Tier 3: Infer from .gitignore
  const gitignoreConfig = await inferFromGitignore(root);
  if (gitignoreConfig) {
    return {
      method: "gitignore",
      config: gitignoreConfig,
    };
  }

  // No detection
  return {
    method: "none",
    config: null,
  };
}

/**
 * Get configuration from a worktree, with optional override
 */
export async function getConfig(
  root: string,
  explicitRecipe?: string
): Promise<Config | null> {
  // If an explicit recipe is specified, use it
  if (explicitRecipe) {
    const recipe = RECIPES.find((r) => r.name === explicitRecipe);
    if (recipe) {
      return { ...recipe.config, recipe: recipe.name };
    }
  }

  // Otherwise, detect
  const result = await detectConfig(root);
  return result.config;
}
