import { describe, test, expect } from "bun:test";
import { RECIPES, getRecipeByName } from "./recipes";

describe("recipes", () => {
  describe("RECIPES", () => {
    test("has all expected recipes", () => {
      const names = RECIPES.map((r) => r.name);
      expect(names).toContain("pnpm");
      expect(names).toContain("npm");
      expect(names).toContain("yarn");
      expect(names).toContain("bun");
      expect(names).toContain("turborepo");
      expect(names).toContain("nx");
      expect(names).toContain("python-uv");
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
      for (const name of ["python-uv", "python-pip"]) {
        const recipe = getRecipeByName(name);
        expect(recipe?.config.cache).toContain(".venv");
      }
    });

    test("rust caches target", () => {
      const rust = getRecipeByName("rust");
      expect(rust?.config.cache).toContain("target");
    });

    test("go caches vendor", () => {
      const go = getRecipeByName("go");
      expect(go?.config.cache).toContain("vendor");
    });
  });
});
