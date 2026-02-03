/**
 * Configuration for artifact caching
 */
export interface Config {
  /** Glob patterns for artifacts to cache/hardlink */
  cache: string[];
  /** Command to run after restoring artifacts */
  post_restore?: string;
  /** Name of the recipe this config came from (if detected) */
  recipe?: string;
}

/**
 * Built-in recipe definition
 */
export interface Recipe {
  /** Recipe identifier */
  name: string;
  /** Files that indicate this recipe should be used */
  detect: string[];
  /** Configuration for this recipe */
  config: Config;
}

/**
 * Git worktree information
 */
export interface Worktree {
  /** Absolute path to the worktree */
  path: string;
  /** Branch name (or commit hash if detached) */
  branch: string;
  /** Whether this is the bare repository entry */
  bare: boolean;
}

/**
 * Error codes for structured error handling
 */
export enum ErrorCode {
  UNKNOWN = "UNKNOWN",
  GIT_ERROR = "GIT_ERROR",
  WORKTREE_EXISTS = "WORKTREE_EXISTS",
  WORKTREE_NOT_FOUND = "WORKTREE_NOT_FOUND",
  CONFIG_ERROR = "CONFIG_ERROR",
  COPY_ERROR = "COPY_ERROR",
  DETECTION_FAILED = "DETECTION_FAILED",
  INVALID_ARGS = "INVALID_ARGS",
}

/**
 * Custom error class with error code for structured output
 */
export class WtreeError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.UNKNOWN
  ) {
    super(message);
    this.name = "WtreeError";
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Result of the add command
 */
export interface AddResult {
  success: true;
  worktree: {
    path: string;
    branch: string;
  };
  source: {
    path: string;
    branch: string;
  };
  artifacts: {
    patterns: string[];
    copied: string[];
  };
  recipe?: string;
  recipes?: string[];
  warning?: string;
}

/**
 * Result of the restore command
 */
export interface RestoreResult {
  success: true;
  target: {
    path: string;
  };
  source: {
    path: string;
    branch: string;
  };
  artifacts: {
    patterns: string[];
    copied: string[];
  };
  recipe?: string;
  recipes?: string[];
  warning?: string;
}

/**
 * Result of the analyze command
 */
export interface AnalyzeResult {
  success: true;
  detection: {
    method: "explicit" | "recipe" | "mixed" | "gitignore" | "none";
    recipe?: string;
    recipes?: string[];
  };
  config: Config | null;
  files?: {
    detected: string[];
  };
}

/**
 * Result of the remove command
 */
export interface RemoveResult {
  success: true;
  removed: {
    path: string;
    branch: string;
  };
}

/**
 * Result of the list command
 */
export interface ListResult {
  success: true;
  worktrees: {
    path: string;
    branch: string;
    current: boolean;
    recipe?: string;
    recipes?: string[];
    artifacts: {
      pattern: string;
      exists: boolean;
    }[];
  }[];
}

/**
 * Error result for JSON output
 */
export interface ErrorResult {
  error: true;
  code: ErrorCode;
  message: string;
}

/**
 * Union type for all possible command results
 */
export type CommandResult =
  | AddResult
  | RestoreResult
  | AnalyzeResult
  | RemoveResult
  | ListResult
  | ErrorResult;

/**
 * CLI parsed arguments
 */
export interface ParsedArgs {
  command: "add" | "restore" | "analyze" | "remove" | "list" | "help" | "version";
  positional: string[];
  flags: {
    branch?: string;
    from?: string;
    json: boolean;
    help: boolean;
    version: boolean;
    force?: boolean;
  };
}

/**
 * Detection result from the detection layer
 */
export interface DetectionResult {
  method: "explicit" | "recipe" | "mixed" | "gitignore" | "none";
  config: Config | null;
  recipe?: string;
  recipes?: string[];
  detectedFiles?: string[];
}
