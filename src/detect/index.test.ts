import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { detectConfig } from "./index";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("detectConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wtree-detect-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("single recipe detection", () => {
    test("detects pnpm from pnpm-lock.yaml", async () => {
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("recipe");
      expect(result.recipe).toBe("pnpm");
      expect(result.recipes).toBeUndefined();
      expect(result.config?.cache).toContain("node_modules");
    });

    test("detects npm from package-lock.json", async () => {
      writeFileSync(join(tempDir, "package-lock.json"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("recipe");
      expect(result.recipe).toBe("npm");
      expect(result.config?.cache).toContain("node_modules");
    });

    test("detects rust from Cargo.lock", async () => {
      writeFileSync(join(tempDir, "Cargo.lock"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("recipe");
      expect(result.recipe).toBe("rust");
      expect(result.config?.cache).toContain("target");
    });
  });

  describe("mixed stack detection", () => {
    test("detects rust + npm mixed stack", async () => {
      writeFileSync(join(tempDir, "Cargo.lock"), "");
      writeFileSync(join(tempDir, "package-lock.json"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("mixed");
      expect(result.recipe).toBe("npm"); // primary (first in RECIPES order)
      expect(result.recipes).toEqual(["npm", "rust"]);
    });

    test("detects python + pnpm mixed stack", async () => {
      writeFileSync(join(tempDir, "uv.lock"), "");
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("mixed");
      expect(result.recipes).toContain("python-uv");
      expect(result.recipes).toContain("pnpm");
    });

    test("detects all three: rust + go + npm", async () => {
      writeFileSync(join(tempDir, "Cargo.lock"), "");
      writeFileSync(join(tempDir, "go.sum"), "");
      writeFileSync(join(tempDir, "package-lock.json"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("mixed");
      expect(result.recipes?.length).toBe(3);
      expect(result.recipes).toContain("rust");
      expect(result.recipes).toContain("go");
      expect(result.recipes).toContain("npm");
    });

    test("merged config deduplicates cache patterns", async () => {
      // Create files that trigger both pnpm and bun (both cache node_modules)
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
      writeFileSync(join(tempDir, "bun.lock"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("mixed");
      // node_modules should only appear once despite both recipes including it
      const nodeModulesCount = result.config!.cache.filter(
        (p) => p === "node_modules"
      ).length;
      expect(nodeModulesCount).toBe(1);
    });

    test("mixed stacks skip post_restore command", async () => {
      writeFileSync(join(tempDir, "Cargo.lock"), "");
      writeFileSync(join(tempDir, "package-lock.json"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("mixed");
      expect(result.config?.post_restore).toBeUndefined();
    });

    test("collects all detected files", async () => {
      writeFileSync(join(tempDir, "Cargo.lock"), "");
      writeFileSync(join(tempDir, "package-lock.json"), "");

      const result = await detectConfig(tempDir);

      expect(result.detectedFiles).toContain("Cargo.lock");
      expect(result.detectedFiles).toContain("package-lock.json");
      expect(result.detectedFiles?.length).toBe(2);
    });
  });

  describe("explicit configuration", () => {
    test("reads from .wtree.yaml", async () => {
      writeFileSync(
        join(tempDir, ".wtree.yaml"),
        "cache:\n  - node_modules\n  - .turbo\n"
      );

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("explicit");
      expect(result.config?.cache).toEqual(["node_modules", ".turbo"]);
    });

    test("explicit config takes precedence over recipes", async () => {
      writeFileSync(
        join(tempDir, ".wtree.yaml"),
        "recipe: rust\ncache:\n  - target\n  - custom_dir\n"
      );
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
      writeFileSync(join(tempDir, "Cargo.lock"), "");

      const result = await detectConfig(tempDir);

      expect(result.method).toBe("explicit");
      expect(result.config?.cache).toEqual(["target", "custom_dir"]);
    });
  });

  describe("no detection", () => {
    test("returns none when no markers found", async () => {
      const result = await detectConfig(tempDir);

      expect(result.method).toBe("none");
      expect(result.config).toBeNull();
      expect(result.recipe).toBeUndefined();
      expect(result.recipes).toBeUndefined();
    });
  });

  describe("priority ordering", () => {
    test("explicit > mixed > single recipe > gitignore", async () => {
      // Create scenario that would trigger mixed detection
      writeFileSync(join(tempDir, "Cargo.lock"), "");
      writeFileSync(join(tempDir, "package-lock.json"), "");

      // Without .wtree.yaml, should detect as mixed
      let result = await detectConfig(tempDir);
      expect(result.method).toBe("mixed");

      // With .wtree.yaml, should be explicit
      writeFileSync(
        join(tempDir, ".wtree.yaml"),
        "cache:\n  - node_modules\n"
      );
      result = await detectConfig(tempDir);
      expect(result.method).toBe("explicit");
    });
  });
});
