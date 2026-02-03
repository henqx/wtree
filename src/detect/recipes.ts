import type { Recipe } from "../types.ts";

/**
 * Built-in recipes for common project types
 */
export const RECIPES: Recipe[] = [
  // Turborepo - check before pnpm/npm/yarn since it uses those
  {
    name: "turborepo",
    detect: ["turbo.json"],
    config: {
      cache: ["node_modules", ".turbo", "**/node_modules"],
      post_restore: undefined,
    },
  },

  // Nx monorepo
  {
    name: "nx",
    detect: ["nx.json"],
    config: {
      cache: ["node_modules", ".nx/cache", "**/node_modules"],
      post_restore: undefined,
    },
  },

  // Rush.js monorepo
  {
    name: "rush",
    detect: ["rush.json"],
    config: {
      cache: ["common/temp/node_modules", ".rush/temp"],
      post_restore: undefined,
    },
  },

  // pnpm workspaces (check before plain pnpm)
  {
    name: "pnpm-workspaces",
    detect: ["pnpm-workspace.yaml"],
    config: {
      cache: ["node_modules", "**/node_modules"],
      post_restore: undefined,
    },
  },

  // pnpm
  {
    name: "pnpm",
    detect: ["pnpm-lock.yaml"],
    config: {
      cache: ["node_modules"],
      post_restore: undefined,
    },
  },

  // npm
  {
    name: "npm",
    detect: ["package-lock.json"],
    config: {
      cache: ["node_modules"],
      post_restore: undefined,
    },
  },

  // Yarn (classic and berry)
  {
    name: "yarn",
    detect: ["yarn.lock"],
    config: {
      cache: ["node_modules", ".yarn/cache"],
      post_restore: undefined,
    },
  },

  // Bun
  {
    name: "bun",
    detect: ["bun.lock", "bun.lockb"],
    config: {
      cache: ["node_modules"],
      post_restore: undefined,
    },
  },

  // Python with uv
  {
    name: "python-uv",
    detect: ["uv.lock"],
    config: {
      cache: [".venv"],
      post_restore: undefined,
    },
  },

  // Python with pip (requirements.txt + existing .venv)
  {
    name: "python-pip",
    detect: ["requirements.txt"],
    config: {
      cache: [".venv"],
      post_restore: undefined,
    },
  },

  // Rust with Cargo
  {
    name: "rust",
    detect: ["Cargo.lock"],
    config: {
      cache: ["target"],
      post_restore: undefined,
    },
  },

  // Go with modules
  {
    name: "go",
    detect: ["go.sum"],
    config: {
      cache: ["vendor"],
      post_restore: undefined,
    },
  },
];

/**
 * Get a recipe by name
 */
export function getRecipeByName(name: string): Recipe | undefined {
  return RECIPES.find((r) => r.name === name);
}
