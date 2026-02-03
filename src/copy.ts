import { WtreeError, ErrorCode } from "./types.ts";
import { Glob } from "bun";
import { join, dirname, relative, basename } from "path";
import { stat, mkdir } from "fs/promises";

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

/**
 * Execute a command and return success status
 */
async function exec(
  cmd: string[],
  options?: { cwd?: string }
): Promise<{ success: boolean; stderr: string }> {
  const proc = Bun.spawn(cmd, {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { success: exitCode === 0, stderr };
}

/**
 * Hardlink copy a directory using cp -al (macOS uses cp -Rl for hardlinks)
 */
export async function hardlinkCopy(src: string, dest: string): Promise<void> {
  // Ensure parent directory exists
  const parentDir = dirname(dest);
  await mkdir(parentDir, { recursive: true });

  // Detect platform and use appropriate flag
  // macOS: cp -Rl (recursive, hardlink)
  // Linux: cp -al (archive, hardlink)
  const isMacOS = process.platform === "darwin";
  const flags = isMacOS ? ["-Rl"] : ["-al"];

  const result = await exec(["cp", ...flags, src, dest]);

  if (!result.success) {
    throw new WtreeError(
      `Failed to hardlink copy ${src} to ${dest}: ${result.stderr}`,
      ErrorCode.COPY_ERROR
    );
  }
}

/**
 * Expand a glob pattern and return matching paths relative to root
 */
async function expandGlob(
  pattern: string,
  root: string
): Promise<string[]> {
  const matches: string[] = [];
  const glob = new Glob(pattern);

  for await (const match of glob.scan({ cwd: root, onlyFiles: false })) {
    matches.push(match);
  }

  return matches;
}

/**
 * Deduplicate paths - remove paths that are children of other paths
 */
function deduplicatePaths(paths: string[]): string[] {
  const sorted = [...paths].sort();
  const result: string[] = [];

  for (const path of sorted) {
    // Check if this path is a child of any existing path
    const isChild = result.some(
      (existing) => path.startsWith(existing + "/") || path === existing
    );
    if (!isChild) {
      result.push(path);
    }
  }

  return result;
}

/**
 * Copy artifacts from source to destination based on glob patterns
 * Returns the list of paths that were copied
 */
export async function copyArtifacts(
  sourceRoot: string,
  destRoot: string,
  patterns: string[]
): Promise<string[]> {
  const allMatches: string[] = [];

  // Expand all patterns and collect matches
  for (const pattern of patterns) {
    const matches = await expandGlob(pattern, sourceRoot);
    allMatches.push(...matches);
  }

  // Deduplicate - don't copy children if parent is already being copied
  const toCopy = deduplicatePaths(allMatches);
  const copied: string[] = [];

  // Copy each matched path
  for (const relativePath of toCopy) {
    const srcPath = join(sourceRoot, relativePath);
    const destPath = join(destRoot, relativePath);

    // Skip if source doesn't exist
    if (!(await exists(srcPath))) {
      continue;
    }

    // Skip if destination already exists
    if (await exists(destPath)) {
      continue;
    }

    try {
      await hardlinkCopy(srcPath, destPath);
      copied.push(relativePath);
    } catch (error) {
      // Log but continue - some artifacts might fail to copy
      if (error instanceof WtreeError) {
        console.error(`Warning: ${error.message}`);
      }
    }
  }

  return copied;
}

/**
 * Run post-restore command in the target directory
 */
export async function runPostRestore(
  command: string,
  cwd: string
): Promise<void> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new WtreeError(
      `Post-restore command failed with exit code ${exitCode}`,
      ErrorCode.COPY_ERROR
    );
  }
}
