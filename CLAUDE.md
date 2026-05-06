# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Issue Tracking — Linear

Issues live in the **PR Triager** project on Linear (team `Jgtest123`, prefix `JGT`).

Use the `linear-server` MCP tools (`list_issues`, `get_issue`, `save_issue`, etc.) to read and update them. Do not use TodoWrite/TaskCreate or markdown TODO files for project work — those are for in-conversation scratch only.

When starting work on an issue, set its state to `In Progress`; when done, set to `Done`. New work should be filed as a Linear issue under the PR Triager project.

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
