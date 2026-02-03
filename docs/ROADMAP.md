# Roadmap

## v0.1.0 - MVP

The goal: **works for Node.js projects on macOS/Linux**.

### Core Commands
- [x] `wtree add <path> [branch]` - Create worktree with cached artifacts
- [x] `wtree add <path> --from <source>` - Explicit source worktree
- [x] `wtree add -b <branch> <path>` - Create new branch explicitly
- [x] `wtree restore <path>` - Restore artifacts to existing worktree
- [x] `wtree analyze` - Show detected config
- [x] `wtree remove <path>` - Remove worktree
- [x] Nested worktree support with .gitignore warning

### Detection
- [x] Recipe: pnpm
- [x] Recipe: npm
- [x] Recipe: yarn
- [x] Basic .gitignore inference

### Copy
- [x] Hardlink copy via `cp -al`
- [x] Post-restore command execution

### Output
- [x] Human-readable output (default)
- [x] `--json` flag for agent integration

### Distribution
- [x] Bun compiled binary
- [x] curl install script
- [x] npm package (ready, not published)

---

## v0.2.0 - Monorepo Support

### Detection
- [x] Recipe: Turborepo
- [x] Recipe: Nx
- [x] Recipe: Lerna
- [x] Recipe: pnpm workspaces (without turbo)
- [x] Recipe: Rush.js
- [x] Glob pattern expansion (`**/node_modules`)

### Config
- [x] `.wtree.yaml` support
- [x] `extends` for built-in recipes
- [x] Custom `cache` patterns
- [x] Custom `post_restore` commands

### Quality
- [x] Unit tests for detection
- [x] Unit tests for CLI parsing
- [x] Unit tests for config parsing
- [x] Integration tests with real repos
- [x] CI pipeline (GitHub Actions)

---

## v0.3.0 - Multi-Language

### Python
- [x] Recipe: uv
- [x] Recipe: pip + venv
- [x] Recipe: poetry
- [x] Recipe: pdm

### Rust
- [x] Recipe: Cargo
- [x] ~~Incremental build cache handling~~ (deferred to post-1.0)

### Go
- [x] Recipe: Go modules
- [x] Vendor directory support

 ### Mixed Stacks
- [x] Detect multiple stacks in one repo
- [x] Merge cache patterns from multiple recipes

---

## v0.4.0 - Polish & Distribution

### Installation
- [x] Homebrew formula
- [x] Homebrew tap: `brew install henqx/wtree/wtree`
- [ ] Submit to homebrew-core (stretch)

### Developer Experience
- [ ] `wtree init` - Generate .wtree.yaml interactively
- [ ] `wtree doctor` - Diagnose common issues
- [x] Colored output
- [ ] Progress indicators for long copies

### Documentation
- [ ] Man page
- [ ] Website (wtree.dev)
- [ ] Usage examples for Cursor/Codex/Claude Code

---

## v0.5.0 - Performance & Advanced Features

### Performance
- [ ] Parallel hardlink operations for monorepos
- [ ] Copy-on-write support (APFS `cp -c`, Btrfs reflinks)
- [ ] Lockfile hash comparison (skip post_restore if unchanged)

### Advanced
- [x] `wtree list` - Show all worktrees with cache status
- [ ] `wtree clean` - Remove orphaned cache artifacts
- [ ] Worktree templates (pre-configured setups)

---

## v1.0.0 - Stable Release

### Requirements
- [ ] All common stacks supported
- [ ] Comprehensive test coverage
- [ ] Stable CLI interface (no breaking changes)
- [ ] Documentation complete
- [ ] Homebrew core accepted


---

## Future Ideas (Post v1.0)

### Windows Support
- [ ] NTFS hardlink support
- [ ] PowerShell install script
- [ ] Test on Windows CI

### Integrations
- [ ] GitHub Action for CI worktree caching
- [ ] VS Code extension (create worktree from UI)

### Remote Caching
Like Turborepo's remote cache, but for all artifacts:
- Push cache to S3/GCS after CI build
- Pull cache in new worktrees
- Share cache across machines/developers

### Agent Protocol
Standardized interface for AI coding agents:
- Structured input/output format
- Callback hooks for progress
- Integration with agent orchestrators

### Smart Diffing
- Diff lockfiles between source and target
- Only copy artifacts that are likely to be valid
- Predict post_restore time based on diff size

### Workspace Snapshots
- Save complete workspace state (not just artifacts)
- Restore to exact point in time
- Useful for debugging agent runs

### Rust Optimization
- [ ] Incremental build cache handling in `target/` directory
- Analyze fingerprint files to avoid copying stale artifacts

---

## Non-Goals

Things we explicitly won't do:

1. **Replace package managers** - We're a caching layer, not a package manager
2. **Build orchestration** - Use Turborepo/Nx for that
3. **Version control** - We wrap git, not replace it
4. **Cross-platform artifacts** - Cache is local to one machine
5. **Cloud-first** - Local-first, cloud features are optional

---

## Contributing

See CONTRIBUTING.md (TODO) for how to help. Priority areas:

1. **Recipes** - Add support for your stack
2. **Testing** - More edge cases, more stacks
3. **Documentation** - Examples, tutorials, troubleshooting
4. **Platform support** - Windows testing
