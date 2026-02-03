import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, stat, readFile, readlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { copyArtifacts, hardlinkCopy, runPostRestore } from "./copy";

describe("copy", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wtree-copy-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("hardlinkCopy", () => {
    test("copies a file via hardlink", async () => {
      const srcDir = join(tempDir, "src");
      const destDir = join(tempDir, "dest");
      await mkdir(srcDir, { recursive: true });

      const srcFile = join(srcDir, "test.txt");
      await writeFile(srcFile, "hello world");

      await hardlinkCopy(srcDir, destDir);

      const destFile = join(destDir, "test.txt");
      const content = await readFile(destFile, "utf-8");
      expect(content).toBe("hello world");

      // Verify it's a hardlink (same inode)
      const srcStat = await stat(srcFile);
      const destStat = await stat(destFile);
      expect(srcStat.ino).toBe(destStat.ino);
    });

    test("copies nested directories via hardlink", async () => {
      const srcDir = join(tempDir, "src");
      await mkdir(join(srcDir, "a", "b", "c"), { recursive: true });
      await writeFile(join(srcDir, "a", "b", "c", "deep.txt"), "deep content");

      const destDir = join(tempDir, "dest");
      await hardlinkCopy(srcDir, destDir);

      const content = await readFile(join(destDir, "a", "b", "c", "deep.txt"), "utf-8");
      expect(content).toBe("deep content");
    });

    test("creates parent directories if needed", async () => {
      const srcDir = join(tempDir, "src");
      await mkdir(srcDir);
      await writeFile(join(srcDir, "file.txt"), "content");

      const destDir = join(tempDir, "nested", "path", "dest");
      await hardlinkCopy(srcDir, destDir);

      const content = await readFile(join(destDir, "file.txt"), "utf-8");
      expect(content).toBe("content");
    });

    test("throws error for non-existent source", async () => {
      const srcDir = join(tempDir, "nonexistent");
      const destDir = join(tempDir, "dest");

      await expect(hardlinkCopy(srcDir, destDir)).rejects.toThrow();
    });
  });

  describe("copyArtifacts", () => {
    test("copies single pattern", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      await mkdir(join(srcRoot, "node_modules", "pkg"), { recursive: true });
      await writeFile(join(srcRoot, "node_modules", "pkg", "index.js"), "module.exports = {}");

      const copied = await copyArtifacts(srcRoot, destRoot, ["node_modules"]);

      expect(copied).toContain("node_modules");
      const content = await readFile(join(destRoot, "node_modules", "pkg", "index.js"), "utf-8");
      expect(content).toBe("module.exports = {}");
    });

    test("copies multiple patterns", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      await mkdir(join(srcRoot, "node_modules"));
      await writeFile(join(srcRoot, "node_modules", "a.js"), "a");
      await mkdir(join(srcRoot, "dist"));
      await writeFile(join(srcRoot, "dist", "b.js"), "b");

      const copied = await copyArtifacts(srcRoot, destRoot, ["node_modules", "dist"]);

      expect(copied).toContain("node_modules");
      expect(copied).toContain("dist");
    });

    test("skips patterns that don't exist in source", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      await mkdir(join(srcRoot, "node_modules"));
      await writeFile(join(srcRoot, "node_modules", "a.js"), "a");

      const copied = await copyArtifacts(srcRoot, destRoot, ["node_modules", "nonexistent"]);

      expect(copied).toContain("node_modules");
      expect(copied).not.toContain("nonexistent");
    });

    test("skips if destination already exists", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      await mkdir(join(srcRoot, "node_modules"));
      await writeFile(join(srcRoot, "node_modules", "src.js"), "from source");

      // Pre-create destination
      await mkdir(join(destRoot, "node_modules"));
      await writeFile(join(destRoot, "node_modules", "existing.js"), "already here");

      const copied = await copyArtifacts(srcRoot, destRoot, ["node_modules"]);

      expect(copied).not.toContain("node_modules");
      // Original content should be preserved
      const content = await readFile(join(destRoot, "node_modules", "existing.js"), "utf-8");
      expect(content).toBe("already here");
    });

    test("expands glob patterns", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      // Create monorepo structure
      await mkdir(join(srcRoot, "packages", "a", "node_modules"), { recursive: true });
      await mkdir(join(srcRoot, "packages", "b", "node_modules"), { recursive: true });
      await writeFile(join(srcRoot, "packages", "a", "node_modules", "dep.js"), "a-dep");
      await writeFile(join(srcRoot, "packages", "b", "node_modules", "dep.js"), "b-dep");

      // Need to create the packages structure in dest for glob to work
      await mkdir(join(destRoot, "packages", "a"), { recursive: true });
      await mkdir(join(destRoot, "packages", "b"), { recursive: true });

      const copied = await copyArtifacts(srcRoot, destRoot, ["packages/*/node_modules"]);

      expect(copied.length).toBe(2);
      expect(copied).toContain("packages/a/node_modules");
      expect(copied).toContain("packages/b/node_modules");
    });

    test("deduplicates nested paths", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      await mkdir(join(srcRoot, "node_modules", "pkg", "node_modules"), { recursive: true });
      await writeFile(join(srcRoot, "node_modules", "pkg", "index.js"), "pkg");
      await writeFile(join(srcRoot, "node_modules", "pkg", "node_modules", "nested.js"), "nested");

      // Pattern that would match both parent and child
      const copied = await copyArtifacts(srcRoot, destRoot, ["node_modules", "node_modules/pkg/node_modules"]);

      // Should only copy parent, not the nested one separately
      expect(copied).toEqual(["node_modules"]);
    });

    test("handles empty patterns array", async () => {
      const srcRoot = join(tempDir, "src");
      const destRoot = join(tempDir, "dest");
      await mkdir(srcRoot);
      await mkdir(destRoot);

      const copied = await copyArtifacts(srcRoot, destRoot, []);

      expect(copied).toEqual([]);
    });
  });

  describe("runPostRestore", () => {
    test("executes command in specified directory", async () => {
      const workDir = join(tempDir, "work");
      await mkdir(workDir);

      // Create a simple script that writes to a file
      await runPostRestore("echo 'executed' > result.txt", workDir);

      const content = await readFile(join(workDir, "result.txt"), "utf-8");
      expect(content.trim()).toBe("executed");
    });

    test("has access to PATH", async () => {
      const workDir = join(tempDir, "work");
      await mkdir(workDir);

      // Use a common command
      await runPostRestore("which ls > result.txt", workDir);

      const content = await readFile(join(workDir, "result.txt"), "utf-8");
      expect(content.trim()).toContain("ls");
    });

    test("throws on command failure", async () => {
      const workDir = join(tempDir, "work");
      await mkdir(workDir);

      await expect(runPostRestore("exit 1", workDir)).rejects.toThrow("exit code 1");
    });

    test("throws on non-existent command", async () => {
      const workDir = join(tempDir, "work");
      await mkdir(workDir);

      await expect(runPostRestore("nonexistent_command_12345", workDir)).rejects.toThrow();
    });
  });
});

