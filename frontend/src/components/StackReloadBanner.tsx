import { useLatestKnownHeadSha } from "../hooks/useLatestKnownHeadSha.js";

interface Props {
  /** URL of the PR being reviewed; passed back to onReload so the caller can refetch. */
  prUrl: string;
  /** The headSha the currently-displayed analysis was built against. */
  analysisHeadSha: string;
  /** Called when the user clicks "Reload stack". Receives the prUrl. */
  onReload: (prUrl: string) => void;
}

/**
 * Non-blocking banner that surfaces when the PR's head SHA on GitHub has moved
 * past what the user is currently reviewing. Detection happens passively via
 * {@link useLatestKnownHeadSha} — anything that fetches PR data updates the
 * stack store, and this banner re-renders on the next change.
 *
 * Drafts are anchored by `commitId` and are NOT cleared by reload.
 */
export default function StackReloadBanner({ prUrl, analysisHeadSha, onReload }: Props) {
  const latestKnownHeadSha = useLatestKnownHeadSha();

  // No drift: SHA unknown or matches what we're showing.
  if (!latestKnownHeadSha || latestKnownHeadSha === analysisHeadSha) {
    return null;
  }

  return (
    <div className="stack-reload-banner" role="status" aria-live="polite">
      <span className="stack-reload-banner__message">This PR has new commits.</span>
      <button
        type="button"
        className="btn-link stack-reload-banner__action"
        onClick={() => onReload(prUrl)}
      >
        Reload stack
      </button>
    </div>
  );
}
