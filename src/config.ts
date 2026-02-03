import { readFile } from "fs/promises";
import yaml from "js-yaml";
import type { Config } from "./types.ts";
import { WtreeError, ErrorCode } from "./types.ts";
import { getRecipeByName } from "./detect/recipes.ts";

/**
 * Raw config file structure
 */
interface RawConfig {
  extends?: string;
  cache?: string[];
  post_restore?: string;
}

/**
 * Parse and validate a .wtree.yaml configuration file
 */
export async function parseConfig(path: string): Promise<Config> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    throw new WtreeError(
      `Failed to read config file: ${path}`,
      ErrorCode.CONFIG_ERROR
    );
  }

  let raw: RawConfig;
  try {
    raw = yaml.load(content) as RawConfig;
  } catch (error) {
    throw new WtreeError(
      `Failed to parse config file: ${path}`,
      ErrorCode.CONFIG_ERROR
    );
  }

  if (!raw || typeof raw !== "object") {
    throw new WtreeError(
      `Invalid config file: ${path} (expected object)`,
      ErrorCode.CONFIG_ERROR
    );
  }

  // Start with base config if extending a recipe
  let config: Config = { cache: [] };

  if (raw.extends) {
    const recipe = getRecipeByName(raw.extends);
    if (!recipe) {
      throw new WtreeError(
        `Unknown recipe in extends: ${raw.extends}`,
        ErrorCode.CONFIG_ERROR
      );
    }
    config = { ...recipe.config, recipe: recipe.name };
  }

  // Merge custom cache patterns
  if (raw.cache) {
    if (!Array.isArray(raw.cache)) {
      throw new WtreeError(
        `Invalid cache in config: expected array`,
        ErrorCode.CONFIG_ERROR
      );
    }

    // Combine with base patterns, deduplicate
    const allPatterns = new Set([...config.cache, ...raw.cache]);
    config.cache = Array.from(allPatterns);
  }

  // Override post_restore if specified
  if (raw.post_restore !== undefined) {
    if (typeof raw.post_restore !== "string") {
      throw new WtreeError(
        `Invalid post_restore in config: expected string`,
        ErrorCode.CONFIG_ERROR
      );
    }
    config.post_restore = raw.post_restore;
  }

  return config;
}
