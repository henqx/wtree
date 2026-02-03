/**
 * Simple ANSI color utilities for terminal output
 */

// Check if colors should be enabled
const supportsColor = (): boolean => {
  // Disable colors if NO_COLOR is set or not a TTY
  if (process.env.NO_COLOR !== undefined) return false;
  if (!process.stdout.isTTY) return false;
  // Force colors if FORCE_COLOR is set
  if (process.env.FORCE_COLOR !== undefined) return true;
  return true;
};

const enabled = supportsColor();

// ANSI escape codes
const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

type ColorFn = (text: string) => string;

const wrap = (code: string): ColorFn => {
  if (!enabled) return (text) => text;
  return (text) => `${code}${text}${codes.reset}`;
};

export const color = {
  // Styles
  bold: wrap(codes.bold),
  dim: wrap(codes.dim),

  // Colors
  red: wrap(codes.red),
  green: wrap(codes.green),
  yellow: wrap(codes.yellow),
  blue: wrap(codes.blue),
  magenta: wrap(codes.magenta),
  cyan: wrap(codes.cyan),
  white: wrap(codes.white),
  gray: wrap(codes.gray),

  // Semantic
  success: wrap(codes.green),
  error: wrap(codes.red),
  warning: wrap(codes.yellow),
  info: wrap(codes.cyan),
  muted: wrap(codes.gray),
};
