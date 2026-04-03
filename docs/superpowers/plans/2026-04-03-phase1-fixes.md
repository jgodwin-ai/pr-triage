# Phase 1 Code Review Fixes & Test Coverage Plan

**Goal:** Fix all critical/important issues from code review, then achieve 80%+ test coverage.

---

## Fix 1: JSON Parse Safety in All Agents
- Add `extractJSON` helper that strips markdown fences and handles parse errors
- Add try/catch with descriptive errors in all 3 agents
- Validate response has text content before parsing

## Fix 2: Pipeline Error Handling
- Update `startPipeline` catch block to call `setAnalysis(id, { status: "error", error })` 
- Add try/catch inside `runPipeline` that sends error WSMessage
- Handle zero-files edge case

## Fix 3: Ranking Agent Non-null Safety
- Guard `clusterMap.get(update.id)` — skip unknown IDs instead of crashing
- Validate all input files appear in at least one cluster after clustering

## Fix 4: Frontend Error Handling
- Wrap `JSON.parse` in useWebSocket with try/catch
- Wrap entire `startAnalysis` in try/catch for network errors
- Guard `res.json()` call for non-JSON error responses

## Fix 5: SPA Wildcard Route Fix
- Exclude `/api/*` paths from the catch-all
- Return proper 404 for unknown API routes

## Fix 6: Analysis Store TTL
- Add max size + TTL eviction to analyses map

## Fix 7: GitHub Pagination
- Paginate `listFiles` to handle PRs with >100 files
- Filter out binary files (no patch)

## Fix 8: Concurrency Limit
- Add p-limit for parallel Claude API calls in pipeline

## Fix 9: Frontend Accessibility & UX Fixes
- ClusterList: add keyboard support (role, tabIndex, onKeyDown)
- Breadcrumbs: use buttons instead of `<a href="#">`, add aria-label
- DiffView: exclude `---`/`+++`/`@@` lines from coloring
- Remove dead `analysisId` state from App.tsx
- Remove unused `onAnalysisStarted` prop

## Fix 10: Comprehensive Unit Tests
- Backend: error cases, edge cases, all untested paths
- Frontend: all components, hooks, error states
- Target: 80%+ coverage
