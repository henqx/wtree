import { describe, test, expect } from "bun:test";
import { inferFromGitignore } from "./gitignore";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("gitignore inference", () => {
  async function createTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), "wtree-test-"));
  }

  async function cleanup(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true });
  }

  test("returns null when no .gitignore exists", async () => {
    const tmp = await createTempDir();
    try {
      const result = await inferFromGitignore(tmp);
      expect(result).toBeNull();
    } finally {
      await cleanup(tmp);
    }
  });

  test("returns null for empty .gitignore", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "");
      const result = await inferFromGitignore(tmp);
      expect(result).toBeNull();
    } finally {
      await cleanup(tmp);
    }
  });

  test("returns null for .gitignore with only comments", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "# This is a comment\n# Another comment\n");
      const result = await inferFromGitignore(tmp);
      expect(result).toBeNull();
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects node_modules", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "node_modules\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("node_modules");
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects node_modules with trailing slash", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "node_modules/\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("node_modules");
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects .venv", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), ".venv\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain(".venv");
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects target (Rust)", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "target\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("target");
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects vendor (Go)", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "vendor\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("vendor");
    } finally {
      await cleanup(tmp);
    }
  });

  test("detects multiple patterns", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "node_modules\ndist\n.venv\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("node_modules");
      expect(result?.cache).toContain("dist");
      expect(result?.cache).toContain(".venv");
    } finally {
      await cleanup(tmp);
    }
  });

  test("ignores negation patterns", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "node_modules\n!node_modules/important\n");
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("node_modules");
      // Should not include the negation pattern
      expect(result?.cache.length).toBe(1);
    } finally {
      await cleanup(tmp);
    }
  });

  test("handles mixed content with comments and empty lines", async () => {
    const tmp = await createTempDir();
    try {
      const gitignore = `
# Dependencies
node_modules/

# Build
dist/

# Python
__pycache__
.venv/

# Logs
*.log
`;
      await writeFile(join(tmp, ".gitignore"), gitignore);
      const result = await inferFromGitignore(tmp);
      expect(result).not.toBeNull();
      expect(result?.cache).toContain("node_modules");
      expect(result?.cache).toContain("dist");
      expect(result?.cache).toContain(".venv");
    } finally {
      await cleanup(tmp);
    }
  });

  test("does not cache __pycache__", async () => {
    const tmp = await createTempDir();
    try {
      await writeFile(join(tmp, ".gitignore"), "__pycache__\n");
      const result = await inferFromGitignore(tmp);
      // __pycache__ maps to empty array, so if that's the only entry, result is null
      expect(result).toBeNull();
    } finally {
      await cleanup(tmp);
    }
  });
});
