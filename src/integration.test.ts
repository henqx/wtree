import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, readdir, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Integration tests for wtree commands.
 * Each test creates a real git repository and cleans up afterward.
 */

interface TestRepo {
  root: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a temporary git repository for testing
 */
async function createTestRepo(files: Record<string, string> = {}): Promise<TestRepo> {
  const root = await mkdtemp(join(tmpdir(), "wtree-integration-"));

  // Initialize git repo
  await exec(["git", "init"], root);
  await exec(["git", "config", "user.email", "test@test.com"], root);
  await exec(["git", "config", "user.name", "Test"], root);

  // Create files
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, path);
    const dir = join(fullPath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }

  // Initial commit
  await exec(["git", "add", "-A"], root);
  await exec(["git", "commit", "-m", "Initial commit", "--allow-empty"], root);

  return {
    root,
    cleanup: async () => {
      // Remove any worktrees first
      try {
        const result = await execCapture(["git", "worktree", "list", "--porcelain"], root);
        const worktrees = parseWorktrees(result);
        for (const wt of worktrees) {
          if (wt !== root) {
            await exec(["git", "worktree", "remove", "--force", wt], root).catch(() => {});
            await rm(wt, { recursive: true, force: true }).catch(() => {});
          }
        }
      } catch {
        // Ignore errors during cleanup
      }

      // Remove the repo directory
      await rm(root, { recursive: true, force: true });
    },
  };
}

/**
 * Parse git worktree list --porcelain output
 */
function parseWorktrees(output: string): string[] {
  const paths: string[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice(9));
    }
  }
  return paths;
}

/**
 * Execute a command and return exit code
 */
