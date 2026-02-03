# A CLI Tool for Faster Parallel Agent Workflows

I've been doing the terminal-split-into-4-claude-code-instances.

It's great until you realize every agent needs its own git worktree, and every worktree needs `npm install`, and now you're watching five terminals run `node_modules` tetris while they could be vibing.

So "I" built `wtree`.

## What It Does

It wraps `git worktree add` and then runs `cp -al` (or `cp -Rl` on macOS) to hardlink your `node_modules`, `.turbo`, `.next`—whatever—from your main worktree into the new one.

```bash
wtree add ../my-feature
# Git worktree: created
# Dependencies: hardlinked
# Time wasted: zero
```

## How I Use It With Agents

For agents running in worktrees, I tell them:

> "Before you start, run `wtree restore . --from ../main`"

Now the agent sets up its own environment instantly. It detects Turborepo, TypeScript, the usual suspects—no config needed, it just reads your lockfiles.

## Why Bother?

Because waiting for `npm install` is dead time in agentic workflows. You spin up four coding agents and then make them watch a progress bar for 3 minutes each. This removes that friction. They start working immediately.

Claude wrote the whole thing in an afternoon. Sometimes the best tools are the dumb ones.
