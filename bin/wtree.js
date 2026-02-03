#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, "..", "src", "index.ts");

// Check if bun is available
function hasBun() {
  try {
    const result = spawn("bun", ["--version"], { stdio: "ignore" });
    return new Promise((resolve) => {
      result.on("close", (code) => resolve(code === 0));
      result.on("error", () => resolve(false));
    });
  } catch {
    return Promise.resolve(false);
  }
}

async function main() {
  const bunAvailable = await hasBun();

  if (!bunAvailable) {
    console.error("Error: wtree requires Bun to be installed.");
    console.error("");
    console.error("Install Bun:");
    console.error("  curl -fsSL https://bun.sh/install | bash");
    console.error("");
    console.error("Or use the standalone binary:");
    console.error("  curl -fsSL https://raw.githubusercontent.com/henqx/wtree/main/scripts/install.sh | bash");
    process.exit(1);
  }

  // Run with bun
  const child = spawn("bun", ["run", srcPath, ...process.argv.slice(2)], {
    stdio: "inherit",
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

main();
