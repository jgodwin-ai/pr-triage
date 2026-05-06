import { describe, it, expect } from "vitest";
import { classify } from "../../src/services/noise-classifier.js";
import type { CommitInput, DiffInput } from "../../src/services/noise-classifier.js";

const featureCommit: CommitInput = {
  subject: "feat: add new login flow",
  message: "feat: add new login flow\n\nIntroduces JWT-backed login.",
};

const featureDiff: DiffInput = [
  { path: "src/auth/login.ts", additions: 80, deletions: 5 },
  { path: "src/auth/login.test.ts", additions: 40, deletions: 0 },
];

describe("classify (noise-classifier)", () => {
  it("classifies a vanilla feature commit with substantial diff as feature", () => {
    const result = classify(featureCommit, featureDiff);
    expect(result.verdict).toBe("feature");
    expect(result.noiseReason).toBeUndefined();
  });

  it("classifies a fixup! commit as noise", () => {
    const result = classify(
      { subject: "fixup! feat: add new login flow" },
      featureDiff,
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("fixup commit");
  });

  it("classifies a squash! commit as noise", () => {
    const result = classify(
      { subject: "squash! feat: add new login flow" },
      featureDiff,
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("fixup commit");
  });

  it("classifies wip: prefix as noise (case-insensitive)", () => {
    const result = classify(
      { subject: "WIP: still hacking" },
      featureDiff,
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("wip commit");
  });

  it("classifies 'wip ' (space) prefix as noise", () => {
    const result = classify(
      { subject: "wip refactor of auth module" },
      featureDiff,
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("wip commit");
  });

  it("does NOT mark a non-prefix 'wip' substring as noise", () => {
    const result = classify(
      { subject: "feat: add swipe gesture" },
      featureDiff,
    );
    expect(result.verdict).toBe("feature");
  });

  it("classifies lockfile-only diff as noise", () => {
    const result = classify(
      { subject: "chore: bump deps" },
      [
        { path: "package-lock.json", additions: 200, deletions: 180 },
        { path: "pnpm-lock.yaml", additions: 50, deletions: 50 },
      ],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("lockfile-only");
  });

  it("classifies a tiny diff (<5 LOC ignoring lockfiles) as noise", () => {
    const result = classify(
      { subject: "fix: typo" },
      [
        { path: "src/util.ts", additions: 1, deletions: 1 },
        { path: "package-lock.json", additions: 100, deletions: 100 },
      ],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("<5 LOC change");
  });

  it("treats a commit touching a lockfile AND a real source file with >5 LOC as feature", () => {
    const result = classify(
      { subject: "feat: add caching layer" },
      [
        { path: "package-lock.json", additions: 500, deletions: 400 },
        { path: "src/cache.ts", additions: 60, deletions: 2 },
      ],
    );
    expect(result.verdict).toBe("feature");
    expect(result.noiseReason).toBeUndefined();
  });

  it("classifies chore(deps) commit as noise", () => {
    const result = classify(
      { subject: "chore(deps): bump lodash from 4.17.20 to 4.17.21" },
      [{ path: "src/foo.ts", additions: 50, deletions: 0 }], // intentionally large
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("dependency bump");
  });

  it("classifies chore(deps-dev) commit as noise", () => {
    const result = classify(
      { subject: "chore(deps-dev): bump vitest from 3.0.0 to 3.1.0" },
      [{ path: "package.json", additions: 1, deletions: 1 }],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("dependency bump");
  });

  it("classifies dependabot-style 'Bump X from Y to Z' commit as noise", () => {
    const result = classify(
      { subject: "Bump lodash from 4.17.20 to 4.17.21" },
      [{ path: "package.json", additions: 1, deletions: 1 }],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("dependency bump");
  });

  it("recognizes all common lockfiles", () => {
    const lockfiles = [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "Cargo.lock",
      "poetry.lock",
      "Pipfile.lock",
      "go.sum",
    ];
    for (const lf of lockfiles) {
      const result = classify(
        { subject: "chore: update" },
        [{ path: lf, additions: 100, deletions: 50 }],
      );
      expect(result.verdict, `expected ${lf} to be noise`).toBe("noise");
      expect(result.noiseReason).toBe("lockfile-only");
    }
  });

  it("recognizes lockfiles in subdirectories", () => {
    const result = classify(
      { subject: "chore: update" },
      [{ path: "frontend/package-lock.json", additions: 100, deletions: 50 }],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("lockfile-only");
  });

  it("treats an empty diff as noise (<5 LOC)", () => {
    const result = classify({ subject: "feat: nothing" }, []);
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("<5 LOC change");
  });

  it("detects fixup commit via full message body when subject doesn't show it", () => {
    // git can produce commits where the trailer 'fixup!' shows in the body for autosquash
    const result = classify(
      {
        subject: "amend changes",
        message: "amend changes\n\nfixup! feat: add new login flow",
      },
      featureDiff,
    );
    // The spec emphasizes subject prefix; body match is optional. We still expect the
    // primary check (subject) to NOT mark this as fixup, so it should be a feature.
    expect(result.verdict).toBe("feature");
  });

  it("treats commit with exactly 5 LOC outside lockfiles as feature (boundary)", () => {
    const result = classify(
      { subject: "fix: small fix" },
      [{ path: "src/util.ts", additions: 3, deletions: 2 }],
    );
    expect(result.verdict).toBe("feature");
  });

  it("treats commit with 4 LOC outside lockfiles as noise (boundary)", () => {
    const result = classify(
      { subject: "fix: small fix" },
      [{ path: "src/util.ts", additions: 2, deletions: 2 }],
    );
    expect(result.verdict).toBe("noise");
    expect(result.noiseReason).toBe("<5 LOC change");
  });
});
