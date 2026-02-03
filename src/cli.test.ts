import { describe, test, expect } from "bun:test";
import { parse } from "./cli";

describe("CLI parser", () => {
  describe("help command", () => {
    test("parses --help flag", () => {
      const result = parse(["--help"]);
      expect(result.command).toBe("help");
      expect(result.flags.help).toBe(true);
    });

    test("parses -h flag", () => {
      const result = parse(["-h"]);
      expect(result.command).toBe("help");
    });

    test("parses help command", () => {
      const result = parse(["help"]);
      expect(result.command).toBe("help");
    });

    test("shows help for empty args", () => {
      const result = parse([]);
      expect(result.command).toBe("help");
    });

    test("shows help for unknown command", () => {
      const result = parse(["unknown-command"]);
      expect(result.command).toBe("help");
    });
  });

  describe("version command", () => {
    test("parses --version flag", () => {
      const result = parse(["--version"]);
      expect(result.command).toBe("version");
    });

    test("parses -v flag", () => {
      const result = parse(["-v"]);
      expect(result.command).toBe("version");
    });

    test("parses version command", () => {
      const result = parse(["version"]);
      expect(result.command).toBe("version");
    });
  });

  describe("add command", () => {
    test("parses add with path", () => {
      const result = parse(["add", "../feature-branch"]);
      expect(result.command).toBe("add");
      expect(result.positional).toEqual(["../feature-branch"]);
    });

    test("parses add with path and branch", () => {
      const result = parse(["add", "../feature-branch", "main"]);
      expect(result.command).toBe("add");
      expect(result.positional).toEqual(["../feature-branch", "main"]);
    });

    test("parses add with -b flag", () => {
      const result = parse(["add", "-b", "my-feature", "../path"]);
      expect(result.command).toBe("add");
      expect(result.flags.branch).toBe("my-feature");
      expect(result.positional).toEqual(["../path"]);
    });

    test("parses add with --from flag", () => {
      const result = parse(["add", "../feature", "--from", "develop"]);
      expect(result.command).toBe("add");
      expect(result.flags.from).toBe("develop");
      expect(result.positional).toEqual(["../feature"]);
    });

    test("parses add with -f flag (short for --from)", () => {
      const result = parse(["add", "../feature", "-f", "develop"]);
      expect(result.command).toBe("add");
      expect(result.flags.from).toBe("develop");
    });

    test("parses add with --json flag", () => {
      const result = parse(["add", "../feature", "--json"]);
      expect(result.command).toBe("add");
      expect(result.flags.json).toBe(true);
    });

    test("parses add with multiple flags", () => {
      const result = parse(["add", "-b", "feat", "../path", "--from", "main", "--json"]);
      expect(result.command).toBe("add");
      expect(result.flags.branch).toBe("feat");
      expect(result.flags.from).toBe("main");
      expect(result.flags.json).toBe(true);
      expect(result.positional).toEqual(["../path"]);
    });
  });

  describe("restore command", () => {
    test("parses restore with path", () => {
      const result = parse(["restore", "./worktree"]);
      expect(result.command).toBe("restore");
      expect(result.positional).toEqual(["./worktree"]);
    });

    test("parses restore with --from flag", () => {
      const result = parse(["restore", "./worktree", "--from", "main"]);
      expect(result.command).toBe("restore");
      expect(result.flags.from).toBe("main");
    });
  });

  describe("analyze command", () => {
    test("parses analyze", () => {
      const result = parse(["analyze"]);
      expect(result.command).toBe("analyze");
    });

    test("parses analyze with --json", () => {
      const result = parse(["analyze", "--json"]);
      expect(result.command).toBe("analyze");
      expect(result.flags.json).toBe(true);
    });
  });

  describe("remove command", () => {
    test("parses remove with path", () => {
      const result = parse(["remove", "../feature-branch"]);
      expect(result.command).toBe("remove");
      expect(result.positional).toEqual(["../feature-branch"]);
    });

    test("parses remove with --force flag", () => {
      const result = parse(["remove", "../feature-branch", "--force"]);
      expect(result.command).toBe("remove");
      expect(result.flags.force).toBe(true);
    });
  });

  describe("default flag values", () => {
    test("json defaults to false", () => {
      const result = parse(["analyze"]);
      expect(result.flags.json).toBe(false);
    });

    test("help defaults to false", () => {
      const result = parse(["analyze"]);
      expect(result.flags.help).toBe(false);
    });

    test("version defaults to false", () => {
      const result = parse(["analyze"]);
      expect(result.flags.version).toBe(false);
    });
  });
});
