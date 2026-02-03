import { describe, test, expect } from "bun:test";
import { RECIPES, getRecipeByName } from "./recipes";

describe("recipes", () => {
  describe("RECIPES", () => {
    test("has all expected recipes", () => {
      const names = RECIPES.map((r) => r.name);
      expect(names).toContain("pnpm");
      expect(names).toContain("pnpm-workspaces");
      expect(names).toContain("npm");
      expect(names).toContain("yarn");
      expect(names).toContain("bun");
      expect(names).toContain("turborepo");
      expect(names).toContain("nx");
      expect(names).toContain("rush");
      expect(names).toContain("lerna");
      expect(names).toContain("python-uv");
      expect(names).toContain("poetry");
      expect(names).toContain("pdm");
      expect(names).toContain("python-pip");
      expect(names).toContain("rust");
      expect(names).toContain("go");
    });

    test("each recipe has required fields", () => {
      for (const recipe of RECIPES) {
        expect(recipe.name).toBeTruthy();
        expect(recipe.detect).toBeInstanceOf(Array);
        expect(recipe.detect.length).toBeGreaterThan(0);
        expect(recipe.config.cache).toBeInstanceOf(Array);
        expect(recipe.config.cache.length).toBeGreaterThan(0);
      }
    });

    test("turborepo is checked before pnpm/npm/yarn", () => {
      const turborepoIndex = RECIPES.findIndex((r) => r.name === "turborepo");
      const pnpmIndex = RECIPES.findIndex((r) => r.name === "pnpm");
      const npmIndex = RECIPES.findIndex((r) => r.name === "npm");
      const yarnIndex = RECIPES.findIndex((r) => r.name === "yarn");

      expect(turborepoIndex).toBeLessThan(pnpmIndex);
      expect(turborepoIndex).toBeLessThan(npmIndex);
      expect(turborepoIndex).toBeLessThan(yarnIndex);
    });

    test("nx is checked before pnpm/npm/yarn", () => {
      const nxIndex = RECIPES.findIndex((r) => r.name === "nx");
      const pnpmIndex = RECIPES.findIndex((r) => r.name === "pnpm");

      expect(nxIndex).toBeLessThan(pnpmIndex);
    });

    test("rush is checked before pnpm/npm/yarn", () => {
      const rushIndex = RECIPES.findIndex((r) => r.name === "rush");
      const pnpmIndex = RECIPES.findIndex((r) => r.name === "pnpm");

      expect(rushIndex).toBeLessThan(pnpmIndex);
    });

    test("pnpm-workspaces is checked before plain pnpm", () => {
      const workspacesIndex = RECIPES.findIndex((r) => r.name === "pnpm-workspaces");
      const pnpmIndex = RECIPES.findIndex((r) => r.name === "pnpm");

      expect(workspacesIndex).toBeLessThan(pnpmIndex);
    });

    test("lerna is checked before pnpm/npm/yarn", () => {
      const lernaIndex = RECIPES.findIndex((r) => r.name === "lerna");
      const pnpmIndex = RECIPES.findIndex((r) => r.name === "pnpm");

      expect(lernaIndex).toBeLessThan(pnpmIndex);
    });
  });

  describe("getRecipeByName", () => {
    test("returns recipe by name", () => {
      const pnpm = getRecipeByName("pnpm");
      expect(pnpm).toBeDefined();
      expect(pnpm?.name).toBe("pnpm");
      expect(pnpm?.detect).toContain("pnpm-lock.yaml");
    });

    test("returns undefined for unknown recipe", () => {
      const unknown = getRecipeByName("unknown-recipe");
      expect(unknown).toBeUndefined();
    });
  });

  describe("recipe detection files", () => {
    test("pnpm detects pnpm-lock.yaml", () => {
      const pnpm = getRecipeByName("pnpm");
      expect(pnpm?.detect).toContain("pnpm-lock.yaml");
    });

    test("npm detects package-lock.json", () => {
      const npm = getRecipeByName("npm");
      expect(npm?.detect).toContain("package-lock.json");
    });

    test("yarn detects yarn.lock", () => {
      const yarn = getRecipeByName("yarn");
      expect(yarn?.detect).toContain("yarn.lock");
    });

    test("bun detects both bun.lock and bun.lockb", () => {
      const bun = getRecipeByName("bun");
      expect(bun?.detect).toContain("bun.lock");
      expect(bun?.detect).toContain("bun.lockb");
    });

    test("turborepo detects turbo.json", () => {
      const turbo = getRecipeByName("turborepo");
      expect(turbo?.detect).toContain("turbo.json");
    });

    test("rust detects Cargo.lock", () => {
      const rust = getRecipeByName("rust");
      expect(rust?.detect).toContain("Cargo.lock");
    });

    test("go detects go.sum", () => {
      const go = getRecipeByName("go");
      expect(go?.detect).toContain("go.sum");
    });

    test("rush detects rush.json", () => {
      const rush = getRecipeByName("rush");
      expect(rush?.detect).toContain("rush.json");
    });

    test("pnpm-workspaces detects pnpm-workspace.yaml", () => {
      const pnpmWs = getRecipeByName("pnpm-workspaces");
      expect(pnpmWs?.detect).toContain("pnpm-workspace.yaml");
    });

    test("lerna detects lerna.json", () => {
      const lerna = getRecipeByName("lerna");
      expect(lerna?.detect).toContain("lerna.json");
    });

    test("poetry detects poetry.lock", () => {
      const poetry = getRecipeByName("poetry");
      expect(poetry?.detect).toContain("poetry.lock");
    });

    test("pdm detects pdm.lock", () => {
      const pdm = getRecipeByName("pdm");
      expect(pdm?.detect).toContain("pdm.lock");
    });
  });

  describe("recipe cache patterns", () => {
    test("node recipes cache node_modules", () => {
      for (const name of ["pnpm", "npm", "yarn", "bun"]) {
        const recipe = getRecipeByName(name);
        expect(recipe?.config.cache).toContain("node_modules");
      }
    });

    test("turborepo caches .turbo and nested node_modules", () => {
      const turbo = getRecipeByName("turborepo");
      expect(turbo?.config.cache).toContain("node_modules");
      expect(turbo?.config.cache).toContain(".turbo");
      expect(turbo?.config.cache).toContain("**/node_modules");
    });

    test("python recipes cache .venv", () => {
      for (const name of ["python-uv", "python-pip", "poetry"]) {
        const recipe = getRecipeByName(name);
        expect(recipe?.config.cache).toContain(".venv");
      }
    });

    test("pdm caches .venv and __pypackages__", () => {
      const pdm = getRecipeByName("pdm");
      expect(pdm?.config.cache).toContain(".venv");
      expect(pdm?.config.cache).toContain("__pypackages__");
    });

    test("rust caches target", () => {
      const rust = getRecipeByName("rust");
      expect(rust?.config.cache).toContain("target");
    });

    test("go caches vendor", () => {
      const go = getRecipeByName("go");
      expect(go?.config.cache).toContain("vendor");
    });

    test("rush caches common/temp/node_modules, .rush/temp, and build-cache", () => {
      const rush = getRecipeByName("rush");
      expect(rush?.config.cache).toContain("common/temp/node_modules");
      expect(rush?.config.cache).toContain(".rush/temp");
      expect(rush?.config.cache).toContain("common/temp/build-cache");
    });

    test("pnpm-workspaces caches node_modules and nested node_modules", () => {
      const pnpmWs = getRecipeByName("pnpm-workspaces");
      expect(pnpmWs?.config.cache).toContain("node_modules");
      expect(pnpmWs?.config.cache).toContain("**/node_modules");
    });

    test("lerna caches node_modules and nested node_modules", () => {
      const lerna = getRecipeByName("lerna");
      expect(lerna?.config.cache).toContain("node_modules");
      expect(lerna?.config.cache).toContain("**/node_modules");
    });
  });
});
