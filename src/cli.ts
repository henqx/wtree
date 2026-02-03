import { parseArgs } from "util";
import type { ParsedArgs } from "./types.ts";

const COMMANDS = ["add", "restore", "analyze", "remove", "help", "version"] as const;
type Command = (typeof COMMANDS)[number];

/**
 * Parse command line arguments
 */
export function parse(args: string[]): ParsedArgs {
  // Handle help/version as first argument
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    return {
      command: "help",
      positional: [],
      flags: { json: false, help: true, version: false },
    };
  }

  if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") {
    return {
      command: "version",
      positional: [],
      flags: { json: false, help: false, version: true },
    };
  }

  // Extract command
  const command = args[0] as Command;
  if (!COMMANDS.includes(command)) {
    return {
      command: "help",
      positional: [],
      flags: { json: false, help: true, version: false },
    };
  }

  // Parse remaining arguments
  const remainingArgs = args.slice(1);

  const { values, positionals } = parseArgs({
    args: remainingArgs,
    options: {
      branch: {
        type: "string",
        short: "b",
      },
      from: {
        type: "string",
        short: "f",
      },
      json: {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      force: {
        type: "boolean",
        default: false,
      },
    },
    allowPositionals: true,
  });

  return {
    command,
    positional: positionals,
    flags: {
      branch: values.branch,
      from: values.from,
      json: values.json ?? false,
      help: values.help ?? false,
      version: false,
      force: values.force,
    },
  };
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`wtree - Accelerate git worktree creation with hardlinked build artifacts

USAGE:
  wtree <command> [options]

COMMANDS:
  add <path> [branch]   Create a new worktree with cached artifacts
  restore <path>        Restore artifacts to an existing worktree
  analyze               Show detected configuration for current directory
  remove <path>         Remove a worktree

OPTIONS:
  -b <branch>            Create a new branch with the given name
  --from, -f <source>    Source worktree to copy artifacts from
  --json                 Output results as JSON (for agent integration)
  --force                Force operation (e.g., force remove)
  --help, -h             Show this help message
  --version, -v          Show version

EXAMPLES:
  # Sibling directory pattern
  wtree add ../feature-x                    # new branch "feature-x"
  wtree add ../feature-x main               # checkout existing "main"
  wtree add -b feature-x ../feature-x       # explicit new branch

  # Nested directory pattern
  wtree add .worktrees/feature-x            # new branch "feature-x"
  wtree add .worktrees/hotfix -b hotfix-123 # explicit new branch

  # Other commands
  wtree restore ./my-worktree --from ../main
  wtree analyze --json
  wtree remove .worktrees/feature-x

CONFIGURATION:
  Create a .wtree.yaml file in your repository root:

    extends: pnpm
    cache:
      - .next
      - dist
    post_restore: pnpm install --frozen-lockfile

RECIPES:
  pnpm, npm, yarn, bun, turborepo, nx, python-uv, python-pip, rust, go
`);
}

/**
 * Print version
 */
export function printVersion(): void {
  // Read from package.json would be ideal, but for simplicity:
  console.log("wtree 0.1.0");
}
