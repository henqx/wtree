# Roadmap

## v0.1.0 - MVP (Week 1)

The goal: **works for Node.js projects on macOS/Linux**.

### Core Commands
- [x] `wtree create <branch>` - Create worktree with cached artifacts
- [x] `wtree create <branch> --from <source>` - Explicit source worktree
- [x] `wtree restore <path>` - Restore artifacts to existing worktree  
- [x] `wtree analyze` - Show detected config
- [x] `wtree remove <branch>` - Remove worktree

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
- [x] npm package

---

## v0.2.0 - Monorepo Support (Week 2)

### Detection
- [ ] Recipe: Turborepo
- [ ] Recipe: Nx
- [ ] Recipe: Lerna
- [ ] Recipe: pnpm workspaces (without turbo)
- [ ] Glob pattern expansion (`**/node_modules`)

### Config
- [ ] `.wtree.yaml` support
- [ ] `extends` for built-in recipes
- [ ] Custom `cache` patterns
- [ ] Custom `post_restore` commands

### Quality
- [ ] Unit tests for detection
- [ ] Integration tests with real repos
- [ ] CI pipeline (GitHub Actions)

---

## v0.3.0 - Multi-Language (Week 3-4)

### Python
- [ ] Recipe: uv
- [ ] Recipe: pip + venv
- [ ] Recipe: poetry
- [ ] Recipe: pdm

### Rust
- [ ] Recipe: Cargo
- [ ] Incremental build cache handling

### Go
- [ ] Recipe: Go modules
- [ ] Vendor directory support

### Mixed Stacks
- [ ] Detect multiple stacks in one repo
- [ ] Merge cache patterns from multiple recipes

---

## v0.4.0 - Polish & Distribution (Week 5)

### Installation
- [ ] Homebrew formula
- [ ] Homebrew tap: `brew install wtree/tap/wtree`
- [ ] Submit to homebrew-core (stretch)

### Developer Experience
- [ ] `wtree init` - Generate .wtree.yaml interactively
- [ ] `wtree doctor` - Diagnose common issues
- [ ] Colored output
- [ ] Progress indicators for long copies

### Documentation
- [ ] Man page
- [ ] Website (wtree.dev)
- [ ] Usage examples for Cursor/Codex/Claude Code

---

## v0.5.0 - Performance & Advanced Features (Week 6+)

### Performance
- [ ] Parallel hardlink operations for monorepos
- [ ] Copy-on-write support (APFS `cp -c`, Btrfs reflinks)
- [ ] Lockfile hash comparison (skip post_restore if unchanged)

### Advanced
- [ ] `wtree list` - Show all worktrees with cache status
- [ ] `wtree clean` - Remove orphaned cache artifacts
- [ ] Worktree templates (pre-configured setups)

### Integrations
- [ ] GitHub Action for CI worktree caching
- [ ] VS Code extension (create worktree from UI)

---

## v1.0.0 - Stable Release

### Requirements
- [ ] All common stacks supported
- [ ] Comprehensive test coverage
- [ ] Stable CLI interface (no breaking changes)
- [ ] Documentation complete
- [ ] Homebrew core accepted

### Windows Support
- [ ] NTFS hardlink support
- [ ] PowerShell install script
- [ ] Test on Windows CI

---

## Future Ideas (Post v1.0)

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