async function exec(cmd: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Command failed: ${cmd.join(" ")}\n${stderr}`);
  }
}

/**
 * Execute a command and capture stdout
 */
async function execCapture(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout;
}

/**
 * Run wtree command and return parsed JSON output
 */
async function wtree(args: string[], cwd: string): Promise<any> {
  const wtreePath = join(import.meta.dir, "index.ts");
  const proc = Bun.spawn(["bun", "run", wtreePath, ...args, "--json"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`wtree failed (exit ${exitCode}):\nstdout: ${stdout}\nstderr: ${stderr}`);
  }
}

/**
 * Check if a path exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("integration: analyze", () => {
  let repo: TestRepo;

  afterEach(async () => {
    if (repo) await repo.cleanup();
  });

  test("detects pnpm project", async () => {
    repo = await createTestRepo({
      "pnpm-lock.yaml": "lockfileVersion: 6.0",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.method).toBe("recipe");
    expect(result.detection.recipe).toBe("pnpm");
    expect(result.config.cache).toContain("node_modules");
  });

  test("detects npm project", async () => {
    repo = await createTestRepo({
      "package-lock.json": "{}",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("npm");
  });

  test("detects bun project", async () => {
    repo = await createTestRepo({
      "bun.lock": "{}",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("bun");
  });

  test("detects turborepo project", async () => {
    repo = await createTestRepo({
      "turbo.json": "{}",
      "pnpm-lock.yaml": "",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("turborepo");
    expect(result.config.cache).toContain(".turbo");
  });

  test("detects rush project", async () => {
    repo = await createTestRepo({
      "rush.json": "{}",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("rush");
    expect(result.config.cache).toContain("common/temp/node_modules");
    expect(result.config.cache).toContain(".rush/temp");
  });

  test("detects pnpm workspaces project", async () => {
    repo = await createTestRepo({
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "pnpm-lock.yaml": "",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("pnpm-workspaces");
    expect(result.config.cache).toContain("node_modules");
    expect(result.config.cache).toContain("**/node_modules");
  });

  test("detects lerna project", async () => {
    repo = await createTestRepo({
      "lerna.json": '{"version": "1.0.0"}',
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.recipe).toBe("lerna");
    expect(result.config.cache).toContain("node_modules");
    expect(result.config.cache).toContain("**/node_modules");
  });

  test("uses explicit .wtree.yaml config", async () => {
    repo = await createTestRepo({
      ".wtree.yaml": "cache:\n  - custom-cache\n  - another-dir\n",
      "pnpm-lock.yaml": "",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.method).toBe("explicit");
    expect(result.config.cache).toContain("custom-cache");
    expect(result.config.cache).toContain("another-dir");
  });

  test("falls back to gitignore inference", async () => {
    repo = await createTestRepo({
      ".gitignore": "node_modules\ndist\n",
      "package.json": "{}",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.method).toBe("gitignore");
    expect(result.config.cache).toContain("node_modules");
    expect(result.config.cache).toContain("dist");
  });

  test("returns none when no config detected", async () => {
    repo = await createTestRepo({
      "README.md": "# Test",
    });

    const result = await wtree(["analyze"], repo.root);

    expect(result.success).toBe(true);
    expect(result.detection.method).toBe("none");
    expect(result.config).toBeNull();
  });
});

describe("integration: add", () => {
  let repo: TestRepo;

  afterEach(async () => {
    if (repo) await repo.cleanup();
  });

  test("creates worktree with inferred branch name", async () => {
    repo = await createTestRepo({
      "pnpm-lock.yaml": "",
      "package.json": "{}",
    });

    const worktreePath = join(repo.root, "..", "test-feature");

    try {
      const result = await wtree(["add", worktreePath], repo.root);

      expect(result.success).toBe(true);
      expect(result.worktree.branch).toBe("test-feature");
      expect(await exists(worktreePath)).toBe(true);
      expect(await exists(join(worktreePath, "package.json"))).toBe(true);
    } finally {
      // Extra cleanup for sibling worktree
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("creates worktree with explicit branch name", async () => {
    repo = await createTestRepo({
      "package.json": "{}",
    });

    const worktreePath = join(repo.root, "..", "my-path");

    try {
      const result = await wtree(["add", "-b", "custom-branch", worktreePath], repo.root);

      expect(result.success).toBe(true);
      expect(result.worktree.branch).toBe("custom-branch");
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("copies node_modules via hardlink", async () => {
    repo = await createTestRepo({
      "pnpm-lock.yaml": "",
      "package.json": "{}",
    });

    // Create node_modules after repo init (it's untracked, not in git)
    await mkdir(join(repo.root, "node_modules", "test-pkg"), { recursive: true });
    await writeFile(join(repo.root, "node_modules", "test-pkg", "index.js"), "module.exports = {}");

    const worktreePath = join(repo.root, "..", "with-modules-" + Date.now());

    try {
      const result = await wtree(["add", worktreePath], repo.root);

      expect(result.success).toBe(true);
      expect(result.artifacts.copied).toContain("node_modules");
      expect(await exists(join(worktreePath, "node_modules"))).toBe(true);
      expect(await exists(join(worktreePath, "node_modules/test-pkg/index.js"))).toBe(true);
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("warns about nested worktree not in gitignore", async () => {
    repo = await createTestRepo({
      "bun.lock": "",
      "package.json": "{}",
      ".gitignore": "node_modules\n",
    });

    const nestedDir = `.worktrees-${Date.now()}`;
    const worktreePath = join(repo.root, nestedDir, "nested-test");

    const result = await wtree(["add", worktreePath], repo.root);

    expect(result.success).toBe(true);
    expect(result.warning).toBeDefined();
    expect(typeof result.warning).toBe("string");
    expect(result.warning).toContain(".gitignore");
  });

  test("no warning for nested worktree in gitignore", async () => {
    repo = await createTestRepo({
      "bun.lock": "",
      "package.json": "{}",
      ".gitignore": "node_modules\n.worktrees\n",
    });

    const worktreePath = join(repo.root, ".worktrees", "nested-ok-" + Date.now());

    const result = await wtree(["add", worktreePath], repo.root);

    expect(result.success).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  test("returns error for existing worktree branch", async () => {
    repo = await createTestRepo({
      "package.json": "{}",
    });

    const path1 = join(repo.root, "..", "first");
    const path2 = join(repo.root, "..", "second");

    try {
      await wtree(["add", "-b", "same-branch", path1], repo.root);
      const result = await wtree(["add", "-b", "same-branch", path2], repo.root);

      expect(result.error).toBe(true);
      expect(result.code).toBe("WORKTREE_EXISTS");
    } finally {
      await rm(path1, { recursive: true, force: true }).catch(() => {});
      await rm(path2, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe("integration: restore", () => {
  let repo: TestRepo;

  afterEach(async () => {
    if (repo) await repo.cleanup();
  });

  test("restores artifacts to existing worktree", async () => {
    repo = await createTestRepo({
      "pnpm-lock.yaml": "",
      "package.json": "{}",
    });

    // Create node_modules after repo init (untracked)
    await mkdir(join(repo.root, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(repo.root, "node_modules", "pkg", "index.js"), "// test");

    // Create worktree without wtree (no artifacts copied)
    const worktreePath = join(repo.root, "..", "restore-test-" + Date.now());
    await exec(["git", "worktree", "add", "-b", "restore-branch-" + Date.now(), worktreePath], repo.root);

    try {
      // node_modules should not exist yet (git worktree doesn't copy untracked files)
      expect(await exists(join(worktreePath, "node_modules"))).toBe(false);

      // Run restore
      const result = await wtree(["restore", worktreePath, "--from", "main"], repo.root);

      expect(result.success).toBe(true);
      expect(result.artifacts.copied).toContain("node_modules");
      expect(await exists(join(worktreePath, "node_modules/pkg/index.js"))).toBe(true);
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("returns error for non-worktree path", async () => {
    repo = await createTestRepo({
      "pnpm-lock.yaml": "",
    });

    const fakePath = join(repo.root, "..", "not-a-worktree");
    await mkdir(fakePath, { recursive: true });

    try {
      const result = await wtree(["restore", fakePath, "--from", "main"], repo.root);

      expect(result.error).toBe(true);
      expect(result.code).toBe("WORKTREE_NOT_FOUND");
    } finally {
      await rm(fakePath, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe("integration: remove", () => {
  let repo: TestRepo;

  afterEach(async () => {
    if (repo) await repo.cleanup();
  });

  test("removes worktree", async () => {
    repo = await createTestRepo({
      "package.json": "{}",
    });

    const suffix = Date.now();
    const worktreePath = join(repo.root, "..", `to-remove-${suffix}`);
    await exec(["git", "worktree", "add", "-b", `remove-branch-${suffix}`, worktreePath], repo.root);

    try {
      expect(await exists(worktreePath)).toBe(true);

      const result = await wtree(["remove", worktreePath], repo.root);

      expect(result.success).toBe(true);
      expect(await exists(worktreePath)).toBe(false);
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("force removes worktree with changes", async () => {
    repo = await createTestRepo({
      "package.json": "{}",
    });

    const suffix = Date.now();
    const worktreePath = join(repo.root, "..", `force-remove-${suffix}`);
    await exec(["git", "worktree", "add", "-b", `force-branch-${suffix}`, worktreePath], repo.root);

    try {
      // Add untracked file
      await writeFile(join(worktreePath, "untracked.txt"), "test");

      const result = await wtree(["remove", worktreePath, "--force"], repo.root);

      expect(result.success).toBe(true);
      expect(await exists(worktreePath)).toBe(false);
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  });
});
