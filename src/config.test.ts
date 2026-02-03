import { describe, test, expect } from "bun:test";
import { parseConfig } from "./config";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("config parsing", () => {
  async function createTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), "wtree-config-test-"));
  }

  async function cleanup(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true });
  }

  test("throws for missing config file", async () => {
    const tmp = await createTempDir();
    try {
      await expect(parseConfig(join(tmp, ".wtree.yaml"))).rejects.toThrow();
    } finally {
      await cleanup(tmp);
    }
  });

  test("throws for invalid YAML", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "invalid: yaml: content:");
      await expect(parseConfig(join(tmp, ".wtree.yaml"))).rejects.toThrow();
    } finally {
      await cleanup(tmp);
    }
  });

  test("parses simple cache config", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `cache:
  - node_modules
  - dist
`
      );
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.cache).toEqual(["node_modules", "dist"]);
    } finally {
      await cleanup(tmp);
    }
  });

  test("parses post_restore command", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `cache:
  - node_modules
post_restore: pnpm install
`
      );
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.post_restore).toBe("pnpm install");
    } finally {
      await cleanup(tmp);
    }
  });

  test("extends pnpm recipe", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "extends: pnpm\n");
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.cache).toContain("node_modules");
      expect(config.recipe).toBe("pnpm");
    } finally {
      await cleanup(tmp);
    }
  });

  test("extends turborepo recipe", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "extends: turborepo\n");
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.cache).toContain("node_modules");
      expect(config.cache).toContain(".turbo");
      expect(config.recipe).toBe("turborepo");
    } finally {
      await cleanup(tmp);
    }
  });

  test("merges custom cache with extended recipe", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `extends: pnpm
cache:
  - .next
  - dist
`
      );
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.cache).toContain("node_modules"); // from pnpm
      expect(config.cache).toContain(".next"); // custom
      expect(config.cache).toContain("dist"); // custom
    } finally {
      await cleanup(tmp);
    }
  });

  test("deduplicates cache patterns", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `extends: pnpm
cache:
  - node_modules
  - dist
`
      );
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      const nodeModulesCount = config.cache.filter(
        (c) => c === "node_modules"
      ).length;
      expect(nodeModulesCount).toBe(1);
    } finally {
      await cleanup(tmp);
    }
  });

  test("overrides post_restore from extended recipe", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `extends: pnpm
post_restore: npm ci
`
      );
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.post_restore).toBe("npm ci");
    } finally {
      await cleanup(tmp);
    }
  });

  test("throws for unknown recipe in extends", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "extends: unknown-recipe\n");
      await expect(parseConfig(join(tmp, ".wtree.yaml"))).rejects.toThrow(
        "Unknown recipe"
      );
    } finally {
      await cleanup(tmp);
    }
  });

  test("throws for non-array cache", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "cache: node_modules\n");
      await expect(parseConfig(join(tmp, ".wtree.yaml"))).rejects.toThrow(
        "expected array"
      );
    } finally {
      await cleanup(tmp);
    }
  });

  test("throws for non-string post_restore", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(
        join(tmp, ".wtree.yaml"),
        `cache:
  - node_modules
post_restore:
  - cmd1
  - cmd2
`
      );
      await expect(parseConfig(join(tmp, ".wtree.yaml"))).rejects.toThrow(
        "expected string"
      );
    } finally {
      await cleanup(tmp);
    }
  });

  test("handles empty config object", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".wtree.yaml"), "{}\n");
      const config = await parseConfig(join(tmp, ".wtree.yaml"));
      expect(config.cache).toEqual([]);
    } finally {
      await cleanup(tmp);
    }
  });
});