describe("deduplicatePaths (via copyArtifacts)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wtree-dedup-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("removes child paths when parent is included", async () => {
    const srcRoot = join(tempDir, "src");
    const destRoot = join(tempDir, "dest");
    await mkdir(srcRoot);
    await mkdir(destRoot);

    // Create structure: a/b/c with files at each level
    await mkdir(join(srcRoot, "a", "b", "c"), { recursive: true });
    await writeFile(join(srcRoot, "a", "file.txt"), "a");
    await writeFile(join(srcRoot, "a", "b", "file.txt"), "b");
    await writeFile(join(srcRoot, "a", "b", "c", "file.txt"), "c");

    // Request copying parent and children - should only copy parent
    const copied = await copyArtifacts(srcRoot, destRoot, ["a", "a/b", "a/b/c"]);

    expect(copied).toEqual(["a"]);

    // All files should still exist (copied as part of parent)
    expect(await readFile(join(destRoot, "a", "file.txt"), "utf-8")).toBe("a");
    expect(await readFile(join(destRoot, "a", "b", "file.txt"), "utf-8")).toBe("b");
    expect(await readFile(join(destRoot, "a", "b", "c", "file.txt"), "utf-8")).toBe("c");
  });

  test("keeps independent paths", async () => {
    const srcRoot = join(tempDir, "src");
    const destRoot = join(tempDir, "dest");
    await mkdir(srcRoot);
    await mkdir(destRoot);

    await mkdir(join(srcRoot, "a"));
    await mkdir(join(srcRoot, "b"));
    await writeFile(join(srcRoot, "a", "file.txt"), "a");
    await writeFile(join(srcRoot, "b", "file.txt"), "b");

    const copied = await copyArtifacts(srcRoot, destRoot, ["a", "b"]);

    expect(copied.sort()).toEqual(["a", "b"]);
  });
});
