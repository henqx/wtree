import { color } from "./color.ts";

export interface ProgressOptions {
  enabled: boolean;
  total: number;
  label: string;
}

export class ProgressTracker {
  private enabled: boolean;
  private total: number;
  private current: number = 0;
  private label: string;
  private startTime: number;
  private lastUpdate: number = 0;

  constructor(options: ProgressOptions) {
    this.enabled = options.enabled && !process.env.CI && process.stderr.isTTY;
    this.total = options.total;
    this.label = options.label;
    this.startTime = Date.now();
  }

  update(current: number, message?: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    // Throttle updates to avoid flickering (max 10 updates/sec)
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;

    this.current = current;
    const percent = Math.round((current / this.total) * 100);
    const bar = this.renderBar(percent);
    const elapsed = ((now - this.startTime) / 1000).toFixed(1);

    // Clear line and render progress
    const line = `${bar} ${current}/${this.total} ${this.label}`;
    const suffix = message ? ` - ${message}` : ` (${elapsed}s)`;

    process.stderr.write(`\r${line}${suffix.slice(0, 40).padEnd(40)}`);
  }

  private renderBar(percent: number): string {
    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = color.green("█".repeat(filled)) + color.muted("░".repeat(empty));
    return `[${bar}] ${percent}%`;
  }

  finish(message?: string): void {
    if (!this.enabled) return;

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const line = message
      ? `\r${color.green("✓")} ${this.label} ${message} (${elapsed}s)\n`
      : `\r${color.green("✓")} ${this.label} complete (${elapsed}s)\n`;

    process.stderr.write(line);
  }

  error(message: string): void {
    if (!this.enabled) return;
    process.stderr.write(`\r${color.red("✗")} ${this.label} ${message}\n`);
  }
}

export function shouldShowProgress(args: { flags: { json?: boolean; noProgress?: boolean } }): boolean {
  // Never show progress in JSON mode
  if (args.flags.json) return false;
  // Never show progress if explicitly disabled
  if (args.flags.noProgress) return false;
  // Never show progress in CI environments
  if (process.env.CI) return false;
  // Only show if we have a TTY
  return process.stderr.isTTY ?? false;
}
