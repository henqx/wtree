import { readFile } from "fs/promises";
import { join } from "path";
import type { Config } from "../types.ts";

/**
 * Mapping from .gitignore patterns to cache hints
 */
const GITIGNORE_HINTS: Record<string, string[]> = {
  // Node.js
  node_modules: ["node_modules"],
  "node_modules/": ["node_modules"],

  // Python
  ".venv": [".venv"],
  ".venv/": [".venv"],
  venv: ["venv"],
  "venv/": ["venv"],
  __pycache__: [], // Don't cache these, they're small
  ".pytest_cache": [], // Don't cache

  // Rust
  target: ["target"],
  "target/": ["target"],

  // Go
  vendor: ["vendor"],
  "vendor/": ["vendor"],

  // Build outputs
  dist: ["dist"],
  "dist/": ["dist"],
  build: ["build"],
  "build/": ["build"],
  out: ["out"],
  "out/": ["out"],

  // Cache directories
  ".turbo": [".turbo"],
  ".nx": [".nx/cache"],
  ".next": [".next"],
  ".nuxt": [".nuxt"],

  // Yarn
  ".yarn/cache": [".yarn/cache"],
  ".pnp.*": [], // PnP files are small
};

/**
 * Parse a .gitignore file and extract relevant patterns
 */
function parseGitignore(content: string): string[] {
  const patterns: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Skip negation patterns
    if (trimmed.startsWith("!")) {
      continue;
    }

    // Normalize the pattern
    const normalized = trimmed.replace(/\/$/, ""); // Remove trailing slash

    patterns.push(normalized);
  }

  return patterns;
}

/**
 * Infer cache configuration from .gitignore
 */
export async function inferFromGitignore(root: string): Promise<Config | null> {
  const gitignorePath = join(root, ".gitignore");

  let content: string;
  try {
    content = await readFile(gitignorePath, "utf-8");
  } catch {
    return null;
  }

  const patterns = parseGitignore(content);
  const cachePatterns: Set<string> = new Set();

  for (const pattern of patterns) {
    // Check if this pattern maps to a known cache hint
    const hint = GITIGNORE_HINTS[pattern];
    if (hint) {
      for (const p of hint) {
        cachePatterns.add(p);
      }
    }
  }

  if (cachePatterns.size === 0) {
    return null;
  }

  return {
    cache: Array.from(cachePatterns),
  };
}
