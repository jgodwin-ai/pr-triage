# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Issue Tracking — Linear

Issues live in the **PR Triager** project on Linear (team `Jgtest123`, prefix `JGT`).

Use the `linear-server` MCP tools (`list_issues`, `get_issue`, `save_issue`, `save_comment`) to read and update them. Do not use TodoWrite/TaskCreate or markdown TODO files for project work — those are for in-conversation scratch only.

### Per-issue workflow

1. **Pull a task.** When you pick up a Linear issue, set its state to `In Progress` and post a comment on the issue (`save_comment`) saying you're executing it now. This makes it visible that the work is live.
2. **Implement.** Use a feature branch named after the issue (e.g., `jgt-25-commit-stack-service`). Linear's `gitBranchName` field on each issue gives a suggested name.
3. **Hand off for review.** When the work is ready, set the issue's state to `In Review` and link the GitHub PR by adding the PR URL to the issue (open the PR with `gh pr create`, then mention the issue ID in the PR body — `Closes JGT-25` — so the GitHub ↔ Linear integration links them automatically). Comment on the issue with the PR link as well.
4. **Close.** Linear closes the issue automatically when the linked PR merges, thanks to the GitHub integration.

New work that surfaces during implementation should be filed as a Linear issue under the PR Triager project.

## Execution Style — Prefer Subagents

For multi-task work (e.g., executing a phase plan), prefer dispatching a fresh subagent per task using the `superpowers:subagent-driven-development` skill rather than running everything inline. Subagents preserve the main session's context, isolate task-level work, and the two-stage review (spec compliance, then code quality) catches drift early.

Inline execution is fine for single, small changes where the overhead of spinning up a subagent isn't justified.

## Build & Test

```bash
# Backend (port 9000)
cd backend && npm install && npm run dev

# Frontend (port 5173)
cd frontend && npm install && npm run dev

# Tests
cd backend && npm test
cd frontend && npm test
```

## Architecture Overview

- `backend/` — Express + TypeScript API. Three-stage Claude pipeline (file analysis → clustering → ranking), GitHub integration, WebSocket streaming.
- `frontend/` — React + Vite review UI (cluster sidebar, diff viewer with annotations, right rail).
- `analyzer/` — Python + FastAPI sidecar (Phase 2, in progress) for AST/dependency-graph analysis.

## Session Completion

Before ending a session: run quality gates if code changed, commit changes with a descriptive message, and `git push`. Work is not complete until pushed.
