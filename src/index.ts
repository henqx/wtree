#!/usr/bin/env bun

import { parse, printHelp, printVersion } from "./cli.ts";
import { WtreeError, ErrorCode } from "./types.ts";
import type { CommandResult, ErrorResult } from "./types.ts";

import { analyze, formatAnalyzeResult } from "./commands/analyze.ts";
import { add, formatAddResult } from "./commands/add.ts";
import { restore, formatRestoreResult } from "./commands/restore.ts";
import { remove, formatRemoveResult } from "./commands/remove.ts";

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));

  // Handle help and version
  if (args.command === "help") {
    printHelp();
    process.exit(0);
  }

  if (args.command === "version") {
    printVersion();
    process.exit(0);
  }

  try {
    let result: CommandResult;
    let humanOutput: string;

    switch (args.command) {
      case "analyze":
        result = await analyze(args);
        humanOutput = formatAnalyzeResult(result);
        break;

      case "add":
        result = await add(args);
        humanOutput = formatAddResult(result);
        break;

      case "restore":
        result = await restore(args);
        humanOutput = formatRestoreResult(result);
        break;

      case "remove":
        result = await remove(args);
        humanOutput = formatRemoveResult(result);
        break;

      default:
        printHelp();
        process.exit(1);
    }

    // Output result
    if (args.flags.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(humanOutput);
    }
  } catch (error) {
    const errorResult: ErrorResult = {
      error: true,
      code: error instanceof WtreeError ? error.code : ErrorCode.UNKNOWN,
      message: error instanceof Error ? error.message : String(error),
    };

    if (args.flags.json) {
      console.log(JSON.stringify(errorResult, null, 2));
      process.exit(1);
    } else {
      console.error(`Error: ${errorResult.message}`);
      process.exit(1);
    }
  }
}

main();
