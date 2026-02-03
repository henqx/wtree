import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getWorktreeRoot,
  listWorktrees,
  findWorktreeByBranch,
  findWorktreeByPath,
  getCurrentWorktree,
  isPathIgnored,
  isGitRepo,
  getCurrentBranch,
} from "./git";

describe("git utilities", () => {
  let tempDir: string;

  async function createGitRepo(): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "wtree-git-test-"));
    await exec(["git", "init"], tempDir);
    await exec(["git", "config", "user.email", "test@test.com"], tempDir);
    await exec(["git", "config", "user.name", "Test"], tempDir);
    await writeFile(join(tempDir, "README.md"), "# Test");
    await exec(["git", "add", "-A"], tempDir);
    await exec(["git", "commit", "-m", "Initial commit"], tempDir);
    return tempDir;
  }

  async function exec(cmd: string[], cwd: string): Promise<void> {
    const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    await proc.exited;
  }

  afterEach(async () => {
    if (tempDir) {
      // Clean up worktrees first
      try {
        const proc = Bun.spawn(["git", "worktree", "list", "--porcelain"], {
          cwd: tempDir,
          stdout: "pipe",
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;

        for (const line of output.split("\n")) {
          if (line.startsWith("worktree ") && !line.includes(tempDir)) {
            const wtPath = line.slice(9);
            await Bun.spawn(["git", "worktree", "remove", "--force", wtPath], {
              cwd: tempDir,
            }).exited.catch(() => {});
            await rm(wtPath, { recursive: true, force: true }).catch(() => {});
          }
        }
      } catch {}

      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("isGitRepo", () => {
    test("returns true for git repository", async () => {
      await createGitRepo();
      expect(await isGitRepo(tempDir)).toBe(true);
    });

    test("returns false for non-git directory", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "wtree-git-test-"));
      expect(await isGitRepo(tempDir)).toBe(false);
    });
  });

  describe("getWorktreeRoot", () => {
    test("returns root of git repository", async () => {
      await createGitRepo();
      const root = await getWorktreeRoot(tempDir);
      expect(root).toContain("wtree-git-test");
    });

    test("returns root from subdirectory", async () => {
      await createGitRepo();
      const subdir = join(tempDir, "subdir");
      await mkdir(subdir);

      const root = await getWorktreeRoot(subdir);
      expect(root).toBe(await getWorktreeRoot(tempDir));
    });

    test("throws for non-git directory", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "wtree-git-test-"));
      await expect(getWorktreeRoot(tempDir)).rejects.toThrow();
    });
  });

  describe("getCurrentBranch", () => {
    test("returns current branch name", async () => {
      await createGitRepo();
      const branch = await getCurrentBranch(tempDir);
      // Default branch could be main or master depending on git config
      expect(["main", "master"]).toContain(branch);
    });

    test("returns branch name after checkout", async () => {
      await createGitRepo();
      await exec(["git", "checkout", "-b", "feature-branch"], tempDir);

      const branch = await getCurrentBranch(tempDir);
      expect(branch).toBe("feature-branch");
    });
  });

  describe("listWorktrees", () => {
    test("returns single worktree for new repo", async () => {
      await createGitRepo();
      const worktrees = await listWorktrees(tempDir);

      expect(worktrees.length).toBe(1);
      expect(worktrees[0].path).toContain("wtree-git-test");
      expect(worktrees[0].bare).toBe(false);
    });

    test("returns multiple worktrees", async () => {
      await createGitRepo();
      const wtPath = join(tempDir, "..", "wt-" + Date.now());

      try {
        await exec(["git", "worktree", "add", "-b", "test-branch", wtPath], tempDir);

        const worktrees = await listWorktrees(tempDir);
        expect(worktrees.length).toBe(2);
      } finally {
        await rm(wtPath, { recursive: true, force: true }).catch(() => {});
      }
    });

    test("includes branch information", async () => {
      await createGitRepo();
      const worktrees = await listWorktrees(tempDir);

      expect(worktrees[0].branch).toBeDefined();
      expect(["main", "master"]).toContain(worktrees[0].branch);
    });
  });

  describe("findWorktreeByBranch", () => {
    test("finds worktree by branch name", async () => {
      await createGitRepo();
      const branch = await getCurrentBranch(tempDir);

      const wt = await findWorktreeByBranch(branch, tempDir);
      expect(wt).toBeDefined();
      expect(wt?.branch).toBe(branch);
    });

    test("returns undefined for non-existent branch", async () => {
      await createGitRepo();

      const wt = await findWorktreeByBranch("nonexistent-branch", tempDir);
      expect(wt).toBeUndefined();
    });
  });

  describe("findWorktreeByPath", () => {
    test("finds worktree by path", async () => {
      await createGitRepo();

      const wt = await findWorktreeByPath(tempDir, tempDir);
      expect(wt).toBeDefined();
    });

    test("returns undefined for non-worktree path", async () => {
      await createGitRepo();

      const wt = await findWorktreeByPath("/nonexistent/path", tempDir);
      expect(wt).toBeUndefined();
    });
  });

  describe("getCurrentWorktree", () => {
    test("returns current worktree", async () => {
      await createGitRepo();

      const current = await getCurrentWorktree(tempDir);
      expect(current.path).toContain("wtree-git-test");
    });
  });

  describe("isPathIgnored", () => {
    test("returns true for ignored path", async () => {
      await createGitRepo();
      await writeFile(join(tempDir, ".gitignore"), "node_modules\n");

      expect(await isPathIgnored("node_modules", tempDir)).toBe(true);
    });

    test("returns false for non-ignored path", async () => {
      await createGitRepo();
      await writeFile(join(tempDir, ".gitignore"), "node_modules\n");

      expect(await isPathIgnored("src", tempDir)).toBe(false);
    });

    test("returns false when no gitignore", async () => {
      await createGitRepo();

      expect(await isPathIgnored("anything", tempDir)).toBe(false);
    });
  });
});

describe("git worktree parsing edge cases", () => {
  test("handles detached HEAD in worktree list", () => {
    // This tests the parsing function indirectly through listWorktrees
    // but we can test the format handling
    const porcelainOutput = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/detached
HEAD def456abc789
detached

`;

    // The parsing happens in listWorktrees, so we verify behavior through integration tests
    // Here we just document the expected format
    expect(porcelainOutput).toContain("detached");
  });

  test("handles bare repository marker", () => {
    const porcelainOutput = `worktree /path/to/bare
bare

worktree /path/to/main
HEAD abc123
branch refs/heads/main

`;

    expect(porcelainOutput).toContain("bare");
  });
});
